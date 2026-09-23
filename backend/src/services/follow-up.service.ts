import {
  MeetingParticipantResponse,
  MeetingParticipantRole,
  MeetingStatus,
  MeetingType,
  NotificationType,
  Prisma,
  RescheduleRequestStatus,
  Role,
} from "../../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/errors.js";
import { createNotification } from "./notification.service.js";
import type {
  AdditionalFollowUpInput,
  RescheduleFollowUpInput,
  SupervisorRescheduleInput,
} from "../validations/follow-up.validation.js";

type Actor = { id: string; role: Role };

const personSelect = {
  id: true,
  employeeId: true,
  name: true,
  jobTitle: true,
  role: true,
} satisfies Prisma.EmployeeSelect;

const meetingInclude = {
  employee: {
    select: {
      ...personSelect,
      department: { select: { name: true } },
      team: { select: { name: true, supervisor: { select: personSelect } } },
    },
  },
  supervisor: { select: personSelect },
  participants: { include: { employee: { select: personSelect } } },
  rescheduleRequests: { orderBy: { createdAt: "desc" as const } },
} satisfies Prisma.MeetingInclude;

type MeetingRecord = Prisma.MeetingGetPayload<{ include: typeof meetingInclude }>;

async function activeCycle() {
  const cycle = await prisma.appraisalCycle.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { startDate: "desc" },
  });
  if (!cycle) throw new AppError("No active appraisal cycle is available", 400);
  return cycle;
}

async function supervisedIds(supervisorId: string) {
  const teams = await prisma.team.findMany({ where: { supervisorId }, select: { id: true } });
  const members = await prisma.employee.findMany({
    where: { role: Role.EMPLOYEE, deactivatedAt: null, teamId: { in: teams.map((team) => team.id) } },
    select: { id: true },
  });
  return new Set(members.map((member) => member.id));
}

function approaching(scheduledAt: Date) {
  const now = Date.now();
  const start = scheduledAt.getTime();
  return start > now && start - now <= 7 * 24 * 60 * 60 * 1000;
}

function meetingDisplayStatus(meeting: MeetingRecord) {
  if (meeting.status === MeetingStatus.COMPLETED) return "Completed";
  if (meeting.status === MeetingStatus.RESCHEDULE_REQUESTED) return "Reschedule Requested";
  if (meeting.status === MeetingStatus.RESCHEDULED) return "Rescheduled";
  if (meeting.status === MeetingStatus.CONFIRMED) return "Confirmed";
  if (approaching(meeting.scheduledAt)) return "Pending Confirmation";
  return "Schedule Generated";
}

function confirmationStatus(meeting: MeetingRecord) {
  const employee = meeting.participants.find((row) => row.employeeId === meeting.employeeId);
  if (meeting.status === MeetingStatus.CONFIRMED || employee?.response === MeetingParticipantResponse.ACCEPTED) {
    return "Confirmed";
  }
  if (meeting.status === MeetingStatus.RESCHEDULE_REQUESTED) return "Reschedule Requested";
  if (meeting.status === MeetingStatus.RESCHEDULED) return "Rescheduled";
  if (approaching(meeting.scheduledAt)) return "Pending Confirmation";
  return "Awaiting window";
}

function scheduleStatus(meetings: MeetingRecord[]) {
  const standard = meetings.filter((meeting) => !meeting.isAdditionalFollowUp);
  if (standard.length === 0) return "Not Scheduled";
  if (meetings.some((meeting) => meeting.status === MeetingStatus.RESCHEDULE_REQUESTED)) {
    return "Reschedule Requested";
  }
  if (meetings.some((meeting) => meeting.status === MeetingStatus.RESCHEDULED)) return "Rescheduled";
  if (meetings.some((meeting) => meeting.status === MeetingStatus.COMPLETED)) return "Completed";
  if (meetings.some((meeting) => approaching(meeting.scheduledAt) && meeting.status === MeetingStatus.SCHEDULED)) {
    return "Pending Confirmation";
  }
  if (meetings.some((meeting) => meeting.status === MeetingStatus.CONFIRMED)) return "Confirmed";
  return "Schedule Generated";
}

