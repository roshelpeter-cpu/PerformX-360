import {
  NotificationType,
  PdpApprovalStatus,
  PdpChangeRequestStatus,
  PdpHrChangeDecision,
  PdpGoalPriority,
  PdpGoalStatus,
  PdpReviewerRole,
  PdpStatus,
  PdpSubGoalStatus,
  PdpSupervisorChangeAction,
  Prisma,
  Role,
} from "../../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { createNotification } from "./notification.service.js";
import { AppError } from "../utils/errors.js";
import { computePdpScoring } from "../utils/pdp-scoring.js";
import type {
  CreatePdpInput,
  HrDecisionInput,
  PdpGoalInput,
  PdpListQuery,
  RequestChangesInput,
  SupervisorCannotChangeInput,
  UpdatePdpInput,
} from "../validations/pdp.validation.js";

type Actor = { id: string; role: Role };

const personSelect = {
  id: true,
  employeeId: true,
  name: true,
  jobTitle: true,
  companyEmail: true,
  role: true,
} satisfies Prisma.EmployeeSelect;

const goalOrder = { sortOrder: "asc" as const };

const versionInclude = {
  goals: {
    orderBy: goalOrder,
    include: {
      subGoals: {
        orderBy: goalOrder,
        include: { reviewedBy: { select: personSelect } },
      },
    },
  },
  approvals: {
    include: { reviewer: { select: personSelect } },
    orderBy: { reviewerRole: "asc" as const },
  },
  createdBy: { select: personSelect },
} satisfies Prisma.PdpVersionInclude;

const pdpInclude = {
  employee: {
    select: {
      ...personSelect,
      department: { select: { id: true, name: true } },
      team: {
        select: {
          id: true,
          name: true,
          supervisor: { select: personSelect },
          hrAssignments: {
            include: { hrEmployee: { select: personSelect } },
          },
        },
      },
    },
  },
  supervisor: { select: personSelect },
  cycle: { select: { id: true, name: true, startDate: true, endDate: true, status: true } },
  createdBy: { select: personSelect },
  approvedBy: { select: personSelect },
  versions: {
    include: versionInclude,
    orderBy: { versionNumber: "desc" as const },
  },
  changeRequests: {
    include: {
      requestedBy: { select: personSelect },
      supervisor: { select: personSelect },
      hrDecider: { select: personSelect },
    },
    orderBy: { createdAt: "desc" as const },
  },
  activities: {
    include: { actor: { select: personSelect } },
    orderBy: { createdAt: "desc" as const },
    take: 50,
  },
} satisfies Prisma.PersonalDevelopmentPlanInclude;

type PdpRecord = Prisma.PersonalDevelopmentPlanGetPayload<{ include: typeof pdpInclude }>;
type VersionRecord = Prisma.PdpVersionGetPayload<{ include: typeof versionInclude }>;

const EDITABLE_STATUSES: PdpStatus[] = [
  PdpStatus.DRAFT,
  PdpStatus.UNDER_SUPERVISOR_REVISION,
  PdpStatus.AWAITING_SUPERVISOR_ACTION,
];

const CHANGES_REQUESTED_STATUSES: PdpStatus[] = [
  PdpStatus.CHANGES_REQUESTED,
  PdpStatus.CHANGES_REQUESTED_BY_EMPLOYEE,
  PdpStatus.CHANGES_REQUESTED_BY_HR,
];

const SENDABLE_STATUSES: PdpStatus[] = [
  PdpStatus.DRAFT,
  PdpStatus.UNDER_SUPERVISOR_REVISION,
  PdpStatus.AWAITING_SUPERVISOR_ACTION,
  PdpStatus.PENDING_REAPPROVAL,
];

async function supervisedEmployeeIds(supervisorId: string) {
  const teams = await prisma.team.findMany({
    where: { supervisorId },
    select: { id: true },
  });
  const members = await prisma.employee.findMany({
    where: { role: Role.EMPLOYEE, deactivatedAt: null, teamId: { in: teams.map((t) => t.id) } },
    select: { id: true },
  });
  return new Set(members.map((m) => m.id));
}

async function hrScopeEmployeeIds(hrEmployeeId: string) {
  const assignments = await prisma.hrTeamAssignment.findMany({
    where: { hrEmployeeId },
    include: {
      team: {
        include: {
          supervisor: { select: { id: true } },
          employees: { where: { deactivatedAt: null }, select: { id: true } },
        },
      },
    },
  });
  const ids = new Set<string>([hrEmployeeId]);
  for (const assignment of assignments) {
    if (assignment.team.supervisor?.id) ids.add(assignment.team.supervisor.id);
    for (const employee of assignment.team.employees) ids.add(employee.id);
  }
  return ids;
}

async function assertCanAccessEmployee(actor: Actor, employeeId: string) {
  if (actor.role === Role.HR_MANAGER || actor.role === Role.LEADERSHIP || actor.role === Role.HR) return;
  if (actor.id === employeeId) return;
  if (actor.role === Role.SUPERVISOR) {
    const ids = await supervisedEmployeeIds(actor.id);
    if (!ids.has(employeeId)) throw new AppError("You can only manage PDPs for your team", 403);
    return;
  }
  throw new AppError("You do not have permission to access this PDP", 403);
}

async function assertCanAccessPdp(actor: Actor, pdp: PdpRecord) {
  if (actor.role === Role.HR_MANAGER || actor.role === Role.LEADERSHIP || actor.role === Role.HR) return;
  if (actor.id === pdp.employeeId) return;
  if (pdp.supervisorId && actor.id === pdp.supervisorId) return;
  await assertCanAccessEmployee(actor, pdp.employeeId);
}

async function resolveActiveCycle(cycleId?: string) {
  const select = { id: true, name: true, startDate: true, endDate: true, status: true } as const;
  if (cycleId) {
    const cycle = await prisma.appraisalCycle.findUnique({ where: { id: cycleId }, select });
    if (!cycle) throw new AppError("Appraisal cycle not found", 404);
    return cycle;
  }
  const active = await prisma.appraisalCycle.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { startDate: "desc" },
    select,
  });
  if (active) return active;
  const fallback = await prisma.appraisalCycle.findFirst({
    orderBy: { startDate: "desc" },
    select,
  });
  if (!fallback) throw new AppError("No appraisal cycle is available", 400);
  return fallback;
}

async function resolveBatchId(cycleId: string, employeeId: string) {
  const assignment = await prisma.employeeBatchAssignment.findUnique({
    where: { cycleId_employeeId: { cycleId, employeeId } },
    select: { batchId: true },
  });
  if (assignment?.batchId) return assignment.batchId;

  const existing = await prisma.appraisalBatch.findFirst({
    where: { cycleId },
    orderBy: { batchNumber: "asc" },
    select: { id: true },
  });
  if (existing) return existing.id;

  const cycle = await prisma.appraisalCycle.findUnique({
    where: { id: cycleId },
    select: { startDate: true, endDate: true },
  });
  if (!cycle) throw new AppError("Appraisal cycle not found", 404);

  const created = await prisma.appraisalBatch.create({
    data: {
      cycleId,
      batchNumber: 1,
      name: "Organization",
      startDate: cycle.startDate,
      endDate: cycle.endDate,
      status: "ONGOING",
    },
    select: { id: true },
  });
  return created.id;
}

function resolveHrForEmployee(employee: PdpRecord["employee"] | null | undefined) {
  return employee?.team?.hrAssignments[0]?.hrEmployee ?? null;
}

async function loadPdp(pdpId: string) {
  const pdp = await prisma.personalDevelopmentPlan.findUnique({
    where: { id: pdpId },
    include: pdpInclude,
  });
  if (!pdp) throw new AppError("PDP not found", 404);
  return pdp;
}

function currentVersion(pdp: PdpRecord): VersionRecord | null {
  return pdp.versions.find((v) => v.isCurrent) ?? pdp.versions[0] ?? null;
}

function approvalFor(version: VersionRecord | null, role: PdpReviewerRole) {
  return version?.approvals.find((a) => a.reviewerRole === role) ?? null;
}

function deriveStatusFromApprovals(
  employeeStatus: PdpApprovalStatus | undefined,
  hrStatus: PdpApprovalStatus | undefined
): PdpStatus {
  if (employeeStatus === PdpApprovalStatus.CHANGES_REQUESTED) {
    return PdpStatus.CHANGES_REQUESTED_BY_EMPLOYEE;
  }
  if (hrStatus === PdpApprovalStatus.CHANGES_REQUESTED) {
    return PdpStatus.CHANGES_REQUESTED_BY_HR;
  }
  if (
    employeeStatus === PdpApprovalStatus.APPROVED &&
    hrStatus === PdpApprovalStatus.APPROVED
  ) {
    return PdpStatus.APPROVED;
  }
  if (employeeStatus === PdpApprovalStatus.APPROVED && hrStatus === PdpApprovalStatus.PENDING) {
    return PdpStatus.PENDING_HR_REVIEW;
  }
  if (hrStatus === PdpApprovalStatus.APPROVED && employeeStatus === PdpApprovalStatus.PENDING) {
    return PdpStatus.PENDING_EMPLOYEE_REVIEW;
  }
  return PdpStatus.PENDING_EMPLOYEE_REVIEW;
}

function parseDueDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new AppError("Invalid goal due date", 400);
  return date;
}

function goalCreateData(pdpId: string, versionId: string, goals: PdpGoalInput[]) {
  return goals.map((goal, index) => ({
    pdpId,
    versionId,
    title: goal.title?.trim() || `Main Goal ${index + 1}`,
    objective: goal.objective?.trim() || "",
    expectedOutcome: goal.expectedOutcome ?? null,
    dueDate: parseDueDate(goal.dueDate),
    successCriteria: goal.successCriteria ?? null,
    category: goal.category ?? goal.developmentArea ?? null,
    developmentArea: goal.developmentArea ?? goal.category ?? null,
    notes: goal.notes ?? null,
    sortOrder: goal.sortOrder ?? index,
    priority: (goal.priority as PdpGoalPriority | undefined) ?? PdpGoalPriority.MEDIUM,
    measurementKpi: goal.measurementKpi ?? null,
    weightage: goal.weightage ?? 0,
    subGoals: {
      create: (
        goal.subGoals && goal.subGoals.length > 0
          ? goal.subGoals
          : Array.from({ length: 5 }, (_, i) => ({
              title: `Sub-goal ${i + 1}`,
              description: "",
              dueDate: null as string | null,
              expectedOutcome: null as string | null,
              successCriteria: null as string | null,
              sortOrder: i,
            }))
      ).map((sub, subIndex) => ({
        title: sub.title?.trim() || `Sub-goal ${subIndex + 1}`,
        description: ("description" in sub ? sub.description?.trim() : "") || "",
        dueDate: parseDueDate("dueDate" in sub ? sub.dueDate : null),
        expectedOutcome: ("expectedOutcome" in sub ? sub.expectedOutcome : null) ?? null,
        successCriteria: ("successCriteria" in sub ? sub.successCriteria : null) ?? null,
        sortOrder: sub.sortOrder ?? subIndex,
        status:
          "status" in sub && sub.status
            ? (sub.status as "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED")
            : "NOT_STARTED",
        evidenceCount:
          "evidenceCount" in sub && typeof sub.evidenceCount === "number" ? sub.evidenceCount : 0,
        comment: "comment" in sub ? (sub.comment ?? null) : null,
      })),
    },
  }));
}

