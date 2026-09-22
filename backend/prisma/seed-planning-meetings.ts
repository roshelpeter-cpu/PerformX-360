import {
  MeetingParticipantResponse,
  MeetingParticipantRole,
  MeetingStatus,
  MeetingType,
  PrismaClient,
  Role,
} from "../generated/prisma/client.js";

type Db = PrismaClient;

function at(year: number, month: number, day: number, hour: number, minute = 0) {
  return new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
}

function demoNotes(employeeName: string, hrAttended: boolean) {
  return {
    previousAppraisal: {
      context: `${employeeName} met expectations last cycle with a B rating. Delivery was reliable and teamwork was a clear strength.`,
      discussion: "Reviewed last year's result, stakeholder feedback, and how stretch work landed.",
      decisions: "Keep the current role pathway and raise the quality bar on stakeholder communication.",
      actions: "Supervisor to share written feedback summary within one week.",
    },
    previousPdp: {
      context: "Previous PDP focused on documentation quality and one stretch delivery objective.",
      discussion: "Two of three previous objectives were completed. Presentation confidence still needs practice.",
      decisions: "Carry forward communication coaching and replace the completed stretch objective with a new ownership goal.",
      actions: "Employee to update PDP draft after this meeting.",
    },
    strengthsWeaknesses: {
      context: "Strengths: reliability, peer support, technical follow-through. Development: stakeholder updates and documentation discipline.",
      discussion: "Employee recognised the same strengths and asked for earlier exposure to client conversations.",
      decisions: hrAttended
        ? "Supervisor and HR agreed to pair the employee with a mentor for monthly stakeholder briefings."
        : "Supervisor will mentor stakeholder briefings. HR declined attendance and the meeting continued.",
      actions: "Book first mentoring session within two weeks.",
    },
    departmentObjectives: {
      context: "Department objectives emphasise secure delivery, reduced incident rework, and knowledge sharing.",
      discussion: "Employee can contribute through playbook updates and pairing on high-risk changes.",
      decisions: "Assign one knowledge-sharing session per quarter and one playbook improvement this cycle.",
      actions: "Employee to propose playbook topic by end of month.",
    },
    companyObjectives: {
      context: "Company objectives include service reliability, people development, and customer trust.",
      discussion: "Aligned the employee's work to reliability and customer-facing communication.",
      decisions: "Include a measurable reliability contribution in the new PDP.",
      actions: "Add reliability KPI to the upcoming PDP.",
    },
    developmentNeeds: {
      context: "Technical depth is solid. Soft skills and structured communication are the main development needs.",
      discussion: "Employee requested presentation coaching and a clearer path toward senior individual-contributor work.",
      decisions: "Book internal presentation coaching and review progress in the first follow-up meeting.",
      actions: "HR to confirm coaching slot; supervisor to review in 30 days.",
    },
  };
}

type MeetingScenario =
  | { kind: "COMPLETED"; hrAccepted: boolean; hrDeclined?: boolean }
  | { kind: "SCHEDULED"; employeePending?: boolean; employeeAccepted?: boolean; hrPending?: boolean; hrDeclined?: boolean }
  | { kind: "RESCHEDULE_REQUESTED" }
  | { kind: "NOT_SCHEDULED" };

async function ensureObjectives(prisma: Db, cycleId: string, departmentId: string) {
  const companyCount = await prisma.companyObjective.count({ where: { cycleId } });
  if (companyCount === 0) {
    await prisma.companyObjective.createMany({
      data: [
        {
          cycleId,
          title: "Service reliability",
          description: "Reduce severity-1 incidents and improve recovery time across delivery teams.",
        },
        {
          cycleId,
          title: "People development",
          description: "Build coaching, presentation, and succession depth in every team.",
        },
        {
          cycleId,
          title: "Customer trust",
          description: "Improve stakeholder communication quality and delivery predictability.",
        },
      ],
    });
  }

  const deptCount = await prisma.departmentObjective.count({
    where: { departmentId, cycleId },
  });
  if (deptCount === 0) {
    await prisma.departmentObjective.createMany({
      data: [
        {
          departmentId,
          cycleId,
          title: "Secure and reliable delivery",
          description: "Keep change failure rate down and document high-risk procedures.",
        },
        {
          departmentId,
          cycleId,
          title: "Knowledge sharing",
          description: "Run quarterly internal sessions so expertise is not concentrated in a few people.",
        },
      ],
    });
  }
}