function presentMeeting(meeting: MeetingRecord) {
  return {
    id: meeting.id,
    meetingNumber: meeting.isAdditionalFollowUp ? null : meeting.followUpSlot,
    isAdditional: meeting.isAdditionalFollowUp,
    title: meeting.title,
    purpose: meeting.description,
    date: meeting.scheduledAt.toISOString(),
    time: meeting.scheduledAt.toISOString(),
    endAt: meeting.endAt.toISOString(),
    location: meeting.location ?? "Supervisor office",
    status: meetingDisplayStatus(meeting),
    confirmationStatus: confirmationStatus(meeting),
    canConfirm: approaching(meeting.scheduledAt) && meeting.status === MeetingStatus.SCHEDULED,
    employee: {
      id: meeting.employee.id,
      employeeId: meeting.employee.employeeId,
      name: meeting.employee.name,
    },
    supervisor: meeting.supervisor
      ? {
          id: meeting.supervisor.id,
          employeeId: meeting.supervisor.employeeId,
          name: meeting.supervisor.name,
        }
      : null,
    pendingReschedule: meeting.rescheduleRequests.find((row) => row.status === RescheduleRequestStatus.PENDING) ?? null,
  };
}

async function loadFollowUps(employeeId: string, cycleId: string) {
  return prisma.meeting.findMany({
    where: {
      employeeId,
      cycleId,
      type: MeetingType.FOLLOW_UP,
      status: { not: MeetingStatus.CANCELLED },
    },
    include: meetingInclude,
    orderBy: [{ isAdditionalFollowUp: "asc" }, { followUpSlot: "asc" }, { scheduledAt: "asc" }],
  });
}

async function assertFollowUpAccess(actor: Actor, employeeId: string) {
  if (actor.role === Role.HR_MANAGER || actor.role === Role.HR) return;
  if (actor.role === Role.EMPLOYEE) {
    if (actor.id !== employeeId) throw new AppError("You can only view your own follow-up meetings", 403);
    return;
  }
  if (actor.role === Role.SUPERVISOR) {
    const ids = await supervisedIds(actor.id);
    if (!ids.has(employeeId)) {
      const assigned = await prisma.meeting.findFirst({
        where: { type: MeetingType.FOLLOW_UP, employeeId, supervisorId: actor.id },
        select: { id: true },
      });
      if (!assigned) throw new AppError("You can only manage follow-up meetings for your team", 403);
    }
    return;
  }
  throw new AppError("You do not have permission to access follow-up meetings", 403);
}

export async function listFollowUpBoard(actor: Actor) {
  const cycle = await activeCycle();
  const where: Prisma.EmployeeWhereInput = { role: Role.EMPLOYEE, deactivatedAt: null };
  if (actor.role === Role.EMPLOYEE) where.id = actor.id;
  if (actor.role === Role.SUPERVISOR) {
    const teamIds = [...(await supervisedIds(actor.id))];
    const assigned = await prisma.meeting.findMany({
      where: { type: MeetingType.FOLLOW_UP, supervisorId: actor.id, cycleId: cycle.id },
      select: { employeeId: true },
    });
    where.id = { in: [...new Set([...teamIds, ...assigned.map((row) => row.employeeId)])] };
  }

  const employees = await prisma.employee.findMany({
    where,
    select: {
      id: true,
      employeeId: true,
      name: true,
      department: { select: { name: true } },
      team: { select: { name: true, supervisor: { select: personSelect } } },
    },
    orderBy: { name: "asc" },
  });

  const meetings = await prisma.meeting.findMany({
    where: {
      type: MeetingType.FOLLOW_UP,
      cycleId: cycle.id,
      employeeId: { in: employees.map((employee) => employee.id) },
      status: { not: MeetingStatus.CANCELLED },
    },
    include: meetingInclude,
    orderBy: { scheduledAt: "asc" },
  });
  const byEmployee = new Map<string, MeetingRecord[]>();
  for (const meeting of meetings) {
    const list = byEmployee.get(meeting.employeeId) ?? [];
    list.push(meeting);
    byEmployee.set(meeting.employeeId, list);
  }

  return {
    cycle: { id: cycle.id, name: cycle.name, startDate: cycle.startDate.toISOString(), endDate: cycle.endDate.toISOString() },
    viewOnly: actor.role === Role.HR || actor.role === Role.HR_MANAGER,
    items: employees.map((employee) => {
      const rows = byEmployee.get(employee.id) ?? [];
      const standard = rows.filter((row) => !row.isAdditionalFollowUp);
      const additional = rows.filter((row) => row.isAdditionalFollowUp);
      return {
        employee: {
          id: employee.id,
          employeeId: employee.employeeId,
          name: employee.name,
          department: employee.department?.name ?? "Unassigned",
          team: employee.team?.name ?? "—",
          supervisor: employee.team?.supervisor?.name ?? "—",
        },
        scheduleStatus: scheduleStatus(rows),
        meetingSummaries: [1, 2, 3, 4, 5].map((slot) => {
          const meeting = standard.find((row) => row.followUpSlot === slot);
          return meeting ? meetingDisplayStatus(meeting) : "Not Scheduled";
        }),
        additionalCount: additional.length,
        hasSchedule: standard.length > 0,
      };
    }),
  };
}