async function replaceGoals(
  tx: Prisma.TransactionClient,
  pdpId: string,
  versionId: string,
  goals: PdpGoalInput[]
) {
  await tx.pdpGoal.deleteMany({ where: { versionId } });
  for (const data of goalCreateData(pdpId, versionId, goals)) {
    await tx.pdpGoal.create({ data });
  }
}

async function notify(params: {
  recipientId: string;
  type: NotificationType;
  title: string;
  message: string;
  subjectEmployeeId: string;
  pdpId: string;
}) {
  await createNotification({
    type: params.type,
    title: params.title,
    message: params.message,
    recipientId: params.recipientId,
    subjectEmployeeId: params.subjectEmployeeId,
    metadata: { pdpId: params.pdpId },
  });
}

function permissions(actor: Actor, pdp: PdpRecord) {
  const version = currentVersion(pdp);
  const empApproval = approvalFor(version, PdpReviewerRole.EMPLOYEE);
  const hrApproval = approvalFor(version, PdpReviewerRole.HR);
  const isSupervisor = Boolean(pdp.supervisorId && actor.id === pdp.supervisorId);
  const isEmployee = actor.id === pdp.employeeId;
  const hrPerson = resolveHrForEmployee(pdp.employee);
  const isAssignedHr =
    actor.role === Role.HR_MANAGER ||
    actor.role === Role.LEADERSHIP ||
    (actor.role === Role.HR && (hrPerson?.id === actor.id || actor.id === hrApproval?.reviewerId));

  const openChangeRequest = pdp.changeRequests.find(
    (cr) =>
      cr.status === PdpChangeRequestStatus.OPEN ||
      cr.status === PdpChangeRequestStatus.SUPERVISOR_CANNOT_CHANGE
  );

  const bothApproved =
    empApproval?.status === PdpApprovalStatus.APPROVED &&
    hrApproval?.status === PdpApprovalStatus.APPROVED;

  const canEdit =
    isSupervisor &&
    (EDITABLE_STATUSES.includes(pdp.status) || CHANGES_REQUESTED_STATUSES.includes(pdp.status));

  const canSend =
    isSupervisor &&
    SENDABLE_STATUSES.includes(pdp.status) &&
    Boolean(version) &&
    (version?.goals.length ?? 0) > 0;

  const employeeReviewStatuses: PdpStatus[] = [
    PdpStatus.PENDING_EMPLOYEE_REVIEW,
    PdpStatus.PENDING_EMPLOYEE_REREVIEW,
    PdpStatus.PENDING_HR_REVIEW,
    PdpStatus.PENDING_REAPPROVAL,
    PdpStatus.APPROVED,
  ];
  const hrReviewStatuses: PdpStatus[] = [
    PdpStatus.PENDING_HR_REVIEW,
    PdpStatus.PENDING_EMPLOYEE_REVIEW,
    PdpStatus.PENDING_REAPPROVAL,
    PdpStatus.APPROVED,
  ];

  const canApproveAsEmployee =
    isEmployee &&
    empApproval?.status === PdpApprovalStatus.PENDING &&
    employeeReviewStatuses.includes(pdp.status);

  const canApproveAsHr =
    isAssignedHr &&
    hrApproval?.status === PdpApprovalStatus.PENDING &&
    hrReviewStatuses.includes(pdp.status);

  const canAssign =
    isSupervisor &&
    bothApproved &&
    pdp.status !== PdpStatus.ACTIVE &&
    pdp.status !== PdpStatus.ASSIGNED &&
    pdp.status !== PdpStatus.COMPLETED;

  const canActivate =
    isEmployee &&
    pdp.status === PdpStatus.ASSIGNED;

  const canEscalate =
    isSupervisor &&
    Boolean(openChangeRequest && openChangeRequest.status === PdpChangeRequestStatus.OPEN) &&
    CHANGES_REQUESTED_STATUSES.includes(pdp.status);

  const canDecideAsHr =
    isAssignedHr &&
    (pdp.status === PdpStatus.AWAITING_HR_DECISION ||
      pdp.status === PdpStatus.PENDING_HR_INTERVENTION) &&
    Boolean(
      openChangeRequest &&
        openChangeRequest.status === PdpChangeRequestStatus.SUPERVISOR_CANNOT_CHANGE
    );

  const isActiveOrAssigned =
    pdp.status === PdpStatus.ACTIVE || pdp.status === PdpStatus.ASSIGNED;

  // Supervisor-only evaluation. HR, HR Manager, and Leadership stay view-only here.
  const canReviewSubGoals = actor.role === Role.SUPERVISOR && isSupervisor;
  const canAddActiveGoals = isActiveOrAssigned && canReviewSubGoals;
  const canUpdateSubGoals =
    isActiveOrAssigned && isEmployee && actor.role === Role.EMPLOYEE;
  const isHrViewOnly = actor.role === Role.HR || actor.role === Role.HR_MANAGER;

  return {
    canEdit,
    canSend,
    canSendForApproval: canSend,
    canApproveAsEmployee,
    canRequestChangesAsEmployee: canApproveAsEmployee,
    canApproveAsHr,
    canRequestChangesAsHr: canApproveAsHr,
    canAssign,
    canActivate,
    canEscalate,
    canDecideAsHr,
    canCreateVersion: canEdit,
    canReviewSubGoals,
    canAddActiveGoals,
    canUpdateSubGoals,
    isHrViewOnly,
  };
}

function serializeEvidenceFiles(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({
      fileName: String(item.fileName ?? item.name ?? "evidence"),
      storedName: String(item.storedName ?? item.filename ?? ""),
      mimeType: item.mimeType ? String(item.mimeType) : null,
      size: typeof item.size === "number" ? item.size : null,
      uploadedAt: item.uploadedAt ? String(item.uploadedAt) : null,
    }))
    .filter((item) => item.storedName || item.fileName);
}

function serializeGoal(goal: VersionRecord["goals"][number]) {
  return {
    id: goal.id,
    title: goal.title,
    objective: goal.objective,
    expectedOutcome: goal.expectedOutcome,
    dueDate: goal.dueDate?.toISOString() ?? null,
    successCriteria: goal.successCriteria,
    category: goal.category,
    developmentArea: goal.developmentArea,
    notes: goal.notes,
    sortOrder: goal.sortOrder,
    priority: goal.priority,
    measurementKpi: goal.measurementKpi,
    weightage: goal.weightage,
    progress: goal.progress,
    status: goal.status,
    subGoals: (goal.subGoals ?? []).map((sub) => {
      const evidenceFiles = serializeEvidenceFiles(
        "evidenceFiles" in sub ? (sub as { evidenceFiles?: unknown }).evidenceFiles : null
      );
      return {
        id: sub.id,
        title: sub.title,
        description: sub.description,
        dueDate: sub.dueDate?.toISOString() ?? null,
        expectedOutcome: sub.expectedOutcome,
        successCriteria: sub.successCriteria,
        sortOrder: sub.sortOrder,
        status: "status" in sub && sub.status ? sub.status : "NOT_STARTED",
        submittedStatus:
          "submittedStatus" in sub && (sub as { submittedStatus?: PdpSubGoalStatus | null }).submittedStatus
            ? (sub as { submittedStatus: PdpSubGoalStatus }).submittedStatus
            : null,
        evidenceCount:
          "evidenceCount" in sub && typeof sub.evidenceCount === "number"
            ? sub.evidenceCount
            : evidenceFiles.length,
        comment: "comment" in sub ? (sub.comment ?? null) : null,
        completedAt:
          "completedAt" in sub && sub.completedAt
            ? (sub.completedAt as Date).toISOString()
            : null,
        approvedAt:
          "approvedAt" in sub && sub.approvedAt
            ? (sub.approvedAt as Date).toISOString()
            : null,
        reviewedAt:
          "reviewedAt" in sub && (sub as { reviewedAt?: Date | null }).reviewedAt
            ? ((sub as { reviewedAt: Date }).reviewedAt).toISOString()
            : null,
        reviewedBy:
          "reviewedBy" in sub && (sub as { reviewedBy?: unknown }).reviewedBy
            ? (sub as { reviewedBy: unknown }).reviewedBy
            : null,
        supervisorComment:
          "supervisorComment" in sub
            ? ((sub as { supervisorComment?: string | null }).supervisorComment ?? null)
            : null,
        evidenceFiles,
      };
    }),
  };
}

function serializeVersion(version: VersionRecord) {
  return {
    id: version.id,
    versionNumber: version.versionNumber,
    title: version.title,
    summary: version.summary,
    revisionReason: version.revisionReason,
    isCurrent: version.isCurrent,
    createdAt: version.createdAt.toISOString(),
    createdBy: version.createdBy,
    goals: version.goals.map(serializeGoal),
    approvals: version.approvals.map((approval) => ({
      id: approval.id,
      reviewerRole: approval.reviewerRole,
      status: approval.status,
      comment: approval.comment,
      respondedAt: approval.respondedAt?.toISOString() ?? null,
      reviewer: approval.reviewer,
    })),
  };
}