async function ensurePreviousAppraisal(
  prisma: Db,
  employeeId: string,
  previousCycleId: string,
  previousBatchId: string | null,
  supervisorId: string
) {
  await prisma.appraisalOutcome.upsert({
    where: { cycleId_employeeId: { cycleId: previousCycleId, employeeId } },
    create: {
      employeeId,
      cycleId: previousCycleId,
      overallResult: "Meets Expectations",
      ratingBand: "B",
      overallScore: 3.4 + Math.random() * 0.8,
      supervisorComments: "Consistent delivery and strong collaboration with the team.",
      developmentRecommendations: "Build presentation confidence and stretch ownership of larger initiatives.",
      achievements: "Delivered assigned cycle objectives on time and supported peer onboarding.",
      areasForImprovement: "Stakeholder communication and documentation discipline.",
      outcomes: "Confirmed in role with a standard increment pathway.",
    },
    update: {},
  });

  if (previousBatchId) {
    await prisma.personalDevelopmentPlan.upsert({
      where: { cycleId_employeeId: { cycleId: previousCycleId, employeeId } },
      create: {
        employeeId,
        supervisorId,
        cycleId: previousCycleId,
        batchId: previousBatchId,
        createdById: supervisorId,
        status: "COMPLETED",
        summary: "Previous-cycle PDP covering delivery quality and communication.",
        goals: {
          create: [
            {
              title: "Improve documentation quality",
              objective: "Keep runbooks current for assigned services.",
              expectedOutcome: "Fewer handover gaps during incidents.",
              progress: 90,
              status: "COMPLETED",
              sortOrder: 1,
            },
            {
              title: "Lead one stretch delivery",
              objective: "Own a mid-sized change from planning through release.",
              expectedOutcome: "Independent ownership with supervisor oversight.",
              progress: 80,
              status: "COMPLETED",
              sortOrder: 2,
            },
          ],
        },
      },
      update: {},
    });
  }
}

