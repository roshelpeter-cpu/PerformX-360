import {
  MeetingParticipantResponse,
  MeetingParticipantRole,
  MeetingStatus,
  MeetingType,
  NotificationType,
  Prisma,
  Role,
} from "../../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { createNotification } from "./notification.service.js";
import { AppError } from "../utils/errors.js";
import type {
  PlanningListQuery,
  PlanningNotesInput,
  ReschedulePlanningMeetingInput,
  RespondPlanningMeetingInput,
  SchedulePlanningMeetingInput,
} from "../validations/meeting.validation.js";

type Actor = { id: string; role: Role };

const personSelect = {
  id: true,
  employeeId: true,
  name: true,
  jobTitle: true,
  companyEmail: true,
  role: true,
} satisfies Prisma.EmployeeSelect;

const meetingInclude = {
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
  participants: { include: { employee: { select: personSelect } } },
  notes: { include: { createdBy: { select: personSelect } } },
  rescheduleRequests: { orderBy: { createdAt: "desc" as const } },
} satisfies Prisma.MeetingInclude;

type MeetingRecord = Prisma.MeetingGetPayload<{ include: typeof meetingInclude }>;

async function supervisedEmployeeIds(supervisorId: string) {
  const teams = await prisma.team.findMany({
    where: { supervisorId },
    select: { id: true },
  });
  const members = await prisma.employee.findMany({
    where: { role: Role.EMPLOYEE, deactivatedAt: null, teamId: { in: teams.map((team) => team.id) } },
    select: { id: true },
  });
  return new Set(members.map((member) => member.id));
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
  if (actor.role === Role.HR_MANAGER || actor.role === Role.LEADERSHIP) return;
  if (actor.id === employeeId) return;
  if (actor.role === Role.SUPERVISOR) {
    const ids = await supervisedEmployeeIds(actor.id);
    if (!ids.has(employeeId)) throw new AppError("You can only manage meetings for your team", 403);
    return;
  }
  if (actor.role === Role.HR) {
    const ids = await hrScopeEmployeeIds(actor.id);
    if (!ids.has(employeeId)) throw new AppError("You can only access meetings in your HR scope", 403);
    return;
  }
  throw new AppError("You do not have permission to access this meeting", 403);
}

async function assertCanAccessMeeting(actor: Actor, meeting: MeetingRecord) {
  if (actor.role === Role.HR_MANAGER || actor.role === Role.LEADERSHIP) return;
  if (actor.id === meeting.employeeId) return;
  if (meeting.supervisorId && actor.id === meeting.supervisorId) return;
  if (meeting.participants.some((participant) => participant.employeeId === actor.id)) return;
  await assertCanAccessEmployee(actor, meeting.employeeId);
}

function combineDateTime(date: string, time: string) {
  const value = new Date(`${date}T${time}`);
  if (Number.isNaN(value.getTime())) throw new AppError("Invalid date or time", 400);
  return value;
}