function serializePdp(pdp: PdpRecord, actor: Actor) {
  const version = currentVersion(pdp);
  const hr = resolveHrForEmployee(pdp.employee);
  const employeeApproval = version
    ? version.approvals.find((a) => a.reviewerRole === PdpReviewerRole.EMPLOYEE) ?? null
    : null;
  const hrApproval = version
    ? version.approvals.find((a) => a.reviewerRole === PdpReviewerRole.HR) ?? null
    : null;

  const serializedVersion = version ? serializeVersion(version) : null;
  const scoring = computePdpScoring(
    (serializedVersion?.goals ?? []).map((goal) => ({
      id: goal.id,
      subGoals: goal.subGoals.map((sub) => ({ id: sub.id, status: String(sub.status) })),
    }))
  );

  if (serializedVersion) {
    serializedVersion.goals = serializedVersion.goals.map((goal) => {
      const goalScore = scoring.goals.find((item) => item.id === goal.id);
      return {
        ...goal,
        scoreWeight: goalScore?.weight ?? 0,
        scoreEarned: goalScore?.earned ?? 0,
        approvedSubGoalCount: goalScore?.approvedCount ?? 0,
        progressPercent: goalScore?.progressPercent ?? goal.progress,
        subGoals: goal.subGoals.map((sub) => {
          const subScore = goalScore?.subGoals.find((item) => item.id === sub.id);
          return {
            ...sub,
            scoreWeight: subScore?.weight ?? 0,
            scoreEarned: subScore?.earned ?? 0,
          };
        }),
      };
    });
  }

  return {
    id: pdp.id,
    title: pdp.title,
    summary: pdp.summary,
    status: pdp.status,
    currentVersionNumber: pdp.currentVersionNumber,
    assignedAt: pdp.assignedAt?.toISOString() ?? null,
    activatedAt: pdp.activatedAt?.toISOString() ?? null,
    approvedAt: pdp.approvedAt?.toISOString() ?? null,
    createdAt: pdp.createdAt.toISOString(),
    updatedAt: pdp.updatedAt.toISOString(),
    employee: {
      id: pdp.employee.id,
      employeeId: pdp.employee.employeeId,
      name: pdp.employee.name,
      jobTitle: pdp.employee.jobTitle,
      companyEmail: pdp.employee.companyEmail,
      role: pdp.employee.role,
      department: pdp.employee.department,
    },
    supervisor: pdp.supervisor,
    hr,
    cycle: {
      id: pdp.cycle.id,
      name: pdp.cycle.name,
      status: pdp.cycle.status,
      startDate: pdp.cycle.startDate?.toISOString?.() ?? pdp.cycle.startDate,
      endDate: pdp.cycle.endDate?.toISOString?.() ?? pdp.cycle.endDate,
    },
    scoring: {
      totalWeight: scoring.totalWeight,
      earnedPoints: scoring.earnedPoints,
      progressPercent: scoring.progressPercent,
      mainGoalCount: scoring.mainGoalCount,
    },
    createdBy: pdp.createdBy,
    approvedBy: pdp.approvedBy,
    currentVersion: serializedVersion,
    versions: pdp.versions.map((item) => ({
      id: item.id,
      versionNumber: item.versionNumber,
      title: item.title,
      summary: item.summary,
      revisionReason: item.revisionReason,
      isCurrent: item.isCurrent,
      createdAt: item.createdAt.toISOString(),
      createdBy: item.createdBy,
    })),
    employeeApproval: employeeApproval
      ? {
          id: employeeApproval.id,
          reviewerRole: employeeApproval.reviewerRole,
          status: employeeApproval.status,
          comment: employeeApproval.comment,
          respondedAt: employeeApproval.respondedAt?.toISOString() ?? null,
          reviewer: employeeApproval.reviewer,
        }
      : null,
    hrApproval: hrApproval
      ? {
          id: hrApproval.id,
          reviewerRole: hrApproval.reviewerRole,
          status: hrApproval.status,
          comment: hrApproval.comment,
          respondedAt: hrApproval.respondedAt?.toISOString() ?? null,
          reviewer: hrApproval.reviewer,
        }
      : null,
    changeRequests: pdp.changeRequests.map((cr) => ({
      id: cr.id,
      versionId: cr.versionId,
      requesterRole: cr.requesterRole,
      message: cr.message,
      status: cr.status,
      supervisorResponse: cr.supervisorResponse,
      supervisorAction: cr.supervisorAction,
      supervisorRespondedAt: cr.supervisorRespondedAt?.toISOString() ?? null,
      hrDecision: cr.hrDecision,
      hrDecisionNote: cr.hrDecisionNote,
      hrDecidedAt: cr.hrDecidedAt?.toISOString() ?? null,
      createdAt: cr.createdAt.toISOString(),
      requestedBy: cr.requestedBy,
      supervisor: cr.supervisor,
      hrDecider: cr.hrDecider,
    })),
    activities: pdp.activities.map((activity) => ({
      id: activity.id,
      action: activity.action,
      message: activity.message,
      metadata: activity.metadata,
      createdAt: activity.createdAt.toISOString(),
      actor: activity.actor,
      versionId: activity.versionId,
    })),
    permissions: permissions(actor, pdp),
  };
}

async function scopedEmployeeWhere(actor: Actor, query: PdpListQuery) {
  const where: Prisma.EmployeeWhereInput = { role: Role.EMPLOYEE, deactivatedAt: null };
  if (actor.role === Role.SUPERVISOR) {
    where.id = { in: [...(await supervisedEmployeeIds(actor.id))] };
  } else if (actor.role === Role.HR && query.organisation !== "true") {
    where.id = { in: [...(await hrScopeEmployeeIds(actor.id))] };
  } else if (actor.role === Role.EMPLOYEE) {
    where.id = actor.id;
  }
  if (query.departmentId) where.departmentId = query.departmentId;

  const teamFilter: Prisma.TeamWhereInput = {};
  if (query.supervisorId) teamFilter.supervisorId = query.supervisorId;
  if (query.hrEmployeeId) teamFilter.hrAssignments = { some: { hrEmployeeId: query.hrEmployeeId } };
  if (Object.keys(teamFilter).length > 0) where.team = teamFilter;

  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: "insensitive" } },
      { employeeId: { contains: query.search, mode: "insensitive" } },
      { companyEmail: { contains: query.search, mode: "insensitive" } },
    ];
  }
  return where;
}

function isChangesRequestedStatus(status: PdpStatus) {
  return CHANGES_REQUESTED_STATUSES.includes(status);
}