async function createPlanningMeeting(
  prisma: Db,
  params: {
    employee: { id: string; name: string };
    supervisorId: string;
    cycleId: string;
    hrId: string | null;
    scenario: Exclude<MeetingScenario, { kind: "NOT_SCHEDULED" }>;
    dayOffset: number;
  }
) {
  const scheduledAt = at(2026, 9, 8 + (params.dayOffset % 20), 8 + (params.dayOffset % 4), 0);
  const endAt = new Date(scheduledAt.getTime() + 60 * 60 * 1000);
  const scenario = params.scenario;

  let status: MeetingStatus = MeetingStatus.SCHEDULED;
  let employeeResponse = MeetingParticipantResponse.PENDING;
  let employeeReason: string | null = null;
  let hrResponse: MeetingParticipantResponse | undefined;
  let hrReason: string | null = null;
  let notes = false;
  let reschedule: string | undefined;

  if (scenario.kind === "COMPLETED") {
    status = MeetingStatus.COMPLETED;
    employeeResponse = MeetingParticipantResponse.ACCEPTED;
    hrResponse = scenario.hrAccepted
      ? MeetingParticipantResponse.ACCEPTED
      : MeetingParticipantResponse.REJECTED;
    if (!scenario.hrAccepted) {
      hrReason = "Conflicting onboarding session; supervisor and employee proceeded.";
    }
    notes = true;
  } else if (scenario.kind === "RESCHEDULE_REQUESTED") {
    status = MeetingStatus.RESCHEDULE_REQUESTED;
    employeeResponse = MeetingParticipantResponse.RESCHEDULE_REQUESTED;
    employeeReason = "Unable to attend because I have another university commitment.";
    hrResponse = MeetingParticipantResponse.PENDING;
    reschedule = employeeReason;
  } else if (scenario.kind === "SCHEDULED") {
    status = MeetingStatus.SCHEDULED;
    employeeResponse = scenario.employeeAccepted
      ? MeetingParticipantResponse.ACCEPTED
      : scenario.employeePending !== false
        ? MeetingParticipantResponse.PENDING
        : MeetingParticipantResponse.ACCEPTED;
    if (scenario.hrDeclined) {
      hrResponse = MeetingParticipantResponse.REJECTED;
      hrReason = "Conflicting onboarding session; supervisor and employee can proceed.";
    } else if (scenario.hrPending) {
      hrResponse = MeetingParticipantResponse.PENDING;
    } else {
      hrResponse = MeetingParticipantResponse.ACCEPTED;
    }
  }

  const meeting = await prisma.meeting.create({
    data: {
      type: MeetingType.PERFORMANCE_PLANNING,
      title: `Performance Planning Meeting — ${params.employee.name}`,
      description: "Initial performance planning meeting for the current appraisal cycle.",
      employeeId: params.employee.id,
      supervisorId: params.supervisorId,
      createdById: params.supervisorId,
      cycleId: params.cycleId,
      scheduledAt,
      endAt,
      location: "Microsoft Teams (Online)",
      status,
      participants: {
        create: [
          {
            employeeId: params.supervisorId,
            participantRole: MeetingParticipantRole.SUPERVISOR,
            response: MeetingParticipantResponse.ACCEPTED,
            respondedAt: new Date(),
          },
          {
            employeeId: params.employee.id,
            participantRole: MeetingParticipantRole.EMPLOYEE,
            response: employeeResponse,
            responseMessage: employeeReason,
            respondedAt: employeeResponse === MeetingParticipantResponse.PENDING ? null : scheduledAt,
          },
          ...(params.hrId
            ? [
                {
                  employeeId: params.hrId,
                  participantRole: MeetingParticipantRole.HR,
                  response: hrResponse ?? MeetingParticipantResponse.PENDING,
                  responseMessage: hrReason,
                  respondedAt:
                    !hrResponse || hrResponse === MeetingParticipantResponse.PENDING ? null : scheduledAt,
                },
              ]
            : []),
        ],
      },
    },
  });

  if (notes) {
    const sections = demoNotes(params.employee.name, hrResponse === MeetingParticipantResponse.ACCEPTED);
    await prisma.meetingNotes.create({
      data: {
        meetingId: meeting.id,
        createdById: params.supervisorId,
        discussionSummary: sections.strengthsWeaknesses.discussion,
        keyPoints: sections.previousAppraisal.context,
        decisionsMade: sections.developmentNeeds.decisions,
        actionItemsList: sections,
      },
    });
  }

  if (reschedule) {
    await prisma.meetingRescheduleRequest.create({
      data: {
        meetingId: meeting.id,
        requesterId: params.employee.id,
        reason: reschedule,
        status: "PENDING",
      },
    });
  }

  return meeting;
}

