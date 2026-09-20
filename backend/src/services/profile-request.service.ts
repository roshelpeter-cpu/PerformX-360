import {
  ProfileChangeRequestStatus,
  ProfileChangeRequestType,
  Prisma,
  Role,
} from "../../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import type { AppRole } from "../constants/roles.js";
import { AppError } from "../utils/errors.js";
import { createNotification } from "./notification.service.js";

type Actor = { id: string; role: AppRole };

const requestInclude = {
  requester: {
    include: {
      department: true,
      team: { select: { id: true, name: true } },
    },
  },
  recipient: { select: { id: true, employeeId: true, name: true, role: true } },
} as const;

async function resolveRecipient(actorId: string, role: AppRole) {
  const employee = await prisma.employee.findUnique({
    where: { id: actorId },
    include: {
      team: {
        include: {
          hrAssignments: { include: { hrEmployee: true }, take: 1 },
          supervisor: true,
        },
      },
    },
  });
  if (!employee) throw new AppError("Authentication required", 401);

  if (role === Role.HR) {
    const manager = await prisma.employee.findFirst({
      where: { role: Role.HR_MANAGER },
      orderBy: { employeeId: "asc" },
    });
    if (!manager) throw new AppError("No HR Manager is available to receive this request.", 400);
    return { employee, recipient: manager };
  }

  if (role === Role.HR_MANAGER) {
    throw new AppError("HR Manager profile updates are handled outside this request flow.", 400);
  }

  const hr = employee.team?.hrAssignments[0]?.hrEmployee;
  if (hr) return { employee, recipient: hr };

  const fallback = await prisma.employee.findFirst({
    where: { role: Role.HR },
    orderBy: { employeeId: "asc" },
  });
  if (!fallback) throw new AppError("No HR staff is assigned to your team.", 400);
  return { employee, recipient: fallback };
}

type RequestRow = Prisma.ProfileChangeRequestGetPayload<{
  include: typeof requestInclude;
}>;

function mapRequest(row: RequestRow) {
  return {
    id: row.id,
    requestType: row.requestType,
    summary: row.summary,
    currentValue: row.currentValue,
    requestedValue: row.requestedValue,
    reason: row.reason,
    status: row.status,
    evidenceName: row.evidenceName,
    evidenceMime: row.evidenceMime,
    evidenceSize: row.evidenceSize,
    hasEvidence: Boolean(row.evidence),
    createdAt: row.createdAt,
    reviewedAt: row.reviewedAt,
    requester: {
      id: row.requester.id,
      employeeId: row.requester.employeeId,
      name: row.requester.name,
      jobTitle: row.requester.jobTitle,
      role: row.requester.role,
      companyEmail: row.requester.companyEmail,
      department: row.requester.department,
      team: row.requester.team,
    },
    recipient: row.recipient,
  };
}

export async function submitProfileChangeRequest(
  actor: Actor,
  input: {
    requestType: ProfileChangeRequestType;
    summary: string;
    currentValue: string;
    requestedValue: string;
    reason: string;
  },
  evidence?: { filename: string; originalName: string; mimetype: string; size: number }
) {
  const { employee, recipient } = await resolveRecipient(actor.id, actor.role);

  const request = await prisma.profileChangeRequest.create({
    data: {
      requesterId: employee.id,
      recipientId: recipient.id,
      requestType: input.requestType,
      summary: input.summary.trim(),
      currentValue: input.currentValue.trim(),
      requestedValue: input.requestedValue.trim(),
      reason: input.reason.trim(),
      ...(evidence
        ? {
            evidence: evidence.filename,
            evidenceName: evidence.originalName,
            evidenceMime: evidence.mimetype,
            evidenceSize: evidence.size,
          }
        : {}),
    },
    include: requestInclude,
  });

  await createNotification({
    type: "PROFILE_CHANGE_REQUEST",
    title: `${employee.name} requested a profile update`,
    message: input.summary.trim(),
    recipientId: recipient.id,
    subjectEmployeeId: employee.id,
    metadata: { requestId: request.id, requestType: input.requestType },
  });

  return mapRequest(request);
}