function formatMeetingWhen(scheduledAt: Date) {
  return scheduledAt.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function mapResponse(value: MeetingParticipantResponse | null | undefined) {
  if (!value) return "PENDING";
  if (value === MeetingParticipantResponse.REJECTED) return "DECLINED";
  return value;
}

function mapHrResponse(
  participant: MeetingRecord["participants"][number] | undefined,
  invited: boolean
) {
  if (!invited) return "NOT_INVITED";
  if (!participant) return "PENDING";
  return mapResponse(participant.response);
}

function canViewNotes(actor: Actor, meeting: MeetingRecord) {
  if (actor.role === Role.HR_MANAGER || actor.role === Role.LEADERSHIP || actor.role === Role.HR) {
    return true;
  }
  if (meeting.supervisorId && actor.id === meeting.supervisorId) return true;
  if (actor.id === meeting.employeeId) return true;
  return meeting.participants.some((participant) => participant.employeeId === actor.id);
}

function emptySection() {
  return { context: "", discussion: "", decisions: "", actions: "" };
}

function parseNoteSections(value: Prisma.JsonValue | null | undefined) {
  const fallback = {
    previousAppraisal: emptySection(),
    previousPdp: emptySection(),
    strengthsWeaknesses: emptySection(),
    departmentObjectives: emptySection(),
    companyObjectives: emptySection(),
    developmentNeeds: emptySection(),
  };
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  const record = value as Record<string, unknown>;
  const read = (key: keyof typeof fallback) => {
    const section = record[key];
    if (!section || typeof section !== "object" || Array.isArray(section)) return emptySection();
    const item = section as Record<string, unknown>;
    return {
      context: typeof item.context === "string" ? item.context : "",
      discussion: typeof item.discussion === "string" ? item.discussion : "",
      decisions: typeof item.decisions === "string" ? item.decisions : "",
      actions: typeof item.actions === "string" ? item.actions : "",
    };
  };
  return {
    previousAppraisal: read("previousAppraisal"),
    previousPdp: read("previousPdp"),
    strengthsWeaknesses: read("strengthsWeaknesses"),
    departmentObjectives: read("departmentObjectives"),
    companyObjectives: read("companyObjectives"),
    developmentNeeds: read("developmentNeeds"),
  };
}

function serializeMeeting(meeting: MeetingRecord, actor: Actor) {
  const employeeParticipant = meeting.participants.find(
    (participant) =>
      participant.participantRole === MeetingParticipantRole.EMPLOYEE &&
      participant.employeeId === meeting.employeeId
  );
  const hrParticipant = meeting.participants.find(
    (participant) => participant.participantRole === MeetingParticipantRole.HR
  );
  const openReschedule = meeting.rescheduleRequests.find((request) => request.status === "PENDING");
  const notes = canViewNotes(actor, meeting) ? meeting.notes : null;

  return {
    id: meeting.id,
    type: meeting.type,
    title: meeting.title,
    description: meeting.description,
    location: meeting.location,
    status: meeting.status,
    scheduledAt: meeting.scheduledAt.toISOString(),
    endAt: meeting.endAt.toISOString(),
    previousScheduledAt: meeting.previousScheduledAt?.toISOString() ?? null,
    employee: {
      id: meeting.employee.id,
      employeeId: meeting.employee.employeeId,
      name: meeting.employee.name,
      jobTitle: meeting.employee.jobTitle,
      department: meeting.employee.department,
    },
    supervisor: meeting.supervisor,
    cycle: meeting.cycle,
    participants: meeting.participants.map((participant) => ({
      id: participant.id,
      role: participant.participantRole,
      response: mapResponse(participant.response),
      responseMessage: participant.responseMessage,
      respondedAt: participant.respondedAt?.toISOString() ?? null,
      employee: participant.employee,
    })),
    employeeResponse: mapResponse(employeeParticipant?.response),
    employeeReason: employeeParticipant?.responseMessage ?? null,
    hrInvited: Boolean(hrParticipant),
    hrResponse: mapHrResponse(hrParticipant, Boolean(hrParticipant)),
    hrReason: hrParticipant?.responseMessage ?? null,
    hrParticipant: hrParticipant?.employee ?? null,
    rescheduleReason: openReschedule?.reason ?? employeeParticipant?.responseMessage ?? null,
    notes: notes
      ? {
          sections: parseNoteSections(notes.actionItemsList),
          recordedBy: notes.createdBy,
          recordedAt: notes.updatedAt.toISOString(),
        }
      : null,
    canViewNotes: canViewNotes(actor, meeting),
    canRespondAsEmployee:
      actor.id === meeting.employeeId &&
      meeting.status !== MeetingStatus.COMPLETED &&
      meeting.status !== MeetingStatus.CANCELLED,
    canRespondAsHr:
      Boolean(hrParticipant && hrParticipant.employeeId === actor.id) &&
      meeting.status !== MeetingStatus.COMPLETED &&
      meeting.status !== MeetingStatus.CANCELLED,
    canReschedule:
      Boolean(meeting.supervisorId && actor.id === meeting.supervisorId) &&
      meeting.status !== MeetingStatus.COMPLETED &&
      meeting.status !== MeetingStatus.CANCELLED,
    canEditNotes: Boolean(meeting.supervisorId && actor.id === meeting.supervisorId),
  };
}

async function notify(params: {
  recipientId: string;
  type: NotificationType;
  title: string;
  message: string;
  subjectEmployeeId: string;
  meetingId: string;
}) {
  await createNotification({
    type: params.type,
    title: params.title,
    message: params.message,
    recipientId: params.recipientId,
    subjectEmployeeId: params.subjectEmployeeId,
    metadata: {
      meetingId: params.meetingId,
      meetingType: MeetingType.PERFORMANCE_PLANNING,
    },
  });
}

async function loadMeeting(meetingId: string) {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: meetingInclude,
  });
  if (!meeting || meeting.type !== MeetingType.PERFORMANCE_PLANNING) {
    throw new AppError("Meeting not found", 404);
  }
  return meeting;
}