async function seedDemoSupervisorTeam(prisma: Db, cycleId: string, previousCycleId: string | null, previousBatchId: string | null) {
  const supervisor = await prisma.employee.findUnique({
    where: { employeeId: "SUP000001" },
    include: {
      supervisedTeams: {
        include: {
          department: true,
          hrAssignments: { include: { hrEmployee: true } },
          employees: {
            where: { role: Role.EMPLOYEE, deactivatedAt: null },
            orderBy: { employeeId: "asc" },
          },
        },
      },
    },
  });

  if (!supervisor?.supervisedTeams[0]) {
    console.log("Demo supervisor SUP000001 team not found — skipping targeted demo seed.");
    return;
  }

  const team = supervisor.supervisedTeams[0];
  const hr = team.hrAssignments[0]?.hrEmployee ?? (await prisma.employee.findFirst({ where: { employeeId: "HR000001" } }));
  const members = team.employees;

  await prisma.meeting.deleteMany({
    where: {
      type: MeetingType.PERFORMANCE_PLANNING,
      cycleId,
      employeeId: { in: members.map((member) => member.id) },
    },
  });

  if (previousCycleId && team.departmentId) {
    await ensureObjectives(prisma, cycleId, team.departmentId);
    for (const member of members.slice(0, 8)) {
      await ensurePreviousAppraisal(prisma, member.id, previousCycleId, previousBatchId, supervisor.id);
    }
  }

  const alex = members.find((member) => member.employeeId === "EMP000001") ?? members[0];
  const completed = members.filter((member) => member.id !== alex?.id).slice(0, 4);
  const scheduled = members.find((member) => !completed.some((item) => item.id === member.id) && member.id !== alex?.id);
  const rescheduleMember = members.find(
    (member) =>
      member.id !== alex?.id &&
      !completed.some((item) => item.id === member.id) &&
      member.id !== scheduled?.id
  );

  let dayOffset = 0;
  for (const employee of completed) {
    dayOffset += 1;
    await createPlanningMeeting(prisma, {
      employee,
      supervisorId: supervisor.id,
      cycleId,
      hrId: hr?.id ?? null,
      scenario: dayOffset % 3 === 0 ? { kind: "COMPLETED", hrAccepted: false } : { kind: "COMPLETED", hrAccepted: true },
      dayOffset,
    });
  }

  if (scheduled) {
    await createPlanningMeeting(prisma, {
      employee: scheduled,
      supervisorId: supervisor.id,
      cycleId,
      hrId: hr?.id ?? null,
      scenario: { kind: "SCHEDULED", employeeAccepted: true, hrPending: true },
      dayOffset: dayOffset + 1,
    });
  }

  if (alex) {
    await createPlanningMeeting(prisma, {
      employee: alex,
      supervisorId: supervisor.id,
      cycleId,
      hrId: hr?.id ?? null,
      scenario: { kind: "SCHEDULED", employeePending: true, hrPending: true },
      dayOffset: dayOffset + 2,
    });
  }

  if (rescheduleMember) {
    await createPlanningMeeting(prisma, {
      employee: rescheduleMember,
      supervisorId: supervisor.id,
      cycleId,
      hrId: hr?.id ?? null,
      scenario: { kind: "RESCHEDULE_REQUESTED" },
      dayOffset: dayOffset + 3,
    });
  }

  const hrDeclinedMember = members.find(
    (member) =>
      member.id !== alex?.id &&
      !completed.some((item) => item.id === member.id) &&
      member.id !== scheduled?.id &&
      member.id !== rescheduleMember?.id
  );
  if (hrDeclinedMember) {
    await createPlanningMeeting(prisma, {
      employee: hrDeclinedMember,
      supervisorId: supervisor.id,
      cycleId,
      hrId: hr?.id ?? null,
      scenario: { kind: "SCHEDULED", employeeAccepted: true, hrDeclined: true },
      dayOffset: dayOffset + 4,
    });
  }

  console.log(
    `Demo supervisor ${supervisor.name}: ${completed.length} completed, pending invitation for ${alex?.employeeId ?? "—"}, reschedule for ${rescheduleMember?.employeeId ?? "—"}.`
  );
}