export async function getEmployeeFollowUps(actor: Actor, employeeId: string) {
  await assertFollowUpAccess(actor, employeeId);
  const cycle = await activeCycle();
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      id: true,
      employeeId: true,
      name: true,
      department: { select: { name: true } },
      team: { select: { name: true, supervisor: { select: personSelect } } },
    },
  });
  if (!employee) throw new AppError("Employee not found", 404);
  const meetings = await loadFollowUps(employeeId, cycle.id);
  return {
    cycle: { id: cycle.id, name: cycle.name },
    employee: {
      id: employee.id,
      employeeId: employee.employeeId,
      name: employee.name,
      department: employee.department?.name ?? "Unassigned",
      supervisor: employee.team?.supervisor?.name ?? meetings[0]?.supervisor?.name ?? "—",
    },
    scheduleStatus: scheduleStatus(meetings),
    meetings: meetings.filter((row) => !row.isAdditionalFollowUp).map(presentMeeting),
    additionalMeetings: meetings.filter((row) => row.isAdditionalFollowUp).map(presentMeeting),
    viewOnly: actor.role === Role.HR || actor.role === Role.HR_MANAGER,
  };
}

export async function generateFollowUpSchedule(actor: Actor, employeeId: string) {
  if (actor.role !== Role.SUPERVISOR) {
    throw new AppError("Only a supervisor can generate a follow-up schedule", 403);
  }
  await assertFollowUpAccess(actor, employeeId);
  const cycle = await activeCycle();
  const existing = await prisma.meeting.findFirst({
    where: {
      employeeId,
      cycleId: cycle.id,
      type: MeetingType.FOLLOW_UP,
      isAdditionalFollowUp: false,
      status: { not: MeetingStatus.CANCELLED },
    },
  });
  if (existing) throw new AppError("A follow-up schedule already exists for this employee", 409);

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { team: { select: { supervisorId: true } } },
  });
  if (!employee) throw new AppError("Employee not found", 404);
  const supervisorId = employee.team?.supervisorId ?? actor.id;
  const start = cycle.startDate.getTime();
  const span = Math.max(cycle.endDate.getTime() - start, 30 * 24 * 60 * 60 * 1000);

  await prisma.$transaction(async (tx) => {
    for (let slot = 1; slot <= 5; slot += 1) {
      const scheduledAt = new Date(start + Math.round((span * slot) / 6));
      scheduledAt.setUTCHours(10, 0, 0, 0);
      const endAt = new Date(scheduledAt.getTime() + 45 * 60 * 1000);
      const meeting = await tx.meeting.create({
        data: {
          type: MeetingType.FOLLOW_UP,
          title: `Follow-up Meeting ${slot}`,
          description: `Standard follow-up meeting ${slot} of 5 for the appraisal year.`,
          employeeId,
          supervisorId,
          cycleId: cycle.id,
          scheduledAt,
          endAt,
          location: "Supervisor office",
          status: MeetingStatus.SCHEDULED,
          createdById: actor.id,
          followUpSlot: slot,
          isAdditionalFollowUp: false,
        },
      });
      await tx.meetingParticipant.createMany({
        data: [
          {
            meetingId: meeting.id,
            employeeId,
            participantRole: MeetingParticipantRole.EMPLOYEE,
            response: MeetingParticipantResponse.PENDING,
          },
          {
            meetingId: meeting.id,
            employeeId: supervisorId,
            participantRole: MeetingParticipantRole.SUPERVISOR,
            response: MeetingParticipantResponse.ACCEPTED,
          },
        ],
      });
    }
  });

  await createNotification({
    type: NotificationType.FOLLOW_UP_SCHEDULED,
    title: "Follow-up schedule generated",
    message: "Your supervisor has generated five follow-up meetings for this appraisal year.",
    recipientId: employeeId,
    subjectEmployeeId: employeeId,
  });

  return getEmployeeFollowUps(actor, employeeId);
}