async function resolveActiveCycle(cycleId?: string) {
  const select = { id: true, name: true, startDate: true, endDate: true, status: true } as const;
  if (cycleId) {
    const cycle = await prisma.appraisalCycle.findUnique({
      where: { id: cycleId },
      select,
    });
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

async function latestOutcome(employeeId: string, beforeDate?: Date) {
  return prisma.appraisalOutcome.findFirst({
    where: {
      employeeId,
      ...(beforeDate ? { cycle: { startDate: { lt: beforeDate } } } : {}),
    },
    include: {
      cycle: { select: { id: true, name: true, startDate: true, endDate: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

async function latestPdp(employeeId: string, beforeDate?: Date) {
  return prisma.personalDevelopmentPlan.findFirst({
    where: {
      employeeId,
      ...(beforeDate ? { cycle: { startDate: { lt: beforeDate } } } : {}),
    },
    include: {
      cycle: { select: { id: true, name: true, startDate: true, endDate: true } },
      goals: { orderBy: { sortOrder: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });
}

async function loadPlanningContext(employeeId: string, departmentId: string | null, cycleStart?: Date, cycleId?: string) {
  const [previousAppraisal, previousPdp, companyObjectives, departmentObjectives, previousMeeting] = await Promise.all([
    latestOutcome(employeeId, cycleStart),
    latestPdp(employeeId, cycleStart),
    prisma.companyObjective.findMany({
      where: cycleId ? { OR: [{ cycleId }, { cycleId: null }] } : {},
      orderBy: { createdAt: "asc" },
      take: 8,
    }),
    departmentId
      ? prisma.departmentObjective.findMany({
          where: {
            departmentId,
            ...(cycleId ? { OR: [{ cycleId }, { cycleId: null }] } : {}),
          },
          orderBy: { createdAt: "asc" },
          take: 8,
        })
      : Promise.resolve([]),
    prisma.meeting.findFirst({
      where: {
        employeeId,
        type: MeetingType.PERFORMANCE_PLANNING,
        status: MeetingStatus.COMPLETED,
        ...(cycleStart ? { cycle: { startDate: { lt: cycleStart } } } : {}),
      },
      include: {
        notes: true,
        cycle: { select: { id: true, name: true } },
      },
      orderBy: { scheduledAt: "desc" },
    }),
  ]);

  const previousSections = parseNoteSections(previousMeeting?.notes?.actionItemsList);
  const strengths = [previousAppraisal?.achievements, previousAppraisal?.areasForImprovement]
    .filter(Boolean)
    .join("\n");
  const development = [previousAppraisal?.developmentRecommendations, previousAppraisal?.areasForImprovement]
    .filter(Boolean)
    .join("\n");

  const previousMeetingNotes = previousMeeting?.notes
    ? {
        scheduledAt: previousMeeting.scheduledAt.toISOString(),
        cycleName: previousMeeting.cycle?.name ?? null,
        sections: parseNoteSections(previousMeeting.notes.actionItemsList),
      }
    : null;

  return {
    previousAppraisal,
    previousPdp,
    companyObjectives,
    departmentObjectives,
    previousMeetingNotes,
    noteContext: {
      previousAppraisal: previousAppraisal
        ? `${previousAppraisal.cycle.name}: ${previousAppraisal.overallResult}${previousAppraisal.overallScore != null ? ` (${previousAppraisal.overallScore})` : ""}. ${previousAppraisal.supervisorComments ?? ""}`
        : "",
      previousPdp: previousPdp
        ? `${previousPdp.cycle.name} · ${previousPdp.status}. ${previousPdp.summary ?? ""}\n${previousPdp.goals.map((goal) => `${goal.title}: ${goal.progress}%`).join("\n")}`
        : "",
      strengthsWeaknesses: strengths,
      departmentObjectives: departmentObjectives.map((item) => `${item.title}: ${item.description ?? ""}`).join("\n"),
      companyObjectives: companyObjectives.map((item) => `${item.title}: ${item.description ?? ""}`).join("\n"),
      developmentNeeds: development || previousSections.developmentNeeds.decisions,
    },
  };
}

async function scopedEmployeeWhere(actor: Actor, query: PlanningListQuery) {
  const where: Prisma.EmployeeWhereInput = { role: Role.EMPLOYEE, deactivatedAt: null };
  if (actor.role === Role.SUPERVISOR) {
    where.id = { in: [...(await supervisedEmployeeIds(actor.id))] };
  } else if (actor.role === Role.HR) {
    where.id = { in: [...(await hrScopeEmployeeIds(actor.id))] };
  } else if (actor.role === Role.EMPLOYEE) {
    where.id = actor.id;
  }
  if (query.departmentId) where.departmentId = query.departmentId;
  if (query.supervisorId) where.team = { supervisorId: query.supervisorId };
  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: "insensitive" } },
      { employeeId: { contains: query.search, mode: "insensitive" } },
      { companyEmail: { contains: query.search, mode: "insensitive" } },
    ];
  }
  return where;
}

export async function listPlanningMeetings(actor: Actor, query: PlanningListQuery) {
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
          supervisor: { select: personSelect },
          hrAssignments: {
            include: { hrEmployee: { select: personSelect } },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const meetings = await prisma.meeting.findMany({
    where: {
      type: MeetingType.PERFORMANCE_PLANNING,
      cycleId: cycle.id,
      employeeId: { in: employees.map((employee) => employee.id) },
      status: { not: MeetingStatus.CANCELLED },
    },
    include: meetingInclude,
    orderBy: { scheduledAt: "desc" },
  });

  const meetingByEmployee = new Map<string, MeetingRecord>();
  for (const meeting of meetings) {
    if (!meetingByEmployee.has(meeting.employeeId)) meetingByEmployee.set(meeting.employeeId, meeting);
  }

  const rows = employees.map((employee) => {
    const meeting = meetingByEmployee.get(employee.id) ?? null;
    const status = meeting?.status ?? "NOT_SCHEDULED";
    return {
      employee: {
        id: employee.id,
        employeeId: employee.employeeId,
        name: employee.name,
        jobTitle: employee.jobTitle,
        department: employee.department,
        supervisor: employee.team?.supervisor ?? null,
        hr: employee.team?.hrAssignments[0]?.hrEmployee ?? null,
      },
      meeting: meeting ? serializeMeeting(meeting, actor) : null,
      status,
    };
  });

  const filtered = query.status
    ? rows.filter((row) => {
        if (query.status === "PENDING_RESPONSE") {
          return row.meeting?.employeeResponse === "PENDING" && row.status === MeetingStatus.SCHEDULED;
        }
        return row.status === query.status;
      })
    : rows;

  const kpis = {
    totalEmployees: rows.length,
    completed: rows.filter((row) => row.status === MeetingStatus.COMPLETED).length,
    scheduled: rows.filter((row) => row.status === MeetingStatus.SCHEDULED).length,
    pendingEmployeeResponse: rows.filter(
      (row) => row.meeting?.employeeResponse === "PENDING" && row.status === MeetingStatus.SCHEDULED
    ).length,
    rescheduleRequested: rows.filter((row) => row.status === MeetingStatus.RESCHEDULE_REQUESTED).length,
    notScheduled: rows.filter((row) => row.status === "NOT_SCHEDULED").length,
  };

  const start = (page - 1) * pageSize;
  return {
    cycle,
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

export async function getPlanningOptions(actor: Actor) {
  const cycle = await resolveActiveCycle();
  const employeeWhere = await scopedEmployeeWhere(actor, {});
  const employees = await prisma.employee.findMany({
    where: employeeWhere,
    include: {
      department: { select: { id: true, name: true } },
      team: {
        select: {
          supervisor: { select: personSelect },
          hrAssignments: {
            include: { hrEmployee: { select: personSelect } },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const cycles = await prisma.appraisalCycle.findMany({
    orderBy: { startDate: "desc" },
    select: { id: true, name: true, startDate: true, endDate: true, status: true },
  });
  const departments = await prisma.department.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const supervisors = await prisma.employee.findMany({
    where: { role: Role.SUPERVISOR },
    select: personSelect,
    orderBy: { name: "asc" },
  });

  return {
    cycle,
    cycles,
    departments,
    supervisors: actor.role === Role.SUPERVISOR ? supervisors.filter((item) => item.id === actor.id) : supervisors,
    employees: employees.map((employee) => ({
      id: employee.id,
      employeeId: employee.employeeId,
      name: employee.name,
      jobTitle: employee.jobTitle,
      department: employee.department,
      supervisor: employee.team?.supervisor ?? null,
      hr: employee.team?.hrAssignments[0]?.hrEmployee ?? null,
    })),
  };
}

export async function getPlanningMeeting(actor: Actor, meetingId: string) {
  const meeting = await loadMeeting(meetingId);
  await assertCanAccessMeeting(actor, meeting);
  const context = await loadPlanningContext(
    meeting.employeeId,
    meeting.employee.department?.id ?? null,
    meeting.cycle?.startDate,
    meeting.cycleId ?? meeting.cycle?.id
  );
  return {
    meeting: serializeMeeting(meeting, actor),
    previousAppraisal: context.previousAppraisal,
    previousPdp: context.previousPdp,
    companyObjectives: context.companyObjectives,
    departmentObjectives: context.departmentObjectives,
    previousMeetingNotes: context.previousMeetingNotes,
    noteContext: context.noteContext,
  };
}

export async function getPreviousAppraisal(actor: Actor, employeeId: string) {
  await assertCanAccessEmployee(actor, employeeId);
  const cycle = await resolveActiveCycle();
  const previousAppraisal = await latestOutcome(employeeId, cycle.startDate);
  return { previousAppraisal };
}

export async function schedulePlanningMeeting(actor: Actor, input: SchedulePlanningMeetingInput) {
  if (actor.role !== Role.SUPERVISOR) {
    throw new AppError("Only a supervisor can schedule performance planning meetings", 403);
  }
  await assertCanAccessEmployee(actor, input.employeeId);

  const employee = await prisma.employee.findUnique({
    where: { id: input.employeeId },
    include: {
      team: {
        include: {
          supervisor: { select: { id: true, name: true } },
          hrAssignments: {
            include: { hrEmployee: { select: personSelect } },
          },
        },
      },
    },
  });
  if (!employee) throw new AppError("Employee not found", 404);

  const cycle = await resolveActiveCycle(input.cycleId);
  const existing = await prisma.meeting.findFirst({
    where: {
      employeeId: employee.id,
      cycleId: cycle.id,
      type: MeetingType.PERFORMANCE_PLANNING,
      status: { not: MeetingStatus.CANCELLED },
    },
  });
  if (existing) throw new AppError("A performance planning meeting already exists for this employee", 409);

  const scheduledAt = combineDateTime(input.date, input.startTime);
  const endAt = combineDateTime(input.date, input.endTime);
  if (endAt <= scheduledAt) throw new AppError("End time must be after start time", 400);

  const teamHr = employee.team?.hrAssignments[0]?.hrEmployee ?? null;
  const hrEmployeeId = input.hrEmployeeId || teamHr?.id || null;
  if (hrEmployeeId) {
    const hr = await prisma.employee.findUnique({ where: { id: hrEmployeeId }, select: { id: true, role: true } });
    if (!hr || (hr.role !== Role.HR && hr.role !== Role.HR_MANAGER)) {
      throw new AppError("Selected HR representative is invalid", 400);
    }
  }

  const meeting = await prisma.meeting.create({
    data: {
      type: MeetingType.PERFORMANCE_PLANNING,
      title: `Performance Planning Meeting — ${employee.name}`,
      description: input.agenda?.trim() || "Initial performance planning meeting for the current appraisal cycle.",
      employeeId: employee.id,
      supervisorId: actor.id,
      createdById: actor.id,
      cycleId: cycle.id,
      scheduledAt,
      endAt,
      location: input.location,
      status: MeetingStatus.SCHEDULED,
      participants: {
        create: [
          {
            employeeId: actor.id,
            participantRole: MeetingParticipantRole.SUPERVISOR,
            response: MeetingParticipantResponse.ACCEPTED,
            respondedAt: new Date(),
          },
          {
            employeeId: employee.id,
            participantRole: MeetingParticipantRole.EMPLOYEE,
            response: MeetingParticipantResponse.PENDING,
          },
          ...(hrEmployeeId
            ? [
                {
                  employeeId: hrEmployeeId,
                  participantRole: MeetingParticipantRole.HR,
                  response: MeetingParticipantResponse.PENDING,
                },
              ]
            : []),
        ],
      },
    },
    include: meetingInclude,
  });

  const when = formatMeetingWhen(scheduledAt);
  const hrName = teamHr?.name ?? "Not assigned";
  const invitationMessage = [
    "Performance Planning Meeting invitation.",
    `Supervisor: ${meeting.supervisor?.name ?? "Your supervisor"}.`,
    `HR responsible: ${hrName}.`,
    `Date & time: ${when}.`,
    `Location: ${input.location}.`,
    `Appraisal cycle: ${cycle.name}.`,
    input.agenda?.trim() ? `Agenda: ${input.agenda.trim()}` : null,
    "Your response is required — please accept or request a reschedule.",
  ]
    .filter(Boolean)
    .join(" ");
  await notify({
    recipientId: employee.id,
    type: NotificationType.MEETING_INVITATION,
    title: "Performance Planning Meeting — response required",
    message: invitationMessage,
    subjectEmployeeId: employee.id,
    meetingId: meeting.id,
  });
  await notify({
    recipientId: actor.id,
    type: NotificationType.MEETING_CONFIRMED,
    title: "Performance planning meeting scheduled",
    message: `You scheduled a performance planning meeting with ${employee.name} on ${when}.`,
    subjectEmployeeId: employee.id,
    meetingId: meeting.id,
  });
  if (hrEmployeeId) {
    await notify({
      recipientId: hrEmployeeId,
      type: NotificationType.MEETING_INVITATION,
      title: "Optional performance planning invitation",
      message: `You are invited to the performance planning meeting for ${employee.name} on ${when}. Attendance is optional.`,
      subjectEmployeeId: employee.id,
      meetingId: meeting.id,
    });
  }

  return serializeMeeting(meeting, actor);
}

export async function reschedulePlanningMeeting(
  actor: Actor,
  meetingId: string,
  input: ReschedulePlanningMeetingInput
) {
  const meeting = await loadMeeting(meetingId);
  await assertCanAccessMeeting(actor, meeting);
  if (meeting.supervisorId !== actor.id) {
    throw new AppError("Only the supervisor can reschedule this meeting", 403);
  }

  const scheduledAt = combineDateTime(input.date, input.startTime);
  const endAt = combineDateTime(input.date, input.endTime);
  if (endAt <= scheduledAt) throw new AppError("End time must be after start time", 400);

  const updated = await prisma.$transaction(async (tx) => {
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
      where: {
        meetingId: meeting.id,
        participantRole: { in: [MeetingParticipantRole.EMPLOYEE, MeetingParticipantRole.HR] },
      },
      data: {
        response: MeetingParticipantResponse.PENDING,
        responseMessage: null,
        respondedAt: null,
      },
    });
    await tx.meetingRescheduleRequest.updateMany({
      where: { meetingId: meeting.id, status: "PENDING" },
      data: {
        status: "APPROVED",
        reviewedAt: new Date(),
        reviewedById: actor.id,
        requestedStart: scheduledAt,
        requestedEnd: endAt,
        reviewNote: input.note?.trim() || null,
      },
    });
    return tx.meeting.findUniqueOrThrow({
      where: { id: meeting.id },
      include: meetingInclude,
    });
  });

  const when = formatMeetingWhen(scheduledAt);
  const hr = updated.participants.find(
    (participant) => participant.participantRole === MeetingParticipantRole.HR
  );
  await notify({
    recipientId: updated.employeeId,
    type: NotificationType.MEETING_RESCHEDULED,
    title: "Performance planning meeting rescheduled",
    message: `Your performance planning meeting has been rescheduled to ${when}. Please respond to the new invitation.`,
    subjectEmployeeId: updated.employeeId,
    meetingId: updated.id,
  });
  if (hr) {
    await notify({
      recipientId: hr.employeeId,
      type: NotificationType.MEETING_RESCHEDULED,
      title: "Performance planning meeting rescheduled",
      message: `The performance planning meeting for ${updated.employee.name} has been rescheduled to ${when}.`,
      subjectEmployeeId: updated.employeeId,
      meetingId: updated.id,
    });
  }

  return serializeMeeting(updated, actor);
}

export async function respondToPlanningMeeting(
  actor: Actor,
  meetingId: string,
  input: RespondPlanningMeetingInput
) {
  const meeting = await loadMeeting(meetingId);
  await assertCanAccessMeeting(actor, meeting);
  const participant = meeting.participants.find((item) => item.employeeId === actor.id);
  if (!participant) throw new AppError("You are not a participant in this meeting", 403);
  if (meeting.status === MeetingStatus.COMPLETED || meeting.status === MeetingStatus.CANCELLED) {
    throw new AppError("This meeting can no longer be updated", 400);
  }

  const isEmployee = participant.participantRole === MeetingParticipantRole.EMPLOYEE;
  const isHr = participant.participantRole === MeetingParticipantRole.HR;
  if (!isEmployee && !isHr) throw new AppError("Organizers do not need to respond to this invitation", 400);
  if (isHr && input.decision === "RESCHEDULE") {
    throw new AppError("HR attendance is optional and cannot request a reschedule", 400);
  }
  if ((input.decision === "DECLINE" || input.decision === "RESCHEDULE") && !input.reason?.trim()) {
    throw new AppError("A reason is required", 400);
  }

  const response =
    input.decision === "ACCEPT"
      ? MeetingParticipantResponse.ACCEPTED
      : input.decision === "RESCHEDULE"
        ? MeetingParticipantResponse.RESCHEDULE_REQUESTED
        : MeetingParticipantResponse.REJECTED;

  const nextStatus =
    isEmployee && input.decision === "RESCHEDULE" ? MeetingStatus.RESCHEDULE_REQUESTED : meeting.status;

  await prisma.$transaction(async (tx) => {
    await tx.meetingParticipant.update({
      where: { id: participant.id },
      data: {
        response,
        responseMessage: input.reason?.trim() || null,
        respondedAt: new Date(),
      },
    });
    if (nextStatus !== meeting.status) {
      await tx.meeting.update({ where: { id: meeting.id }, data: { status: nextStatus } });
    }
    if (isEmployee && input.decision === "RESCHEDULE") {
      await tx.meetingRescheduleRequest.create({
        data: {
          meetingId: meeting.id,
          requesterId: actor.id,
          reason: input.reason!.trim(),
          status: "PENDING",
        },
      });
    }
  });

  const refreshed = await loadMeeting(meetingId);
  const when = formatMeetingWhen(refreshed.scheduledAt);
  const hr = refreshed.participants.find((item) => item.participantRole === MeetingParticipantRole.HR);
  const supervisorId = refreshed.supervisorId;

  if (isEmployee && supervisorId) {
    const copy =
      input.decision === "ACCEPT"
        ? `${refreshed.employee.name} accepted the performance planning meeting on ${when}.`
        : input.decision === "RESCHEDULE"
          ? `${refreshed.employee.name} requested a reschedule for the performance planning meeting on ${when}. Reason: ${input.reason}`
          : `${refreshed.employee.name} declined the performance planning meeting on ${when}. Reason: ${input.reason}`;
    const type =
      input.decision === "ACCEPT"
        ? NotificationType.MEETING_RESPONSE
        : input.decision === "RESCHEDULE"
          ? NotificationType.MEETING_RESCHEDULE_REQUEST
          : NotificationType.MEETING_RESPONSE;
    const title =
      input.decision === "ACCEPT"
        ? "Employee accepted the meeting"
        : input.decision === "RESCHEDULE"
          ? "Employee requested a reschedule"
          : "Employee declined the meeting";
    await notify({
      recipientId: supervisorId,
      type,
      title,
      message: copy,
      subjectEmployeeId: refreshed.employeeId,
      meetingId: refreshed.id,
    });
    if (hr) {
      await notify({
        recipientId: hr.employeeId,
        type,
        title,
        message: copy,
        subjectEmployeeId: refreshed.employeeId,
        meetingId: refreshed.id,
      });
    }
  } else if (supervisorId) {
    await notify({
      recipientId: supervisorId,
      type: NotificationType.MEETING_RESPONSE,
      title: input.decision === "ACCEPT" ? "HR will attend the meeting" : "HR will not attend the meeting",
      message:
        input.decision === "ACCEPT"
          ? `${participant.employee.name} accepted the optional invitation for ${refreshed.employee.name}'s performance planning meeting on ${when}.`
          : `${participant.employee.name} declined the optional invitation for ${refreshed.employee.name}'s meeting. The meeting will continue. Reason: ${input.reason}`,
      subjectEmployeeId: refreshed.employeeId,
      meetingId: refreshed.id,
    });
  }

  return serializeMeeting(refreshed, actor);
}

export async function savePlanningNotes(actor: Actor, meetingId: string, input: PlanningNotesInput) {
  const meeting = await loadMeeting(meetingId);
  await assertCanAccessMeeting(actor, meeting);
  if (meeting.supervisorId !== actor.id) {
    throw new AppError("Only the supervisor can record meeting notes", 403);
  }

  const sections = parseNoteSections(input as Prisma.JsonValue);
  const notes = await prisma.meetingNotes.upsert({
    where: { meetingId: meeting.id },
    create: {
      meetingId: meeting.id,
      createdById: actor.id,
      discussionSummary: sections.previousAppraisal.discussion || sections.strengthsWeaknesses.discussion || "",
      keyPoints: sections.previousAppraisal.context,
      decisionsMade: [
        sections.previousAppraisal.decisions,
        sections.previousPdp.decisions,
        sections.developmentNeeds.decisions,
      ].filter(Boolean).join("\n"),
      actionItemsList: sections as Prisma.InputJsonValue,
    },
    update: {
      discussionSummary: sections.previousAppraisal.discussion || sections.strengthsWeaknesses.discussion || "",
      keyPoints: sections.previousAppraisal.context,
      decisionsMade: [
        sections.previousAppraisal.decisions,
        sections.previousPdp.decisions,
        sections.developmentNeeds.decisions,
      ].filter(Boolean).join("\n"),
      actionItemsList: sections as Prisma.InputJsonValue,
    },
  });

  const refreshed = await loadMeeting(meetingId);
  return { meeting: serializeMeeting(refreshed, actor), notesId: notes.id };
}

export async function completePlanningMeeting(actor: Actor, meetingId: string) {
  const meeting = await loadMeeting(meetingId);
  await assertCanAccessMeeting(actor, meeting);
  if (meeting.supervisorId !== actor.id) {
    throw new AppError("Only the supervisor can complete this meeting", 403);
  }
  const updated = await prisma.meeting.update({
    where: { id: meeting.id },
    data: { status: MeetingStatus.COMPLETED },
    include: meetingInclude,
  });
  return serializeMeeting(updated, actor);
}

export async function listEmployeePlanningMeetings(actor: Actor) {
  const meetings = await prisma.meeting.findMany({
    where: {
      type: MeetingType.PERFORMANCE_PLANNING,
      OR: [{ employeeId: actor.id }, { participants: { some: { employeeId: actor.id } } }],
    },
    include: meetingInclude,
    orderBy: { scheduledAt: "desc" },
  });
  const now = Date.now();
  const serialized = meetings.map((meeting) => serializeMeeting(meeting, actor));
  const upcoming = serialized.filter(
    (meeting) =>
      meeting.status !== MeetingStatus.COMPLETED &&
      meeting.status !== MeetingStatus.CANCELLED &&
      new Date(meeting.endAt).getTime() >= now
  );
  const past = serialized.filter((meeting) => !upcoming.some((item) => item.id === meeting.id));
  return { upcoming, past };
}