async function seedOrganizationMeetings(prisma: Db, cycleId: string, previousCycleId: string | null, previousBatchId: string | null) {
  const teams = await prisma.team.findMany({
    where: { supervisorId: { not: null } },
    include: {
      supervisor: true,
      department: true,
      hrAssignments: { include: { hrEmployee: true } },
      employees: {
        where: { role: Role.EMPLOYEE, deactivatedAt: null },
        orderBy: { employeeId: "asc" },
      },
    },
  });

  const demoSupervisor = await prisma.employee.findUnique({ where: { employeeId: "SUP000001" }, select: { id: true } });
  const demoTeamEmployeeIds = new Set(
    teams
      .filter((team) => team.supervisorId === demoSupervisor?.id)
      .flatMap((team) => team.employees.map((employee) => employee.id))
  );

  const pool: Array<{
    employee: { id: string; name: string };
    supervisorId: string;
    hrId: string | null;
    departmentId: string;
  }> = [];

  for (const team of teams) {
    if (!team.supervisor) continue;
    for (const employee of team.employees) {
      if (demoTeamEmployeeIds.has(employee.id)) continue;
      pool.push({
        employee: { id: employee.id, name: employee.name },
        supervisorId: team.supervisor.id,
        hrId: team.hrAssignments[0]?.hrEmployee.id ?? null,
        departmentId: team.departmentId,
      });
    }
  }

  await prisma.meeting.deleteMany({
    where: {
      type: MeetingType.PERFORMANCE_PLANNING,
      cycleId,
      employeeId: { in: pool.map((item) => item.employee.id) },
    },
  });

  let completed = 0;
  let scheduled = 0;
  let pending = 0;
  let reschedule = 0;

  const seededDepartments = new Set<string>();
  const meetingTargets: Array<{
    item: (typeof pool)[number];
    scenario: Exclude<MeetingScenario, { kind: "NOT_SCHEDULED" }>;
    dayOffset: number;
  }> = [];

  for (let index = 0; index < pool.length; index += 1) {
    const item = pool[index]!;
    if (item.departmentId && !seededDepartments.has(item.departmentId)) {
      await ensureObjectives(prisma, cycleId, item.departmentId);
      seededDepartments.add(item.departmentId);
    }

    let scenario: MeetingScenario;
    if (completed < 60) {
      scenario = { kind: "COMPLETED", hrAccepted: index % 4 !== 0 };
      completed += 1;
    } else if (scheduled < 12) {
      scenario = { kind: "SCHEDULED", employeeAccepted: true, hrPending: index % 2 === 0 };
      scheduled += 1;
    } else if (pending < 10) {
      scenario = { kind: "SCHEDULED", employeePending: true, hrPending: true };
      pending += 1;
    } else if (reschedule < 8) {
      scenario = { kind: "RESCHEDULE_REQUESTED" };
      reschedule += 1;
    } else {
      continue;
    }

    meetingTargets.push({
      item,
      scenario: scenario as Exclude<MeetingScenario, { kind: "NOT_SCHEDULED" }>,
      dayOffset: index,
    });
  }

  if (previousCycleId) {
    const outcomeRows = meetingTargets.map(({ item }) => ({
      employeeId: item.employee.id,
      cycleId: previousCycleId,
      overallResult: "Meets Expectations",
      ratingBand: "B",
      overallScore: 3.5,
      supervisorComments: "Consistent delivery and strong collaboration with the team.",
      developmentRecommendations: "Build presentation confidence and stretch ownership.",
      achievements: "Delivered assigned cycle objectives on time.",
      areasForImprovement: "Stakeholder communication and documentation discipline.",
      outcomes: "Confirmed in role with a standard increment pathway.",
    }));
    for (let index = 0; index < outcomeRows.length; index += 100) {
      await prisma.appraisalOutcome.createMany({
        data: outcomeRows.slice(index, index + 100),
        skipDuplicates: true,
      });
    }
  }

  for (const target of meetingTargets) {
    await createPlanningMeeting(prisma, {
      ...target.item,
      cycleId,
      scenario: target.scenario,
      dayOffset: target.dayOffset,
    });
  }

  console.log(
    `Organization planning meetings: ${completed} completed, ${scheduled} scheduled (accepted), ${pending} pending response, ${reschedule} reschedule requested; remainder not scheduled.`
  );
}

export async function seedPlanningMeetings(prisma: Db) {
  const cycle = await prisma.appraisalCycle.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { startDate: "desc" },
  });
  if (!cycle) {
    console.log("Skipping planning meetings: no active appraisal cycle.");
    return;
  }

  const previousCycle = await prisma.appraisalCycle.findFirst({
    where: { startDate: { lt: cycle.startDate } },
    orderBy: { startDate: "desc" },
  });
  const previousBatch = previousCycle
    ? await prisma.appraisalBatch.findFirst({ where: { cycleId: previousCycle.id }, orderBy: { batchNumber: "asc" } })
    : null;

  await seedOrganizationMeetings(prisma, cycle.id, previousCycle?.id ?? null, previousBatch?.id ?? null);
  await seedDemoSupervisorTeam(prisma, cycle.id, previousCycle?.id ?? null, previousBatch?.id ?? null);
}