export async function listInbox(actor: Actor, status?: string) {
  const where =
    actor.role === Role.HR || actor.role === Role.HR_MANAGER
      ? {
          recipientId: actor.id,
          ...(status && status !== "ALL" ? { status: status as ProfileChangeRequestStatus } : {}),
        }
      : { requesterId: actor.id };

  const rows = await prisma.profileChangeRequest.findMany({
    where,
    include: requestInclude,
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => mapRequest(row));
}

export async function getProfileChangeRequest(actor: Actor, id: string) {
  const row = await prisma.profileChangeRequest.findUnique({
    where: { id },
    include: requestInclude,
  });
  if (!row) throw new AppError("Request not found", 404);
  if (row.recipientId !== actor.id && row.requesterId !== actor.id) {
    throw new AppError("You do not have permission to view this request.", 403);
  }
  return mapRequest(row);
}

export async function reviewProfileChangeRequest(
  actor: Actor,
  id: string,
  decision: "APPROVED" | "REJECTED"
) {
  if (actor.role !== Role.HR && actor.role !== Role.HR_MANAGER) {
    throw new AppError("Only HR staff can review profile change requests.", 403);
  }
  const row = await prisma.profileChangeRequest.findUnique({
    where: { id },
    include: requestInclude,
  });
  if (!row) throw new AppError("Request not found", 404);
  if (row.recipientId !== actor.id) {
    throw new AppError("This request is not assigned to you.", 403);
  }
  if (row.status !== "PENDING") {
    throw new AppError("This request has already been reviewed.", 400);
  }

  if (decision === "APPROVED") {
    await applyApprovedChange(row);
  }

  const updated = await prisma.profileChangeRequest.update({
    where: { id },
    data: {
      status: decision,
      reviewedById: actor.id,
      reviewedAt: new Date(),
    },
    include: requestInclude,
  });

  await createNotification({
    type: "PROFILE_CHANGE_REQUEST",
    title:
      decision === "APPROVED"
        ? "Your profile change request was approved"
        : "Your profile change request was rejected",
    message: row.summary,
    recipientId: row.requesterId,
    subjectEmployeeId: row.requesterId,
    metadata: { requestId: row.id, status: decision },
  });

  return mapRequest(updated);
}

async function applyApprovedChange(row: {
  requesterId: string;
  requestType: ProfileChangeRequestType;
  summary: string;
  requestedValue: string;
}) {
  const employee = await prisma.employee.findUnique({
    where: { id: row.requesterId },
    select: { profileDetails: true, jobTitle: true },
  });
  if (!employee) return;
  const current =
    employee.profileDetails && typeof employee.profileDetails === "object"
      ? { ...(employee.profileDetails as Record<string, string>) }
      : {};
  const text = `${row.summary} ${row.requestedValue}`.toLowerCase();
  const value = row.requestedValue.trim();

  if (row.requestType === "CONTACT_INFORMATION") {
    current.contactNumber = value;
  } else if (row.requestType === "EMERGENCY_CONTACT") {
    if (text.includes("relationship")) current.emergencyContactRelationship = value;
    else if (text.includes("name")) current.emergencyContactName = value;
    else current.emergencyContactNumber = value;
  } else if (row.requestType === "PERSONAL_INFORMATION") {
    if (text.includes("gender")) current.gender = value;
    else if (text.includes("national")) current.nationality = value;
    else if (text.includes("birth") || text.includes("dob")) current.dateOfBirth = value;
    else current.contactNumber = value;
  } else if (row.requestType === "EMPLOYMENT_INFORMATION") {
    if (text.includes("location")) current.workLocation = value;
    else if (text.includes("type")) current.employmentType = value;
    else current.jobTitle = value;
  }

  await prisma.employee.update({
    where: { id: row.requesterId },
    data: {
      profileDetails: current as Prisma.InputJsonValue,
      ...(current.jobTitle ? { jobTitle: current.jobTitle } : {}),
    },
  });
}

export async function getEvidenceFile(actor: Actor, id: string) {
  const row = await prisma.profileChangeRequest.findUnique({ where: { id } });
  if (!row?.evidence) throw new AppError("No supporting document is attached.", 404);
  if (row.recipientId !== actor.id && row.requesterId !== actor.id) {
    throw new AppError("You do not have permission to download this file.", 403);
  }
  return {
    filename: row.evidence,
    originalName: row.evidenceName ?? row.evidence,
  };
}