export async function scheduleAdditionalFollowUp(actor: Actor, input: AdditionalFollowUpInput) {
  if (actor.role !== Role.SUPERVISOR) {
    throw new AppError("Only a supervisor can schedule an additional follow-up meeting", 403);
  }
  await assertFollowUpAccess(actor, input.employeeId);
  const cycle = await activeCycle();
  const employee = await prisma.employee.findUnique({
    where: { id: input.employeeId },
    include: { team: { select: { supervisorId: true } } },
  });
  if (!employee) throw new AppError("Employee not found", 404);
  const supervisorId = employee.team?.supervisorId ?? actor.id;
  const scheduledAt = new Date(input.scheduledAt);
  if (Number.isNaN(scheduledAt.getTime())) throw new AppError("A valid date and time is required", 400);
  const endAt = new Date(scheduledAt.getTime() + 45 * 60 * 1000);

  const meeting = await prisma.meeting.create({
    data: {
      type: MeetingType.FOLLOW_UP,
      title: "Additional Follow-up Meeting",
      description: input.purpose.trim(),
      employeeId: input.employeeId,
      supervisorId,
      cycleId: cycle.id,
      scheduledAt,
      endAt,
      location: input.location?.trim() || "Supervisor office",
      status: MeetingStatus.SCHEDULED,
      createdById: actor.id,
      isAdditionalFollowUp: true,
    },
  });
  await prisma.meetingParticipant.createMany({
    data: [
      {
        meetingId: meeting.id,
        employeeId: input.employeeId,
        participantRole: MeetingParticipantRole.EMPLOYEE,
        response: MeetingParticipantResponse.PENDING,
      },
      {
        meetingId: meeting.id,
        employeeId: supervisorId,
        participantRole: MeetingParticipantRole.SUPERVISOR,
        response: MeetingParticipantResponse.ACCEPTED,
      },
    ],
  });
  await createNotification({
    type: NotificationType.FOLLOW_UP_SCHEDULED,
    title: "Additional follow-up meeting scheduled",
    message: input.purpose.trim(),
    recipientId: input.employeeId,
    subjectEmployeeId: input.employeeId,
  });
  return getEmployeeFollowUps(actor, input.employeeId);
}

export async function confirmFollowUp(actor: Actor, meetingId: string) {
  if (actor.role !== Role.EMPLOYEE) {
    throw new AppError("Only the employee can confirm a follow-up meeting", 403);
  }
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: meetingInclude,
  });
  if (!meeting || meeting.type !== MeetingType.FOLLOW_UP) throw new AppError("Follow-up meeting not found", 404);
  if (meeting.employeeId !== actor.id) throw new AppError("You can only confirm your own meetings", 403);
  if (!approaching(meeting.scheduledAt) && meeting.status === MeetingStatus.SCHEDULED) {
    throw new AppError("You can confirm this meeting from 7 days before it starts", 400);
  }

  await prisma.$transaction([
    prisma.meeting.update({
      where: { id: meetingId },
      data: { status: MeetingStatus.CONFIRMED },
    }),
    prisma.meetingParticipant.updateMany({
      where: { meetingId, employeeId: actor.id },
      data: { response: MeetingParticipantResponse.ACCEPTED, respondedAt: new Date() },
    }),
  ]);
  if (meeting.supervisorId) {
    await createNotification({
      type: NotificationType.MEETING_CONFIRMED,
      title: "Follow-up meeting confirmed",
      message: `${meeting.employee.name} confirmed the follow-up meeting.`,
      recipientId: meeting.supervisorId,
      subjectEmployeeId: meeting.employeeId,
    });
  }
  return getEmployeeFollowUps(actor, meeting.employeeId);
}