export async function listPdps(actor: Actor, query: PdpListQuery) {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 12;
  const cycle = await resolveActiveCycle(query.cycleId);
  const employeeWhere = await scopedEmployeeWhere(actor, query);

  const employees = await prisma.employee.findMany({
    where: employeeWhere,
    include: {
      department: { select: { id: true, name: true } },
      team: {
        select: {
          id: true,
          name: true,
          supervisor: { select: personSelect },
          hrAssignments: { include: { hrEmployee: { select: personSelect } } },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const pdps = await prisma.personalDevelopmentPlan.findMany({
    where: {
      cycleId: cycle.id,
      employeeId: { in: employees.map((e) => e.id) },
    },
    include: pdpInclude,
    orderBy: { updatedAt: "desc" },
  });

  const pdpByEmployee = new Map(pdps.map((pdp) => [pdp.employeeId, pdp]));

  const rows = employees.map((employee) => {
    const pdp = pdpByEmployee.get(employee.id) ?? null;
    const serialized = pdp ? serializePdp(pdp, actor) : null;
    const allSubs =
      serialized?.currentVersion?.goals.flatMap((goal) => goal.subGoals ?? []) ?? [];
    const pendingReviews = allSubs.filter((sub) => sub.status === "PENDING_APPROVAL").length;
    const completedSubGoals = allSubs.filter((sub) => sub.status === "COMPLETED").length;
    return {
      id: serialized?.id ?? null,
      employee: {
        id: employee.id,
        employeeId: employee.employeeId,
        name: employee.name,
        jobTitle: employee.jobTitle,
        department: employee.department,
        team: employee.team ? { id: employee.team.id, name: employee.team.name } : null,
        supervisor: employee.team?.supervisor ?? null,
        hr: employee.team?.hrAssignments[0]?.hrEmployee ?? null,
      },
      pdp: serialized
        ? {
            id: serialized.id,
            title: serialized.title,
            status: serialized.status,
            updatedAt: serialized.updatedAt,
            currentVersionNumber: serialized.currentVersionNumber,
            employeeApprovalStatus: serialized.employeeApproval?.status ?? null,
            hrApprovalStatus: serialized.hrApproval?.status ?? null,
            overallProgress: serialized.scoring?.progressPercent ?? 0,
            earnedPoints: serialized.scoring?.earnedPoints ?? 0,
            pendingReviews,
            completedSubGoals,
            totalSubGoals: allSubs.length,
          }
        : null,
      status: pdp?.status ?? "NOT_STARTED",
    };
  });

  const filtered = (() => {
    const category = query.category || query.status;
    if (!category || category === "ALL") return rows;
    if (category === "CHANGES_REQUESTED" || category === "REVISIONS") {
      return rows.filter((row) => (row.pdp ? isChangesRequestedStatus(row.pdp.status as PdpStatus) : false));
    }
    if (category === "WAITING_HR" || category === "PENDING_HR_REVIEW") {
      return rows.filter(
        (row) =>
          row.pdp?.hrApprovalStatus === PdpApprovalStatus.PENDING ||
          row.status === PdpStatus.PENDING_HR_REVIEW ||
          row.status === PdpStatus.PENDING_REAPPROVAL
      );
    }
    if (category === "WAITING_EMPLOYEE" || category === "PENDING_EMPLOYEE_REVIEW") {
      return rows.filter(
        (row) =>
          row.pdp?.employeeApprovalStatus === PdpApprovalStatus.PENDING ||
          row.status === PdpStatus.PENDING_EMPLOYEE_REVIEW ||
          row.status === PdpStatus.PENDING_EMPLOYEE_REREVIEW
      );
    }
    if (category === "APPROVED") {
      return rows.filter(
        (row) =>
          row.status === PdpStatus.APPROVED ||
          row.status === PdpStatus.ASSIGNED
      );
    }
    if (category === "COMPLETED" || category === "ACTIVE") {
      return rows.filter(
        (row) => row.status === PdpStatus.ACTIVE || row.status === PdpStatus.COMPLETED
      );
    }
    if (category === "DRAFT") {
      return rows.filter((row) => row.status === PdpStatus.DRAFT);
    }
    if (category === "ASSIGNED") {
      return rows.filter((row) => row.status === PdpStatus.ASSIGNED);
    }
    return rows.filter((row) => row.status === category);
  })();

  const withPdp = rows.filter((row) => row.pdp);
  const kpis = {
    totalPdps: withPdp.length,
    draft: withPdp.filter((row) => row.status === PdpStatus.DRAFT).length,
    pendingHrApproval: withPdp.filter((row) => {
      return (
        row.pdp?.hrApprovalStatus === PdpApprovalStatus.PENDING ||
        row.status === PdpStatus.PENDING_HR_REVIEW ||
        row.status === PdpStatus.PENDING_REAPPROVAL
      );
    }).length,
    awaitingEmployeeApproval: withPdp.filter((row) => {
      return (
        row.pdp?.employeeApprovalStatus === PdpApprovalStatus.PENDING ||
        row.status === PdpStatus.PENDING_EMPLOYEE_REVIEW ||
        row.status === PdpStatus.PENDING_EMPLOYEE_REREVIEW
      );
    }).length,
    changeRequests: withPdp.filter((row) => isChangesRequestedStatus(row.status as PdpStatus))
      .length,
    approvedAndAssigned: withPdp.filter(
      (row) =>
        row.status === PdpStatus.APPROVED ||
        row.status === PdpStatus.ASSIGNED ||
        row.status === PdpStatus.ACTIVE
    ).length,
  };

  const start = (page - 1) * pageSize;
  return {
    cycle: { id: cycle.id, name: cycle.name, status: cycle.status },
    kpis,
    items: filtered.slice(start, start + pageSize),
    pagination: {
      page,
      pageSize,
      total: filtered.length,
      totalPages: Math.max(1, Math.ceil(filtered.length / pageSize)),
    },
  };
}

export async function listMyPdps(actor: Actor) {
  const cycle = await resolveActiveCycle();
  const pdp = await prisma.personalDevelopmentPlan.findFirst({
    where: { employeeId: actor.id, cycleId: cycle.id },
    include: pdpInclude,
    orderBy: { updatedAt: "desc" },
  });
  return {
    cycle: { id: cycle.id, name: cycle.name, status: cycle.status },
    pdp: pdp ? serializePdp(pdp, actor) : null,
  };
}

export async function getPdpOptions(actor: Actor) {
  if (actor.role !== Role.SUPERVISOR && actor.role !== Role.HR_MANAGER && actor.role !== Role.LEADERSHIP) {
    throw new AppError("Only supervisors can create PDPs", 403);
  }

  const cycle = await resolveActiveCycle();
  const employeeWhere = await scopedEmployeeWhere(actor, {});
  const employees = await prisma.employee.findMany({
    where: employeeWhere,
    include: {
      department: { select: { id: true, name: true } },
      team: {
        select: {
          supervisor: { select: personSelect },
          hrAssignments: { include: { hrEmployee: { select: personSelect } } },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const existing = await prisma.personalDevelopmentPlan.findMany({
    where: {
      cycleId: cycle.id,
      employeeId: { in: employees.map((e) => e.id) },
    },
    select: { employeeId: true, status: true },
  });
  const existingByEmployee = new Map(existing.map((p) => [p.employeeId, p.status]));

  return {
    cycle,
    employees: employees.map((employee) => ({
      id: employee.id,
      employeeId: employee.employeeId,
      name: employee.name,
      jobTitle: employee.jobTitle,
      department: employee.department,
      supervisor: employee.team?.supervisor ?? null,
      hr: employee.team?.hrAssignments[0]?.hrEmployee ?? null,
      hasPdp: existingByEmployee.has(employee.id),
      pdpStatus: existingByEmployee.get(employee.id) ?? null,
      eligible: !existingByEmployee.has(employee.id),
    })),
  };
}

export async function getPdp(actor: Actor, pdpId: string) {
  const pdp = await loadPdp(pdpId);
  await assertCanAccessPdp(actor, pdp);
  return { pdp: serializePdp(pdp, actor) };
}

export async function createPdp(actor: Actor, input: CreatePdpInput) {
  if (actor.role !== Role.SUPERVISOR) {
    throw new AppError("Only a supervisor can create a PDP", 403);
  }
  await assertCanAccessEmployee(actor, input.employeeId);

  const employee = await prisma.employee.findUnique({
    where: { id: input.employeeId },
    include: {
      team: {
        include: {
          supervisor: { select: { id: true } },
          hrAssignments: { include: { hrEmployee: { select: personSelect } } },
        },
      },
    },
  });
  if (!employee || employee.role !== Role.EMPLOYEE) {
    throw new AppError("Employee not found", 404);
  }

  const cycle = await resolveActiveCycle(input.cycleId);
  const existing = await prisma.personalDevelopmentPlan.findUnique({
    where: { cycleId_employeeId: { cycleId: cycle.id, employeeId: employee.id } },
  });
  if (existing) throw new AppError("A PDP already exists for this employee in the current cycle", 409);

  const batchId = await resolveBatchId(cycle.id, employee.id);
  const title = input.title?.trim() || "Professional Development Plan";
  const summary = input.summary?.trim() || null;

  const pdp = await prisma.$transaction(async (tx) => {
    const created = await tx.personalDevelopmentPlan.create({
      data: {
        employeeId: employee.id,
        supervisorId: actor.id,
        cycleId: cycle.id,
        batchId,
        title,
        summary,
        status: PdpStatus.DRAFT,
        createdById: actor.id,
        currentVersionNumber: 1,
        planningMeetingId: input.planningMeetingId ?? null,
      },
    });

    const version = await tx.pdpVersion.create({
      data: {
        pdpId: created.id,
        versionNumber: 1,
        title,
        summary,
        isCurrent: true,
        createdById: actor.id,
      },
    });

    const goalsInput =
      input.goals && input.goals.length > 0
        ? input.goals
        : Array.from({ length: 5 }, (_, index) => ({
            title: `Main Goal ${index + 1}`,
            objective: "",
            subGoals: Array.from({ length: 5 }, (_, subIndex) => ({
              title: `Sub-goal ${subIndex + 1}`,
              description: "",
              sortOrder: subIndex,
            })),
            sortOrder: index,
          }));

    await replaceGoals(tx, created.id, version.id, goalsInput);

    await tx.pdpActivity.create({
      data: {
        pdpId: created.id,
        versionId: version.id,
        actorId: actor.id,
        action: "CREATED",
        message: `Draft PDP created for ${employee.name}`,
      },
    });

    return created.id;
  });

  const loaded = await loadPdp(pdp); // pdp here is the created id returned by the transaction
  return serializePdp(loaded, actor);
}

export async function updatePdp(actor: Actor, pdpId: string, input: UpdatePdpInput) {
  if (actor.role !== Role.SUPERVISOR) {
    throw new AppError("Only a supervisor can edit PDP content", 403);
  }

  const pdp = await loadPdp(pdpId);
  await assertCanAccessPdp(actor, pdp);
  if (pdp.supervisorId !== actor.id) {
    throw new AppError("Only the assigned supervisor can edit this PDP", 403);
  }

  const editable =
    EDITABLE_STATUSES.includes(pdp.status) || CHANGES_REQUESTED_STATUSES.includes(pdp.status);
  if (!editable) {
    throw new AppError("PDP content can only be edited while in draft or revision", 400);
  }

  const version = currentVersion(pdp);
  if (!version) throw new AppError("Current PDP version not found", 400);

  const title = input.title?.trim() ?? pdp.title;
  const summary =
    input.summary === undefined ? pdp.summary : input.summary?.trim() || null;
  const nextStatus = CHANGES_REQUESTED_STATUSES.includes(pdp.status)
    ? PdpStatus.UNDER_SUPERVISOR_REVISION
    : pdp.status === PdpStatus.AWAITING_SUPERVISOR_ACTION
      ? PdpStatus.UNDER_SUPERVISOR_REVISION
      : pdp.status;

  await prisma.$transaction(async (tx) => {
    await tx.personalDevelopmentPlan.update({
      where: { id: pdp.id },
      data: { title, summary, status: nextStatus },
    });

    await tx.pdpVersion.update({
      where: { id: version.id },
      data: {
        title,
        summary,
        ...(input.revisionReason !== undefined
          ? { revisionReason: input.revisionReason?.trim() || null }
          : {}),
      },
    });

    if (input.goals) {
      await replaceGoals(tx, pdp.id, version.id, input.goals);
    }

    if (CHANGES_REQUESTED_STATUSES.includes(pdp.status) || input.changeRequestId) {
      const changeRequest = input.changeRequestId
        ? await tx.pdpChangeRequest.findFirst({
            where: { id: input.changeRequestId, pdpId: pdp.id },
          })
        : await tx.pdpChangeRequest.findFirst({
            where: {
              pdpId: pdp.id,
              status: PdpChangeRequestStatus.OPEN,
            },
            orderBy: { createdAt: "desc" },
          });

      if (changeRequest && changeRequest.status === PdpChangeRequestStatus.OPEN) {
        await tx.pdpChangeRequest.update({
          where: { id: changeRequest.id },
          data: {
            status: PdpChangeRequestStatus.SUPERVISOR_WILL_CHANGE,
            supervisorAction: PdpSupervisorChangeAction.WILL_CHANGE,
            supervisorId: actor.id,
            supervisorRespondedAt: new Date(),
            supervisorResponse: "Supervisor will revise the PDP",
          },
        });
      }
    }

    await tx.pdpActivity.create({
      data: {
        pdpId: pdp.id,
        versionId: version.id,
        actorId: actor.id,
        action: "UPDATED",
        message: "PDP draft content updated",
      },
    });
  });

  const loaded = await loadPdp(pdpId);
  return serializePdp(loaded, actor);
}

export async function sendForApproval(actor: Actor, pdpId: string) {
  if (actor.role !== Role.SUPERVISOR) {
    throw new AppError("Only a supervisor can send a PDP for approval", 403);
  }

  const pdp = await loadPdp(pdpId);
  await assertCanAccessPdp(actor, pdp);
  if (pdp.supervisorId !== actor.id) {
    throw new AppError("Only the assigned supervisor can send this PDP for approval", 403);
  }
  if (!SENDABLE_STATUSES.includes(pdp.status) && !CHANGES_REQUESTED_STATUSES.includes(pdp.status)) {
    throw new AppError("PDP cannot be sent for approval in its current status", 400);
  }

  const version = currentVersion(pdp);
  if (!version || version.goals.length === 0) {
    throw new AppError("Add at least one goal before sending for approval", 400);
  }

  const hr = resolveHrForEmployee(pdp.employee);
  if (!hr) throw new AppError("No HR representative is assigned to this employee's team", 400);

  const needsNewVersion =
    version.approvals.length > 0 ||
    pdp.status !== PdpStatus.DRAFT ||
    pdp.currentVersionNumber > 1;

  const resultId = await prisma.$transaction(async (tx) => {
    let targetVersionId = version.id;
    let versionNumber = version.versionNumber;

    if (needsNewVersion && version.approvals.length > 0) {
      await tx.pdpVersion.update({
        where: { id: version.id },
        data: { isCurrent: false },
      });
      versionNumber = pdp.currentVersionNumber + 1;
      const newVersion = await tx.pdpVersion.create({
        data: {
          pdpId: pdp.id,
          versionNumber,
          title: version.title,
          summary: version.summary,
          revisionReason: version.revisionReason,
          isCurrent: true,
          createdById: actor.id,
        },
      });
      targetVersionId = newVersion.id;

      const goals = await tx.pdpGoal.findMany({
        where: { versionId: version.id },
        include: { subGoals: { orderBy: { sortOrder: "asc" } } },
      });
      for (const goal of goals) {
        await tx.pdpGoal.create({
          data: {
            pdpId: pdp.id,
            versionId: newVersion.id,
            title: goal.title,
            objective: goal.objective,
            expectedOutcome: goal.expectedOutcome,
            dueDate: goal.dueDate,
            successCriteria: goal.successCriteria,
            category: goal.category,
            developmentArea: goal.developmentArea,
            notes: goal.notes,
            sortOrder: goal.sortOrder,
            priority: goal.priority,
            measurementKpi: goal.measurementKpi,
            weightage: goal.weightage,
            subGoals: {
              create: goal.subGoals.map((sub) => ({
                title: sub.title,
                description: sub.description,
                dueDate: sub.dueDate,
                expectedOutcome: sub.expectedOutcome,
                successCriteria: sub.successCriteria,
                sortOrder: sub.sortOrder,
                status:
                  "status" in sub && sub.status
                    ? (sub.status as "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED")
                    : "NOT_STARTED",
                evidenceCount:
                  "evidenceCount" in sub && typeof sub.evidenceCount === "number"
                    ? sub.evidenceCount
                    : 0,
                comment: "comment" in sub ? (sub.comment ?? null) : null,
              })),
            },
          },
        });
      }

      await tx.personalDevelopmentPlan.update({
        where: { id: pdp.id },
        data: { currentVersionNumber: versionNumber },
      });
    }

    await tx.pdpVersionApproval.deleteMany({ where: { versionId: targetVersionId } });
    await tx.pdpVersionApproval.createMany({
      data: [
        {
          versionId: targetVersionId,
          reviewerId: pdp.employeeId,
          reviewerRole: PdpReviewerRole.EMPLOYEE,
          status: PdpApprovalStatus.PENDING,
        },
        {
          versionId: targetVersionId,
          reviewerId: hr.id,
          reviewerRole: PdpReviewerRole.HR,
          status: PdpApprovalStatus.PENDING,
        },
      ],
    });

    await tx.pdpChangeRequest.updateMany({
      where: {
        pdpId: pdp.id,
        status: {
          in: [
            PdpChangeRequestStatus.OPEN,
            PdpChangeRequestStatus.SUPERVISOR_WILL_CHANGE,
            PdpChangeRequestStatus.HR_REQUIRES_CHANGE,
          ],
        },
      },
      data: { status: PdpChangeRequestStatus.RESOLVED },
    });

    await tx.personalDevelopmentPlan.update({
      where: { id: pdp.id },
      data: {
        status: PdpStatus.PENDING_EMPLOYEE_REVIEW,
        title: version.title,
        summary: version.summary,
      },
    });

    await tx.pdpActivity.create({
      data: {
        pdpId: pdp.id,
        versionId: targetVersionId,
        actorId: actor.id,
        action: "SENT_FOR_APPROVAL",
        message: `Version ${versionNumber} sent for employee and HR approval`,
        metadata: { versionNumber } as Prisma.InputJsonValue,
      },
    });

    return pdp.id;
  });

  await notify({
    recipientId: pdp.employeeId,
    type: NotificationType.PDP_SUBMITTED,
    title: "PDP ready for your review",
    message: `${pdp.supervisor?.name ?? "Your supervisor"} submitted a Professional Development Plan for your review.`,
    subjectEmployeeId: pdp.employeeId,
    pdpId: pdp.id,
  });
  await notify({
    recipientId: hr.id,
    type: NotificationType.PDP_SUBMITTED,
    title: "PDP ready for HR review",
    message: `A PDP for ${pdp.employee.name} is awaiting your review.`,
    subjectEmployeeId: pdp.employeeId,
    pdpId: pdp.id,
  });

  const loaded = await loadPdp(resultId);
  return serializePdp(loaded, actor);
}

async function respondAsReviewer(
  actor: Actor,
  pdpId: string,
  reviewerRole: PdpReviewerRole,
  decision: "APPROVE" | "REQUEST_CHANGES",
  reason?: string
) {
  const pdp = await loadPdp(pdpId);
  await assertCanAccessPdp(actor, pdp);

  const version = currentVersion(pdp);
  if (!version) throw new AppError("Current PDP version not found", 400);

  const approval = approvalFor(version, reviewerRole);
  if (!approval) throw new AppError("No pending approval found for this role", 400);
  if (approval.status !== PdpApprovalStatus.PENDING) {
    throw new AppError("This approval has already been responded to", 400);
  }

  if (reviewerRole === PdpReviewerRole.EMPLOYEE) {
    if (actor.id !== pdp.employeeId) {
      throw new AppError("Only the employee can respond to this approval", 403);
    }
  } else {
    const hr = resolveHrForEmployee(pdp.employee);
    const allowed =
      actor.role === Role.HR_MANAGER ||
      actor.role === Role.LEADERSHIP ||
      (actor.role === Role.HR && (approval.reviewerId === actor.id || hr?.id === actor.id));
    if (!allowed) throw new AppError("Only assigned HR can respond to this approval", 403);
  }

  if (decision === "REQUEST_CHANGES" && !reason?.trim()) {
    throw new AppError("A reason is required when requesting changes", 400);
  }

  await prisma.$transaction(async (tx) => {
    await tx.pdpVersionApproval.update({
      where: { id: approval.id },
      data: {
        status:
          decision === "APPROVE"
            ? PdpApprovalStatus.APPROVED
            : PdpApprovalStatus.CHANGES_REQUESTED,
        comment: reason?.trim() || null,
        respondedAt: new Date(),
        reviewerId: actor.id,
      },
    });

    if (decision === "REQUEST_CHANGES") {
      await tx.pdpChangeRequest.create({
        data: {
          pdpId: pdp.id,
          versionId: version.id,
          requestedById: actor.id,
          requesterRole: reviewerRole,
          message: reason!.trim(),
          status: PdpChangeRequestStatus.OPEN,
        },
      });

      const nextStatus =
        reviewerRole === PdpReviewerRole.EMPLOYEE
          ? PdpStatus.CHANGES_REQUESTED_BY_EMPLOYEE
          : PdpStatus.CHANGES_REQUESTED_BY_HR;

      await tx.personalDevelopmentPlan.update({
        where: { id: pdp.id },
        data: { status: nextStatus },
      });

      await tx.pdpActivity.create({
        data: {
          pdpId: pdp.id,
          versionId: version.id,
          actorId: actor.id,
          action: "CHANGES_REQUESTED",
          message:
            reviewerRole === PdpReviewerRole.EMPLOYEE
              ? "Employee requested changes"
              : "HR requested changes",
          metadata: { reason: reason!.trim() } as Prisma.InputJsonValue,
        },
      });
    } else {
      const otherRole =
        reviewerRole === PdpReviewerRole.EMPLOYEE
          ? PdpReviewerRole.HR
          : PdpReviewerRole.EMPLOYEE;
      const other = await tx.pdpVersionApproval.findUnique({
        where: {
          versionId_reviewerRole: { versionId: version.id, reviewerRole: otherRole },
        },
      });

      const nextStatus = deriveStatusFromApprovals(
        reviewerRole === PdpReviewerRole.EMPLOYEE
          ? PdpApprovalStatus.APPROVED
          : other?.status,
        reviewerRole === PdpReviewerRole.HR
          ? PdpApprovalStatus.APPROVED
          : other?.status
      );

      await tx.personalDevelopmentPlan.update({
        where: { id: pdp.id },
        data: {
          status: nextStatus,
          ...(reviewerRole === PdpReviewerRole.EMPLOYEE
            ? { employeeAgreedAt: new Date() }
            : { hrReviewedAt: new Date() }),
          ...(nextStatus === PdpStatus.APPROVED
            ? { approvedAt: new Date(), approvedById: actor.id }
            : {}),
        },
      });

      await tx.pdpActivity.create({
        data: {
          pdpId: pdp.id,
          versionId: version.id,
          actorId: actor.id,
          action: "APPROVED",
          message:
            reviewerRole === PdpReviewerRole.EMPLOYEE
              ? "Employee approved the PDP"
              : "HR approved the PDP",
        },
      });
    }
  });

  if (decision === "REQUEST_CHANGES" && pdp.supervisorId) {
    await notify({
      recipientId: pdp.supervisorId,
      type: NotificationType.PDP_CHANGES_REQUESTED,
      title: "PDP changes requested",
      message: `${actor.role === Role.EMPLOYEE ? pdp.employee.name : "HR"} requested changes on ${pdp.employee.name}'s PDP.`,
      subjectEmployeeId: pdp.employeeId,
      pdpId: pdp.id,
    });
  } else if (decision === "APPROVE") {
    if (reviewerRole === PdpReviewerRole.EMPLOYEE && pdp.supervisorId) {
      await notify({
        recipientId: pdp.supervisorId,
        type: NotificationType.PDP_EMPLOYEE_RESPONSE,
        title: "Employee approved PDP",
        message: `${pdp.employee.name} approved their Professional Development Plan.`,
        subjectEmployeeId: pdp.employeeId,
        pdpId: pdp.id,
      });
    }
    if (reviewerRole === PdpReviewerRole.HR && pdp.supervisorId) {
      await notify({
        recipientId: pdp.supervisorId,
        type: NotificationType.PDP_HR_FEEDBACK,
        title: "HR approved PDP",
        message: `HR approved the PDP for ${pdp.employee.name}.`,
        subjectEmployeeId: pdp.employeeId,
        pdpId: pdp.id,
      });
    }
  }

  const loaded = await loadPdp(pdpId);
  return serializePdp(loaded, actor);
}

export async function employeeApprove(actor: Actor, pdpId: string) {
  return respondAsReviewer(actor, pdpId, PdpReviewerRole.EMPLOYEE, "APPROVE");
}

export async function employeeRequestChanges(
  actor: Actor,
  pdpId: string,
  input: RequestChangesInput
) {
  return respondAsReviewer(
    actor,
    pdpId,
    PdpReviewerRole.EMPLOYEE,
    "REQUEST_CHANGES",
    input.reason
  );
}

export async function hrApprove(actor: Actor, pdpId: string) {
  return respondAsReviewer(actor, pdpId, PdpReviewerRole.HR, "APPROVE");
}

export async function hrRequestChanges(actor: Actor, pdpId: string, input: RequestChangesInput) {
  return respondAsReviewer(actor, pdpId, PdpReviewerRole.HR, "REQUEST_CHANGES", input.reason);
}

export async function supervisorCannotChange(
  actor: Actor,
  pdpId: string,
  input: SupervisorCannotChangeInput
) {
  if (actor.role !== Role.SUPERVISOR) {
    throw new AppError("Only a supervisor can escalate a change request", 403);
  }

  const pdp = await loadPdp(pdpId);
  await assertCanAccessPdp(actor, pdp);
  if (pdp.supervisorId !== actor.id) {
    throw new AppError("Only the assigned supervisor can escalate this PDP", 403);
  }

  const changeRequest = pdp.changeRequests.find((cr) => cr.id === input.changeRequestId);
  if (!changeRequest) throw new AppError("Change request not found", 404);
  if (changeRequest.status !== PdpChangeRequestStatus.OPEN) {
    throw new AppError("Only an open change request can be escalated", 400);
  }

  const hr = resolveHrForEmployee(pdp.employee);
  if (!hr) throw new AppError("No HR representative is assigned to this employee's team", 400);

  await prisma.$transaction(async (tx) => {
    await tx.pdpChangeRequest.update({
      where: { id: changeRequest.id },
      data: {
        status: PdpChangeRequestStatus.SUPERVISOR_CANNOT_CHANGE,
        supervisorAction: PdpSupervisorChangeAction.CANNOT_CHANGE,
        supervisorResponse: input.reason.trim(),
        supervisorId: actor.id,
        supervisorRespondedAt: new Date(),
      },
    });

    await tx.personalDevelopmentPlan.update({
      where: { id: pdp.id },
      data: { status: PdpStatus.AWAITING_HR_DECISION },
    });

    await tx.pdpActivity.create({
      data: {
        pdpId: pdp.id,
        versionId: changeRequest.versionId,
        actorId: actor.id,
        action: "ESCALATED_TO_HR",
        message: "Supervisor cannot make the requested change and escalated to HR",
        metadata: { reason: input.reason.trim() } as Prisma.InputJsonValue,
      },
    });
  });

  await notify({
    recipientId: hr.id,
    type: NotificationType.PDP_INTERVENTION_REQUIRED,
    title: "PDP intervention required",
    message: `Supervisor cannot apply requested changes on ${pdp.employee.name}'s PDP. Your decision is required.`,
    subjectEmployeeId: pdp.employeeId,
    pdpId: pdp.id,
  });

  const loaded = await loadPdp(pdpId);
  return serializePdp(loaded, actor);
}

export async function hrDecision(actor: Actor, pdpId: string, input: HrDecisionInput) {
  if (actor.role !== Role.HR && actor.role !== Role.HR_MANAGER && actor.role !== Role.LEADERSHIP) {
    throw new AppError("Only HR can decide on an escalated change request", 403);
  }

  const pdp = await loadPdp(pdpId);
  await assertCanAccessPdp(actor, pdp);

  if (
    pdp.status !== PdpStatus.AWAITING_HR_DECISION &&
    pdp.status !== PdpStatus.PENDING_HR_INTERVENTION
  ) {
    throw new AppError("PDP is not awaiting an HR decision", 400);
  }

  const changeRequest = pdp.changeRequests.find((cr) => cr.id === input.changeRequestId);
  if (!changeRequest) throw new AppError("Change request not found", 404);
  if (changeRequest.status !== PdpChangeRequestStatus.SUPERVISOR_CANNOT_CHANGE) {
    throw new AppError("Change request is not awaiting an HR decision", 400);
  }

  const decision =
    input.decision === "CHANGE_MUST_HAPPEN"
      ? PdpHrChangeDecision.CHANGE_MUST_HAPPEN
      : PdpHrChangeDecision.CHANGE_NOT_REQUIRED;

  await prisma.$transaction(async (tx) => {
    await tx.pdpChangeRequest.update({
      where: { id: changeRequest.id },
      data: {
        hrDecision: decision,
        hrDecisionNote: input.note?.trim() || null,
        hrDecidedAt: new Date(),
        hrDeciderId: actor.id,
        status:
          decision === PdpHrChangeDecision.CHANGE_MUST_HAPPEN
            ? PdpChangeRequestStatus.HR_REQUIRES_CHANGE
            : PdpChangeRequestStatus.HR_CHANGE_NOT_REQUIRED,
      },
    });

    if (decision === PdpHrChangeDecision.CHANGE_MUST_HAPPEN) {
      await tx.personalDevelopmentPlan.update({
        where: { id: pdp.id },
        data: { status: PdpStatus.AWAITING_SUPERVISOR_ACTION },
      });
    } else {
      const version = currentVersion(pdp);
      if (version) {
        const requesterApproval = await tx.pdpVersionApproval.findUnique({
          where: {
            versionId_reviewerRole: {
              versionId: version.id,
              reviewerRole: changeRequest.requesterRole,
            },
          },
        });
        if (requesterApproval) {
          await tx.pdpVersionApproval.update({
            where: { id: requesterApproval.id },
            data: {
              status: PdpApprovalStatus.PENDING,
              comment: null,
              respondedAt: null,
            },
          });
        }

        const otherRole =
          changeRequest.requesterRole === PdpReviewerRole.EMPLOYEE
            ? PdpReviewerRole.HR
            : PdpReviewerRole.EMPLOYEE;
        const other = await tx.pdpVersionApproval.findUnique({
          where: {
            versionId_reviewerRole: {
              versionId: version.id,
              reviewerRole: otherRole,
            },
          },
        });

        const nextStatus = deriveStatusFromApprovals(
          changeRequest.requesterRole === PdpReviewerRole.EMPLOYEE
            ? PdpApprovalStatus.PENDING
            : other?.status,
          changeRequest.requesterRole === PdpReviewerRole.HR
            ? PdpApprovalStatus.PENDING
            : other?.status
        );

        await tx.personalDevelopmentPlan.update({
          where: { id: pdp.id },
          data: { status: nextStatus },
        });
      }

      await tx.pdpChangeRequest.update({
        where: { id: changeRequest.id },
        data: { status: PdpChangeRequestStatus.RESOLVED },
      });
    }

    await tx.pdpActivity.create({
      data: {
        pdpId: pdp.id,
        versionId: changeRequest.versionId,
        actorId: actor.id,
        action: "HR_DECISION",
        message:
          decision === PdpHrChangeDecision.CHANGE_MUST_HAPPEN
            ? "HR decided the requested change must happen"
            : "HR decided the requested change is not required",
        metadata: {
          decision: input.decision,
          note: input.note?.trim() || null,
        } as Prisma.InputJsonValue,
      },
    });
  });

  if (pdp.supervisorId) {
    await notify({
      recipientId: pdp.supervisorId,
      type: NotificationType.PDP_HR_FEEDBACK,
      title: "HR decision on PDP change request",
      message:
        decision === PdpHrChangeDecision.CHANGE_MUST_HAPPEN
          ? `HR requires changes on ${pdp.employee.name}'s PDP.`
          : `HR decided changes are not required on ${pdp.employee.name}'s PDP.`,
      subjectEmployeeId: pdp.employeeId,
      pdpId: pdp.id,
    });
  }

  if (decision === PdpHrChangeDecision.CHANGE_NOT_REQUIRED) {
    await notify({
      recipientId: pdp.employeeId,
      type: NotificationType.PDP_HR_FEEDBACK,
      title: "HR decision on your PDP",
      message:
        "HR reviewed the escalated change request and decided no change is required. Please review and approve the current PDP.",
      subjectEmployeeId: pdp.employeeId,
      pdpId: pdp.id,
    });
  }

  const loaded = await loadPdp(pdpId);
  return serializePdp(loaded, actor);
}

export async function assignPdp(actor: Actor, pdpId: string) {
  if (actor.role !== Role.SUPERVISOR) {
    throw new AppError("Only a supervisor can assign a PDP", 403);
  }

  const pdp = await loadPdp(pdpId);
  await assertCanAccessPdp(actor, pdp);
  if (pdp.supervisorId !== actor.id) {
    throw new AppError("Only the assigned supervisor can assign this PDP", 403);
  }

  const version = currentVersion(pdp);
  if (!version) throw new AppError("Current PDP version not found", 400);

  const empApproval = approvalFor(version, PdpReviewerRole.EMPLOYEE);
  const hrApproval = approvalFor(version, PdpReviewerRole.HR);
  if (
    empApproval?.status !== PdpApprovalStatus.APPROVED ||
    hrApproval?.status !== PdpApprovalStatus.APPROVED
  ) {
    throw new AppError("Both employee and HR must approve the current version before assignment", 400);
  }

  if (pdp.status === PdpStatus.ACTIVE || pdp.status === PdpStatus.ASSIGNED) {
    throw new AppError("PDP is already assigned", 400);
  }

  await prisma.$transaction(async (tx) => {
    await tx.personalDevelopmentPlan.update({
      where: { id: pdp.id },
      data: {
        status: PdpStatus.ASSIGNED,
        assignedAt: new Date(),
        approvedAt: pdp.approvedAt ?? new Date(),
        approvedById: pdp.approvedById ?? actor.id,
      },
    });

    await tx.pdpActivity.create({
      data: {
        pdpId: pdp.id,
        versionId: version.id,
        actorId: actor.id,
        action: "ASSIGNED",
        message: "PDP assigned to employee — awaiting employee activation",
      },
    });
  });

  await notify({
    recipientId: pdp.employeeId,
    type: NotificationType.PDP_APPROVED,
    title: "Your PDP has been assigned",
    message: `Your Professional Development Plan for ${pdp.cycle.name} has been assigned. Please review and activate it.`,
    subjectEmployeeId: pdp.employeeId,
    pdpId: pdp.id,
  });

  const loaded = await loadPdp(pdpId);
  return serializePdp(loaded, actor);
}

export async function activatePdp(actor: Actor, pdpId: string) {
  if (actor.role !== Role.EMPLOYEE) {
    throw new AppError("Only the employee can activate their PDP", 403);
  }

  const pdp = await loadPdp(pdpId);
  await assertCanAccessPdp(actor, pdp);
  if (pdp.employeeId !== actor.id) {
    throw new AppError("You can only activate your own PDP", 403);
  }
  if (pdp.status !== PdpStatus.ASSIGNED) {
    throw new AppError("Only an assigned PDP can be activated", 400);
  }

  const version = currentVersion(pdp);

  await prisma.$transaction(async (tx) => {
    await tx.personalDevelopmentPlan.update({
      where: { id: pdp.id },
      data: {
        status: PdpStatus.ACTIVE,
        activatedAt: new Date(),
        employeeAgreedAt: new Date(),
      },
    });

    await tx.pdpActivity.create({
      data: {
        pdpId: pdp.id,
        versionId: version?.id ?? null,
        actorId: actor.id,
        action: "ACTIVATED",
        message: "Employee activated the assigned PDP",
      },
    });
  });

  if (pdp.supervisorId) {
    await notify({
      recipientId: pdp.supervisorId,
      type: NotificationType.PDP_EMPLOYEE_RESPONSE,
      title: "PDP activated by employee",
      message: `${pdp.employee.name} activated their assigned Professional Development Plan.`,
      subjectEmployeeId: pdp.employeeId,
      pdpId: pdp.id,
    });
  }

  const loaded = await loadPdp(pdpId);
  return serializePdp(loaded, actor);
}

export async function listPdpVersions(actor: Actor, pdpId: string) {
  const pdp = await loadPdp(pdpId);
  await assertCanAccessPdp(actor, pdp);
  return {
    pdpId: pdp.id,
    versions: pdp.versions.map(serializeVersion),
  };
}

export async function getPdpVersion(actor: Actor, pdpId: string, versionNumber: number) {
  const pdp = await loadPdp(pdpId);
  await assertCanAccessPdp(actor, pdp);
  const version = pdp.versions.find((v) => v.versionNumber === versionNumber);
  if (!version) throw new AppError("PDP version not found", 404);
  return { pdpId: pdp.id, version: serializeVersion(version) };
}

type EvidenceFileMeta = {
  fileName: string;
  storedName: string;
  mimeType?: string | null;
  size?: number | null;
  uploadedAt?: string | null;
};

function parseEvidenceFiles(value: unknown): EvidenceFileMeta[] {
  return serializeEvidenceFiles(value) as EvidenceFileMeta[];
}

async function findSubGoalOrThrow(pdpId: string, subGoalId: string) {
  const subGoal = await prisma.pdpSubGoal.findUnique({
    where: { id: subGoalId },
    include: {
      goal: {
        include: {
          pdp: {
            include: pdpInclude,
          },
          subGoals: { orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });
  if (!subGoal || subGoal.goal.pdpId !== pdpId) {
    throw new AppError("Sub-goal not found on this PDP", 404);
  }
  return subGoal;
}

async function syncGoalProgressFromSubs(goalId: string) {
  const goal = await prisma.pdpGoal.findUnique({
    where: { id: goalId },
    include: { subGoals: true },
  });
  if (!goal) return;
  const scoring = computePdpScoring([
    {
      id: goal.id,
      subGoals: goal.subGoals.map((sub) => ({ id: sub.id, status: sub.status })),
    },
  ]);
  const goalScore = scoring.goals[0];
  const progress = goalScore?.progressPercent ?? 0;
  const status =
    progress >= 100
      ? PdpGoalStatus.COMPLETED
      : progress > 0
        ? PdpGoalStatus.IN_PROGRESS
        : PdpGoalStatus.NOT_STARTED;
  await prisma.pdpGoal.update({
    where: { id: goalId },
    data: { progress, status },
  });
}

function progressStatusLabel(status: PdpSubGoalStatus) {
  if (status === PdpSubGoalStatus.COMPLETED) return "Completed";
  if (status === PdpSubGoalStatus.IN_PROGRESS) return "In Progress";
  if (status === PdpSubGoalStatus.NOT_STARTED) return "Not Started";
  return "Completed";
}

function resolveRequestedProgress(input: {
  status?: string;
  markComplete?: boolean;
}): PdpSubGoalStatus {
  if (input.markComplete || input.status === "COMPLETED" || input.status === "PENDING_APPROVAL") {
    return PdpSubGoalStatus.COMPLETED;
  }
  if (input.status === "NOT_STARTED") return PdpSubGoalStatus.NOT_STARTED;
  return PdpSubGoalStatus.IN_PROGRESS;
}

function applyApprovedProgress(submitted: PdpSubGoalStatus | null): PdpSubGoalStatus {
  if (submitted === PdpSubGoalStatus.NOT_STARTED) return PdpSubGoalStatus.NOT_STARTED;
  if (submitted === PdpSubGoalStatus.IN_PROGRESS) return PdpSubGoalStatus.IN_PROGRESS;
  return PdpSubGoalStatus.COMPLETED;
}

/** Supervisor/HR: load active-cycle PDP for a team employee (follow-up meetings). */
export async function getPdpByEmployeeId(actor: Actor, employeeId: string) {
  if (actor.role === Role.EMPLOYEE && actor.id !== employeeId) {
    throw new AppError("You can only view your own PDP", 403);
  }
  await assertCanAccessEmployee(actor, employeeId);
  const cycle = await resolveActiveCycle();
  const pdp = await prisma.personalDevelopmentPlan.findFirst({
    where: { employeeId, cycleId: cycle.id },
    include: pdpInclude,
    orderBy: { updatedAt: "desc" },
  });
  if (!pdp) {
    return { cycle: { id: cycle.id, name: cycle.name, status: cycle.status }, pdp: null };
  }
  await assertCanAccessPdp(actor, pdp);
  return {
    cycle: { id: cycle.id, name: cycle.name, status: cycle.status },
    pdp: serializePdp(pdp, actor),
  };
}

export async function updateSubGoalProgress(
  actor: Actor,
  pdpId: string,
  subGoalId: string,
  input: {
    status?: "NOT_STARTED" | "IN_PROGRESS" | "PENDING_APPROVAL" | "COMPLETED" | "CHANGES_REQUESTED";
    comment?: string | null;
    markComplete?: boolean;
  },
  uploaded?: Express.Multer.File | null
) {
  const pdp = await loadPdp(pdpId);
  await assertCanAccessPdp(actor, pdp);

  const isEmployee = actor.role === Role.EMPLOYEE && actor.id === pdp.employeeId;
  if (!isEmployee) {
    throw new AppError("Only the employee can update their own sub-goal progress", 403);
  }
  if (pdp.status !== PdpStatus.ACTIVE && pdp.status !== PdpStatus.ASSIGNED) {
    throw new AppError("Sub-goals can only be updated on an assigned or active PDP", 400);
  }

  const subGoal = await findSubGoalOrThrow(pdpId, subGoalId);
  if (subGoal.status === PdpSubGoalStatus.PENDING_APPROVAL) {
    throw new AppError(
      "This update is waiting for supervisor approval and cannot be changed yet",
      400
    );
  }
  if (subGoal.status === PdpSubGoalStatus.COMPLETED) {
    throw new AppError("This sub-goal is already approved and completed", 400);
  }

  const existingEvidence = parseEvidenceFiles(subGoal.evidenceFiles);
  const nextEvidence = [...existingEvidence];
  if (uploaded) {
    nextEvidence.push({
      fileName: uploaded.originalname,
      storedName: uploaded.filename,
      mimeType: uploaded.mimetype,
      size: uploaded.size,
      uploadedAt: new Date().toISOString(),
    });
  }

  const requestedStatus = resolveRequestedProgress(input);
  if (requestedStatus === PdpSubGoalStatus.COMPLETED) {
    if (!input.comment?.trim() && !subGoal.comment?.trim()) {
      throw new AppError("A completion comment is required", 400);
    }
  }

  await prisma.pdpSubGoal.update({
    where: { id: subGoal.id },
    data: {
      status: PdpSubGoalStatus.PENDING_APPROVAL,
      submittedStatus: requestedStatus,
      comment: input.comment !== undefined ? input.comment?.trim() || null : subGoal.comment,
      evidenceCount: nextEvidence.length,
      evidenceFiles: nextEvidence,
      completedAt: new Date(),
      approvedAt: null,
      supervisorComment: null,
      reviewedAt: null,
      reviewedById: null,
    },
  });

  await syncGoalProgressFromSubs(subGoal.goalId);

  const version = currentVersion(pdp);
  const requestedLabel = progressStatusLabel(requestedStatus);
  await prisma.pdpActivity.create({
    data: {
      pdpId: pdp.id,
      versionId: version?.id ?? null,
      actorId: actor.id,
      action: "SUBGOAL_SUBMITTED",
      message: `Submitted "${subGoal.title}" as ${requestedLabel} for supervisor approval`,
    },
  });
  if (pdp.supervisorId) {
    await notify({
      recipientId: pdp.supervisorId,
      type: NotificationType.PDP_EMPLOYEE_RESPONSE,
      title: "Sub-goal awaiting approval",
      message: `${pdp.employee.name} submitted "${subGoal.title}" (${requestedLabel}) for approval.`,
      subjectEmployeeId: pdp.employeeId,
      pdpId: pdp.id,
    });
  }

  const loaded = await loadPdp(pdpId);
  return serializePdp(loaded, actor);
}

export async function approveSubGoalCompletion(
  actor: Actor,
  pdpId: string,
  subGoalId: string,
  input?: { comment?: string | null }
) {
  if (actor.role !== Role.SUPERVISOR) {
    throw new AppError("Only a supervisor can approve sub-goal completion", 403);
  }
  const pdp = await loadPdp(pdpId);
  await assertCanAccessPdp(actor, pdp);
  if (actor.role === Role.SUPERVISOR && pdp.supervisorId !== actor.id) {
    throw new AppError("You can only approve sub-goals for your team", 403);
  }

  const subGoal = await findSubGoalOrThrow(pdpId, subGoalId);
  if (subGoal.status !== PdpSubGoalStatus.PENDING_APPROVAL) {
    throw new AppError("Only a submitted completion can be approved", 400);
  }

  const official = applyApprovedProgress(subGoal.submittedStatus);
  const awardsPoints = official === PdpSubGoalStatus.COMPLETED;
  const now = new Date();
  await prisma.pdpSubGoal.update({
    where: { id: subGoal.id },
    data: {
      status: official,
      approvedAt: awardsPoints ? now : null,
      reviewedAt: now,
      reviewedById: actor.id,
      supervisorComment: input?.comment?.trim() || subGoal.supervisorComment,
    },
  });
  await syncGoalProgressFromSubs(subGoal.goalId);

  const version = currentVersion(pdp);
  await prisma.pdpActivity.create({
    data: {
      pdpId: pdp.id,
      versionId: version?.id ?? null,
      actorId: actor.id,
      action: "SUBGOAL_APPROVED",
      message: awardsPoints
        ? `Approved completion of "${subGoal.title}"`
        : `Approved progress update for "${subGoal.title}" (${progressStatusLabel(official)})`,
    },
  });

  await notify({
    recipientId: pdp.employeeId,
    type: NotificationType.PDP_APPROVED,
    title: "Sub-goal approved",
    message: awardsPoints
      ? `Your supervisor approved "${subGoal.title}". Points now count toward your PDP score.`
      : `Your supervisor approved your update to "${subGoal.title}".`,
    subjectEmployeeId: pdp.employeeId,
    pdpId: pdp.id,
  });

  const loaded = await loadPdp(pdpId);
  return serializePdp(loaded, actor);
}

export async function requestSubGoalChanges(
  actor: Actor,
  pdpId: string,
  subGoalId: string,
  reason: string
) {
  if (actor.role !== Role.SUPERVISOR) {
    throw new AppError("Only a supervisor can decline a sub-goal submission", 403);
  }
  if (!reason.trim()) throw new AppError("A reason for declining is required", 400);

  const pdp = await loadPdp(pdpId);
  await assertCanAccessPdp(actor, pdp);
  if (actor.role === Role.SUPERVISOR && pdp.supervisorId !== actor.id) {
    throw new AppError("You can only decline sub-goals for your team", 403);
  }

  const subGoal = await findSubGoalOrThrow(pdpId, subGoalId);
  if (subGoal.status !== PdpSubGoalStatus.PENDING_APPROVAL) {
    throw new AppError("Only a pending submission can be declined", 400);
  }

  const now = new Date();
  await prisma.pdpSubGoal.update({
    where: { id: subGoal.id },
    data: {
      status: PdpSubGoalStatus.CHANGES_REQUESTED,
      approvedAt: null,
      reviewedAt: now,
      reviewedById: actor.id,
      supervisorComment: reason.trim(),
    },
  });
  await syncGoalProgressFromSubs(subGoal.goalId);

  const version = currentVersion(pdp);
  await prisma.pdpActivity.create({
    data: {
      pdpId: pdp.id,
      versionId: version?.id ?? null,
      actorId: actor.id,
      action: "SUBGOAL_DECLINED",
      message: `Declined "${subGoal.title}": ${reason.trim()}`,
    },
  });

  await notify({
    recipientId: pdp.employeeId,
    type: NotificationType.PDP_CHANGES_REQUESTED,
    title: "Sub-goal declined",
    message: `Your supervisor declined "${subGoal.title}": ${reason.trim()}`,
    subjectEmployeeId: pdp.employeeId,
    pdpId: pdp.id,
  });

  const loaded = await loadPdp(pdpId);
  return serializePdp(loaded, actor);
}

export async function addActivePdpGoal(
  actor: Actor,
  pdpId: string,
  input: {
    title: string;
    objective?: string;
    expectedOutcome?: string;
    successCriteria?: string;
    category?: string;
    subGoals?: Array<{
      title: string;
      description?: string;
      dueDate?: string | null;
      expectedOutcome?: string | null;
      successCriteria?: string | null;
    }>;
  }
) {
  if (actor.role !== Role.SUPERVISOR) {
    throw new AppError("Only a supervisor can add goals", 403);
  }
  const pdp = await loadPdp(pdpId);
  await assertCanAccessPdp(actor, pdp);
  if (actor.role === Role.SUPERVISOR && pdp.supervisorId !== actor.id) {
    throw new AppError("You can only add goals for your team's PDPs", 403);
  }
  if (pdp.status !== PdpStatus.ACTIVE && pdp.status !== PdpStatus.ASSIGNED) {
    throw new AppError("Goals can only be added to an assigned or active PDP", 400);
  }

  const version = currentVersion(pdp);
  if (!version) throw new AppError("PDP has no current version", 400);

  const title = input.title.trim();
  if (!title) throw new AppError("Goal title is required", 400);

  const sortOrder = version.goals.length;
  const defaultSubs =
    input.subGoals && input.subGoals.length > 0
      ? input.subGoals
      : Array.from({ length: 5 }, (_, index) => ({
          title: `Sub-goal ${index + 1}`,
          description: "",
          dueDate: null as string | null,
          expectedOutcome: null as string | null,
          successCriteria: null as string | null,
        }));

  await prisma.pdpGoal.create({
    data: {
      pdpId: pdp.id,
      versionId: version.id,
      title,
      objective: input.objective?.trim() || `Development focus: ${title}`,
      expectedOutcome: input.expectedOutcome?.trim() || null,
      successCriteria: input.successCriteria?.trim() || null,
      category: input.category?.trim() || "Professional Growth",
      developmentArea: input.category?.trim() || "Professional Growth",
      sortOrder,
      priority: PdpGoalPriority.MEDIUM,
      progress: 0,
      status: PdpGoalStatus.NOT_STARTED,
      subGoals: {
        create: defaultSubs.map((sub, index) => ({
          title: sub.title.trim() || `Sub-goal ${index + 1}`,
          description: sub.description?.trim() || "",
          dueDate: sub.dueDate ? parseDueDate(sub.dueDate) : null,
          expectedOutcome: sub.expectedOutcome?.trim() || null,
          successCriteria: sub.successCriteria?.trim() || null,
          sortOrder: index,
          status: PdpSubGoalStatus.NOT_STARTED,
        })),
      },
    },
  });

  await prisma.pdpActivity.create({
    data: {
      pdpId: pdp.id,
      versionId: version.id,
      actorId: actor.id,
      action: "GOAL_ADDED",
      message: `New development goal added by Supervisor: "${title}"`,
    },
  });

  const supervisorName = pdp.supervisor?.name ?? "Your Supervisor";
  await notify({
    recipientId: pdp.employeeId,
    type: NotificationType.PDP_GOAL_ADDED,
    title: "New development goal added",
    message: `Your Supervisor ${supervisorName} added a new development goal: ${title}.`,
    subjectEmployeeId: pdp.employeeId,
    pdpId: pdp.id,
  });

  const loaded = await loadPdp(pdpId);
  return serializePdp(loaded, actor);
}

export async function addActivePdpSubGoal(
  actor: Actor,
  pdpId: string,
  goalId: string,
  input: {
    title: string;
    description?: string;
    dueDate?: string | null;
    expectedOutcome?: string | null;
    successCriteria?: string | null;
  }
) {
  if (actor.role !== Role.SUPERVISOR) {
    throw new AppError("Only a supervisor can add sub-goals", 403);
  }
  const pdp = await loadPdp(pdpId);
  await assertCanAccessPdp(actor, pdp);
  if (actor.role === Role.SUPERVISOR && pdp.supervisorId !== actor.id) {
    throw new AppError("You can only add sub-goals for your team's PDPs", 403);
  }
  if (pdp.status !== PdpStatus.ACTIVE && pdp.status !== PdpStatus.ASSIGNED) {
    throw new AppError("Sub-goals can only be added to an assigned or active PDP", 400);
  }

  const goal = await prisma.pdpGoal.findFirst({
    where: { id: goalId, pdpId: pdp.id },
    include: { subGoals: true },
  });
  if (!goal) throw new AppError("Main goal not found", 404);

  const title = input.title.trim();
  if (!title) throw new AppError("Sub-goal title is required", 400);

  await prisma.pdpSubGoal.create({
    data: {
      goalId: goal.id,
      title,
      description: input.description?.trim() || "",
      dueDate: input.dueDate ? parseDueDate(input.dueDate) : null,
      expectedOutcome: input.expectedOutcome?.trim() || null,
      successCriteria: input.successCriteria?.trim() || null,
      sortOrder: goal.subGoals.length,
      status: PdpSubGoalStatus.NOT_STARTED,
    },
  });
  await syncGoalProgressFromSubs(goal.id);

  const version = currentVersion(pdp);
  await prisma.pdpActivity.create({
    data: {
      pdpId: pdp.id,
      versionId: version?.id ?? null,
      actorId: actor.id,
      action: "SUBGOAL_ADDED",
      message: `New sub-goal added by Supervisor under "${goal.title}": "${title}"`,
    },
  });

  const supervisorName = pdp.supervisor?.name ?? "Your Supervisor";
  await notify({
    recipientId: pdp.employeeId,
    type: NotificationType.PDP_GOAL_ADDED,
    title: "New development goal added",
    message: `Your Supervisor ${supervisorName} added a new sub-goal under "${goal.title}": ${title}.`,
    subjectEmployeeId: pdp.employeeId,
    pdpId: pdp.id,
  });

  const loaded = await loadPdp(pdpId);
  return serializePdp(loaded, actor);
}

export async function listPendingSubGoalApprovals(actor: Actor) {
  if (actor.role !== Role.SUPERVISOR && actor.role !== Role.HR_MANAGER && actor.role !== Role.HR) {
    throw new AppError("Not permitted", 403);
  }

  const employeeIds =
    actor.role === Role.SUPERVISOR
      ? [...(await supervisedEmployeeIds(actor.id))]
      : actor.role === Role.HR
        ? [...(await hrScopeEmployeeIds(actor.id))]
        : undefined;

  const pending = await prisma.pdpSubGoal.findMany({
    where: {
      status: PdpSubGoalStatus.PENDING_APPROVAL,
      goal: {
        pdp: {
          status: { in: [PdpStatus.ACTIVE, PdpStatus.ASSIGNED] },
          ...(employeeIds ? { employeeId: { in: employeeIds } } : {}),
        },
      },
    },
    include: {
      goal: {
        include: {
          pdp: {
            include: {
              employee: { select: personSelect },
              supervisor: { select: personSelect },
            },
          },
        },
      },
    },
    orderBy: { completedAt: "desc" },
  });

  return pending.map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    comment: item.comment,
    completedAt: item.completedAt?.toISOString() ?? null,
    evidenceCount: item.evidenceCount,
    evidenceFiles: serializeEvidenceFiles(item.evidenceFiles),
    goal: { id: item.goal.id, title: item.goal.title },
    pdp: {
      id: item.goal.pdp.id,
      title: item.goal.pdp.title,
      employee: item.goal.pdp.employee,
      supervisor: item.goal.pdp.supervisor,
    },
  }));
}

