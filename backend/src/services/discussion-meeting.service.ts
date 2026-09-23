import {
  MeetingParticipantResponse,
  MeetingParticipantRole,
  MeetingStatus,
  MeetingType,
  NotificationType,
  Role,
} from "../../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/errors.js";
import { createNotification } from "./notification.service.js";

type Actor = { id: string; role: Role };

const DISCUSSION_TYPES = [MeetingType.PDP_DISAGREEMENT, MeetingType.PIP_DISCUSSION] as const;

const personSelect = {
  id: true,
  employeeId: true,
  name: true,
  jobTitle: true,
  role: true,
} as const;

function combineDateTime(date: string, time: string) {
  const value = new Date(`${date}T${time}`);
  if (Number.isNaN(value.getTime())) throw new AppError("Invalid date or time", 400);
  return value;
}

function formatWhen(scheduledAt: Date) {
  return scheduledAt.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function visibleWhere(actor: Actor) {
  return {
    type: { in: [...DISCUSSION_TYPES] },
    OR: [{ supervisorId: actor.id }, { createdById: actor.id }, { participants: { some: { employeeId: actor.id } } }],
  };
}

async function loadVisible(actor: Actor, meetingId: string) {
  const meeting = await prisma.meeting.findFirst({
    where: { id: meetingId, ...visibleWhere(actor) },
    include: {
      employee: { select: personSelect },
      supervisor: { select: personSelect },
      participants: { include: { employee: { select: personSelect } } },
      rescheduleRequests: {
        orderBy: { createdAt: "desc" },
        include: { requester: { select: personSelect } },
      },
    },
  });
  if (!meeting) throw new AppError("Meeting not found", 404);
  return meeting;
}

function serialize(meeting: Awaited<ReturnType<typeof loadVisible>>) {
  return {
    id: meeting.id,
    type: meeting.type,
    title: meeting.title,
    description: meeting.description,
    purpose: meeting.description,
    status: meeting.status,
    scheduledAt: meeting.scheduledAt.toISOString(),
    endAt: meeting.endAt.toISOString(),
    location: meeting.location,
    employee: meeting.employee,
    supervisor: meeting.supervisor,
    participants: meeting.participants.map((participant) => ({
      id: participant.id,
      employeeId: participant.employeeId,
      role: participant.participantRole,
      response: participant.response,
      responseMessage: participant.responseMessage,
      respondedAt: participant.respondedAt?.toISOString() ?? null,
      employee: participant.employee,
    })),
    history: meeting.rescheduleRequests.map((request) => ({
      id: request.id,
      reason: request.reason,
      status: request.status,
      createdAt: request.createdAt.toISOString(),
      reviewedAt: request.reviewedAt?.toISOString() ?? null,
      reviewNote: request.reviewNote,
      requester: request.requester,
    })),
  };
}

export async function listDiscussionMeetings(actor: Actor) {
  const meetings = await prisma.meeting.findMany({
    where: visibleWhere(actor),
    include: {
      employee: { select: personSelect },
      supervisor: { select: personSelect },
      participants: { include: { employee: { select: personSelect } } },
      rescheduleRequests: {
        orderBy: { createdAt: "desc" },
        include: { requester: { select: personSelect } },
      },
    },
    orderBy: { scheduledAt: "desc" },
  });
  return meetings.map((meeting) => serialize(meeting));
}

export async function getDiscussionOptions(actor: Actor) {
  if (actor.role !== Role.SUPERVISOR) {
    throw new AppError("Only a supervisor can schedule discussion meetings", 403);
  }
  const teams = await prisma.team.findMany({
    where: { supervisorId: actor.id },
    select: { id: true },
  });
  const employees = await prisma.employee.findMany({
    where: { role: Role.EMPLOYEE, deactivatedAt: null, teamId: { in: teams.map((team) => team.id) } },
    select: personSelect,
    orderBy: { name: "asc" },
  });
  const hrStaff = await prisma.employee.findMany({
    where: { role: Role.HR, deactivatedAt: null },
    select: personSelect,
    orderBy: { name: "asc" },
  });
  return { employees, hrStaff };
}

export async function scheduleDiscussionMeeting(
  actor: Actor,
  input: {
    type: "PDP_DISAGREEMENT" | "PIP_DISCUSSION";
    employeeId: string;
    participantIds: string[];
    date: string;
    startTime: string;
    endTime: string;
    location: string;
    purpose: string;
    title?: string | undefined;
  }
) {
  if (actor.role !== Role.SUPERVISOR) {
    throw new AppError("Only a supervisor can schedule discussion meetings", 403);
  }
  const purpose = input.purpose.trim();
  if (purpose.length < 8) throw new AppError("A meeting purpose is required", 400);
  const employee = await prisma.employee.findFirst({
    where: { id: input.employeeId, deactivatedAt: null, team: { supervisorId: actor.id } },
    select: { id: true, employeeId: true, name: true },
  });
  if (!employee) throw new AppError("Select an employee on your team", 400);

  const participantIds = [...new Set(input.participantIds.filter((id) => id && id !== actor.id))];
  if (!participantIds.includes(employee.id)) participantIds.unshift(employee.id);
  const people = await prisma.employee.findMany({
    where: { id: { in: participantIds }, deactivatedAt: null },
    select: { id: true, role: true, name: true },
  });
  if (people.length !== participantIds.length) throw new AppError("One or more participants are invalid", 400);
  for (const person of people) {
    const onTeam = person.id === employee.id;
    const isHr = person.role === Role.HR;
    if (!onTeam && !isHr) {
      throw new AppError("Participants must be the employee, selected colleagues on the team, or an HR representative", 400);
    }
  }

  const scheduledAt = combineDateTime(input.date, input.startTime);
  const endAt = combineDateTime(input.date, input.endTime);
  if (endAt <= scheduledAt) throw new AppError("End time must be after start time", 400);
  const cycle = await prisma.appraisalCycle.findFirst({ where: { status: "ACTIVE" }, orderBy: { startDate: "desc" } });
  const title =
    input.title?.trim() ||
    (input.type === "PIP_DISCUSSION"
      ? `PIP Discussion – ${employee.employeeId}`
      : `PDP Disagreement Discussion – ${employee.employeeId}`);

  const meeting = await prisma.meeting.create({
    data: {
      type: input.type === "PIP_DISCUSSION" ? MeetingType.PIP_DISCUSSION : MeetingType.PDP_DISAGREEMENT,
      title,
      description: purpose,
      employeeId: employee.id,
      supervisorId: actor.id,
      createdById: actor.id,
      cycleId: cycle?.id ?? null,
      scheduledAt,
      endAt,
      location: input.location.trim(),
      status: MeetingStatus.SCHEDULED,
      participants: {
        create: [
          {
            employeeId: actor.id,
            participantRole: MeetingParticipantRole.SUPERVISOR,
            response: MeetingParticipantResponse.ACCEPTED,
            respondedAt: new Date(),
          },
          ...people.map((person) => ({
            employeeId: person.id,
            participantRole:
              person.role === Role.HR
                ? MeetingParticipantRole.HR
                : person.id === employee.id
                  ? MeetingParticipantRole.EMPLOYEE
                  : MeetingParticipantRole.OTHER,
            response: MeetingParticipantResponse.PENDING,
          })),
        ],
      },
    },
  });

  const when = formatWhen(scheduledAt);
  const noticeType =
    input.type === "PIP_DISCUSSION" ? NotificationType.MEETING_INVITATION : NotificationType.MEETING_INVITATION;
  for (const person of people) {
    await createNotification({
      type: noticeType,
      title: input.type === "PIP_DISCUSSION" ? "PIP meeting invitation" : "PDP disagreement meeting invitation",
      message: `${title} on ${when}. Purpose: ${purpose}. Please approve or request a reschedule.`,
      recipientId: person.id,
      subjectEmployeeId: employee.id,
      metadata: { meetingId: meeting.id },
    });
  }
  return loadVisible(actor, meeting.id).then(serialize);
}

export async function respondToDiscussionMeeting(
  actor: Actor,
  meetingId: string,
  input: { decision: "ACCEPT" | "RESCHEDULE"; reason?: string | undefined }
) {
  const meeting = await loadVisible(actor, meetingId);
  if (meeting.type !== MeetingType.PDP_DISAGREEMENT && meeting.type !== MeetingType.PIP_DISCUSSION) {
    throw new AppError("This is not a discussion meeting", 400);
  }
  const participant = meeting.participants.find((item) => item.employeeId === actor.id);
  if (!participant) throw new AppError("You are not a participant in this meeting", 403);
  if (participant.participantRole === MeetingParticipantRole.SUPERVISOR) {
    throw new AppError("The scheduling supervisor confirms the meeting by choosing a time", 400);
  }
  if (meeting.status === MeetingStatus.COMPLETED || meeting.status === MeetingStatus.CANCELLED) {
    throw new AppError("This meeting can no longer be updated", 400);
  }
  if (input.decision === "RESCHEDULE" && !input.reason?.trim()) {
    throw new AppError("A reschedule reason is required", 400);
  }

  const response =
    input.decision === "ACCEPT" ? MeetingParticipantResponse.ACCEPTED : MeetingParticipantResponse.RESCHEDULE_REQUESTED;

  await prisma.$transaction(async (tx) => {
    await tx.meetingParticipant.update({
      where: { id: participant.id },
      data: {
        response,
        responseMessage: input.reason?.trim() || null,
        respondedAt: new Date(),
      },
    });
    if (input.decision === "RESCHEDULE") {
      await tx.meeting.update({ where: { id: meeting.id }, data: { status: MeetingStatus.RESCHEDULE_REQUESTED } });
      await tx.meetingRescheduleRequest.create({
        data: {
          meetingId: meeting.id,
          requesterId: actor.id,
          reason: input.reason!.trim(),
          status: "PENDING",
        },
      });
      return;
    }
    const others = meeting.participants.filter((item) => item.employeeId !== actor.id && item.participantRole !== "SUPERVISOR");
    const allAccepted =
      others.every((item) => item.response === MeetingParticipantResponse.ACCEPTED) && response === MeetingParticipantResponse.ACCEPTED;
    if (allAccepted && meeting.status !== MeetingStatus.RESCHEDULE_REQUESTED) {
      await tx.meeting.update({ where: { id: meeting.id }, data: { status: MeetingStatus.CONFIRMED } });
    }
  });

  if (meeting.supervisorId) {
    await createNotification({
      type: input.decision === "RESCHEDULE" ? NotificationType.MEETING_RESCHEDULE_REQUEST : NotificationType.MEETING_RESPONSE,
      title: input.decision === "RESCHEDULE" ? "Meeting reschedule requested" : "Meeting response received",
      message:
        input.decision === "RESCHEDULE"
          ? `${participant.employee.name} requested a new time for ${meeting.title}. Reason: ${input.reason?.trim()}`
          : `${participant.employee.name} approved ${meeting.title}.`,
      recipientId: meeting.supervisorId,
      subjectEmployeeId: meeting.employeeId,
      metadata: { meetingId: meeting.id },
    });
  }

  const refreshed = await loadVisible(actor, meetingId);
  if (refreshed.status === MeetingStatus.CONFIRMED) {
    for (const person of refreshed.participants) {
      await createNotification({
        type: NotificationType.MEETING_CONFIRMED,
        title: "Meeting confirmed",
        message: `${refreshed.title} is confirmed for ${formatWhen(refreshed.scheduledAt)}.`,
        recipientId: person.employeeId,
        subjectEmployeeId: refreshed.employeeId,
        metadata: { meetingId: refreshed.id },
      });
    }
  }
  return serialize(refreshed);
}

export async function rescheduleDiscussionMeeting(
  actor: Actor,
  meetingId: string,
  input: { date: string; startTime: string; endTime: string; location?: string | undefined; note?: string | undefined }
) {
  const meeting = await loadVisible(actor, meetingId);
  if (meeting.supervisorId !== actor.id) throw new AppError("Only the scheduling supervisor can reschedule this meeting", 403);
  const scheduledAt = combineDateTime(input.date, input.startTime);
  const endAt = combineDateTime(input.date, input.endTime);
  if (endAt <= scheduledAt) throw new AppError("End time must be after start time", 400);

  await prisma.$transaction(async (tx) => {
    await tx.meeting.update({
      where: { id: meeting.id },
      data: {
        previousScheduledAt: meeting.scheduledAt,
        scheduledAt,
        endAt,
        location: input.location?.trim() || meeting.location,
        status: MeetingStatus.SCHEDULED,
      },
    });
    await tx.meetingParticipant.updateMany({
      where: { meetingId: meeting.id, participantRole: { not: MeetingParticipantRole.SUPERVISOR } },
      data: { response: MeetingParticipantResponse.PENDING, responseMessage: null, respondedAt: null },
    });
    await tx.meetingRescheduleRequest.updateMany({
      where: { meetingId: meeting.id, status: "PENDING" },
      data: {
        status: "APPROVED",
        reviewedAt: new Date(),
        reviewedById: actor.id,
        requestedStart: scheduledAt,
        requestedEnd: endAt,
        reviewNote: input.note?.trim() || "Supervisor selected a new date and time.",
      },
    });
  });

  const when = formatWhen(scheduledAt);
  for (const participant of meeting.participants) {
    if (participant.employeeId === actor.id) continue;
    await createNotification({
      type: NotificationType.MEETING_RESCHEDULED,
      title: "Meeting rescheduled",
      message: `${meeting.title} has a new time: ${when}. Please approve or request another reschedule.`,
      recipientId: participant.employeeId,
      subjectEmployeeId: meeting.employeeId,
      metadata: { meetingId: meeting.id },
    });
  }
  return loadVisible(actor, meetingId).then(serialize);
}