export async function requestFollowUpReschedule(
  actor: Actor,
  meetingId: string,
  input: RescheduleFollowUpInput
) {
  if (actor.role !== Role.EMPLOYEE) {
    throw new AppError("Only the employee can request a follow-up reschedule", 403);
  }
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: meetingInclude,
  });
  if (!meeting || meeting.type !== MeetingType.FOLLOW_UP) throw new AppError("Follow-up meeting not found", 404);
  if (meeting.employeeId !== actor.id) throw new AppError("You can only reschedule your own meetings", 403);
  if (!input.reason.trim()) throw new AppError("A reason is required to request a reschedule", 400);

  await prisma.$transaction([
    prisma.meeting.update({
      where: { id: meetingId },
      data: { status: MeetingStatus.RESCHEDULE_REQUESTED },
    }),
    prisma.meetingRescheduleRequest.create({
      data: {
        meetingId,
        requesterId: actor.id,
        reason: input.reason.trim(),
        requestedStart: input.requestedStart ? new Date(input.requestedStart) : null,
        status: RescheduleRequestStatus.PENDING,
      },
    }),
    prisma.meetingParticipant.updateMany({
      where: { meetingId, employeeId: actor.id },
      data: { response: MeetingParticipantResponse.RESCHEDULE_REQUESTED, respondedAt: new Date() },
    }),
  ]);
  if (meeting.supervisorId) {
    await createNotification({
      type: NotificationType.FOLLOW_UP_RESCHEDULE_REQUEST,
      title: "Follow-up reschedule requested",
      message: input.reason.trim(),
      recipientId: meeting.supervisorId,
      subjectEmployeeId: meeting.employeeId,
    });
  }
  return getEmployeeFollowUps(actor, meeting.employeeId);
}

export async function supervisorRescheduleFollowUp(
  actor: Actor,
  meetingId: string,
  input: SupervisorRescheduleInput
) {
  if (actor.role !== Role.SUPERVISOR) {
    throw new AppError("Only a supervisor can reschedule a follow-up meeting", 403);
  }
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: meetingInclude,
  });
  if (!meeting || meeting.type !== MeetingType.FOLLOW_UP) throw new AppError("Follow-up meeting not found", 404);
  await assertFollowUpAccess(actor, meeting.employeeId);
  const scheduledAt = new Date(input.scheduledAt);
  if (Number.isNaN(scheduledAt.getTime())) throw new AppError("A valid date and time is required", 400);
  const endAt = new Date(scheduledAt.getTime() + 45 * 60 * 1000);

  const pending = meeting.rescheduleRequests.find((row) => row.status === RescheduleRequestStatus.PENDING);
  await prisma.$transaction(async (tx) => {
    await tx.meeting.update({
      where: { id: meetingId },
      data: {
        previousScheduledAt: meeting.scheduledAt,
        previousEndAt: meeting.endAt,
        scheduledAt,
        endAt,
        status: MeetingStatus.RESCHEDULED,
      },
    });
    if (pending) {
      await tx.meetingRescheduleRequest.update({
        where: { id: pending.id },
        data: {
          status: RescheduleRequestStatus.APPROVED,
          reviewedById: actor.id,
          reviewedAt: new Date(),
          reviewNote: input.reviewNote?.trim() || "Rescheduled by supervisor",
        },
      });
    }
    await tx.meetingParticipant.updateMany({
      where: { meetingId, employeeId: meeting.employeeId },
      data: { response: MeetingParticipantResponse.PENDING, respondedAt: null },
    });
  });
  await createNotification({
    type: NotificationType.MEETING_RESCHEDULED,
    title: "Follow-up meeting rescheduled",
    message: "Your supervisor updated the follow-up meeting date and time.",
    recipientId: meeting.employeeId,
    subjectEmployeeId: meeting.employeeId,
  });
  return getEmployeeFollowUps(actor, meeting.employeeId);
}
