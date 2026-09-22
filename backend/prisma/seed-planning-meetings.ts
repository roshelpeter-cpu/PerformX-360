import {
  MeetingParticipantResponse,
  MeetingParticipantRole,
  MeetingStatus,
  MeetingType,
  PrismaClient,
  Role,
} from "../generated/prisma/client.js";

type Db = PrismaClient;

/** Schedule relative to "now" so demo invitations stay upcoming after re-seed. */
function daysFromNow(days: number, hour = 10, minute = 0) {
  const value = new Date();
  value.setUTCDate(value.getUTCDate() + days);
  value.setUTCHours(hour, minute, 0, 0);
  return value;
}

const NOTE_VARIANTS: Array<(employeeName: string, hrAttended: boolean) => ReturnType<typeof baseNotes>> = [
  (employeeName, hrAttended) =>
    baseNotes(employeeName, hrAttended, {
      appraisal: `${employeeName} finished last cycle at Meets Expectations (B). Delivery was steady and peer support was frequently mentioned.`,
      appraisalDiscussion: "Walked through last-cycle feedback, stakeholder comments, and stretch assignments that landed well.",
      appraisalDecisions: "Remain on the current role pathway and raise the bar on proactive stakeholder updates.",
      pdp: "Previous PDP focused on documentation quality and one stretch delivery objective.",
      strengths: "Strengths: reliability, peer mentoring, technical follow-through. Gaps: stakeholder cadence and written summaries.",
      dept: "Department priorities: secure delivery, lower rework, and quarterly knowledge sharing.",
      company: "Company focus: service reliability, people development, and customer trust.",
      development: "Presentation coaching and structured communication are the main development needs.",
    }),
  (employeeName, hrAttended) =>
    baseNotes(employeeName, hrAttended, {
      appraisal: `${employeeName} rated Exceeds on delivery quality last cycle, with a note to improve cross-team coordination.`,
      appraisalDiscussion: "Reviewed incident ownership examples and how collaboration with adjacent teams can improve.",
      appraisalDecisions: "Keep technical depth as a strength and add an explicit collaboration objective this cycle.",
      pdp: "Previous PDP covered automation of manual checks and mentoring a junior engineer.",
      strengths: "Strengths: analytical depth, calm under pressure. Gaps: early escalation and meeting facilitation.",
      dept: "Department objectives emphasise fewer severity-1 incidents and reusable runbooks.",
      company: "Aligned role to reliability and internal capability building.",
      development: "Facilitation practice and a short leadership essentials module were agreed.",
    }),
  (employeeName, hrAttended) =>
    baseNotes(employeeName, hrAttended, {
      appraisal: `${employeeName} met expectations with strong customer empathy; documentation lagged in Q4.`,
      appraisalDiscussion: "Discussed customer escalations handled well and where written handovers created follow-up work.",
      appraisalDecisions: "Protect customer-facing strengths while requiring documentation checkpoints before release.",
      pdp: "Previous PDP targeted customer communication templates and one product discovery contribution.",
      strengths: "Strengths: empathy, clarity with customers. Gaps: estimating larger work and saying no early.",
      dept: "Department goals include predictable delivery and clearer discovery notes.",
      company: "Company objectives: customer trust and predictable delivery commitments.",
      development: "Estimation workshop and paired discovery sessions with the product analyst.",
    }),
  (employeeName, hrAttended) =>
    baseNotes(employeeName, hrAttended, {
      appraisal: `${employeeName} delivered solid B+ results with standout peer coaching; independent ownership still growing.`,
      appraisalDiscussion: "Recognised coaching impact and discussed readiness to own a mid-sized initiative end-to-end.",
      appraisalDecisions: "Assign one end-to-end ownership goal and continue peer coaching this cycle.",
      pdp: "Previous PDP included coaching hours and completing a shared component refactor.",
      strengths: "Strengths: coaching, code quality. Gaps: prioritisation when requests conflict.",
      dept: "Department objectives: knowledge sharing and reducing bus factor on critical services.",
      company: "People development and reliability are the company themes for this cycle.",
      development: "Prioritisation coaching with supervisor and a stretch ownership assignment.",
    }),
];

function baseNotes(
  employeeName: string,
  hrAttended: boolean,
  copy: {
    appraisal: string;
    appraisalDiscussion: string;
    appraisalDecisions: string;
    pdp: string;
    strengths: string;
    dept: string;
    company: string;
    development: string;
  }
) {
  return {
    previousAppraisal: {
      context: copy.appraisal,
      discussion: copy.appraisalDiscussion,
      decisions: copy.appraisalDecisions,
      actions: "Supervisor to share a written feedback summary within one week.",
    },
    previousPdp: {
      context: copy.pdp,
      discussion: "Reviewed progress against previous objectives and what should carry forward.",
      decisions: "Carry forward unfinished development themes and close completed objectives.",
      actions: "Employee to refresh the PDP draft after this meeting.",
    },
    strengthsWeaknesses: {
      context: copy.strengths,
      discussion: "Employee agreed with the strengths assessment and asked for clearer stretch opportunities.",
      decisions: hrAttended
        ? "Supervisor and HR agreed a mentoring arrangement to support the development areas."
        : "Supervisor will mentor the development areas. HR declined attendance and the meeting continued.",
      actions: "Book the first mentoring / coaching session within two weeks.",
    },
    departmentObjectives: {
      context: copy.dept,
      discussion: `Discussed how ${employeeName} can contribute to the department plan this cycle.`,
      decisions: "Assign at least one measurable department contribution in the new PDP.",
      actions: "Employee to propose a contribution topic by end of month.",
    },
    companyObjectives: {
      context: copy.company,
      discussion: "Mapped the employee role to the relevant company objectives.",
      decisions: "Include an explicit alignment statement in the PDP summary.",
      actions: "Add the alignment note when the PDP is drafted.",
    },
    developmentNeeds: {
      context: copy.development,
      discussion: "Agreed near-term skills support and how progress will be reviewed.",
      decisions: "Confirm training / coaching support and review in the first follow-up meeting.",
      actions: hrAttended
        ? "HR to help confirm the support slot; supervisor to review in 30 days."
        : "Supervisor to confirm the support slot and review in 30 days.",
    },
    decisionsActions: {
      context: "Final agreed outcomes from the performance planning discussion.",
      discussion: "Confirmed role expectations for the cycle and agreed the development focus areas.",
      decisions: "Proceed with a PDP that reflects the strengths, gaps, and objective alignment above.",
      actions: `Supervisor owns the PDP draft; ${employeeName} prepares examples; target review in 30 days.`,
    },
  };
}

function demoNotes(employeeName: string, hrAttended: boolean, variant = 0) {
  const factory = NOTE_VARIANTS[variant % NOTE_VARIANTS.length]!;
  return factory(employeeName, hrAttended);
}

type MeetingScenario =
  | { kind: "COMPLETED"; hrAccepted: boolean; hrDeclined?: boolean; variant?: number }
  | {
      kind: "SCHEDULED";
      employeePending?: boolean;
      employeeAccepted?: boolean;
      hrPending?: boolean;
      hrDeclined?: boolean;
      hrAccepted?: boolean;
      daysAhead?: number;
    }
  | { kind: "RESCHEDULE_REQUESTED"; hrAccepted?: boolean; daysAhead?: number }
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

/** Ensure demo HR (Nur Aisyah) owns the demo supervisor team for consistent multi-role demos. */
async function ensureDemoHrOwnsSupervisorTeam(prisma: Db) {
  const supervisor = await prisma.employee.findUnique({
    where: { employeeId: "SUP000001" },
    include: { supervisedTeams: { select: { id: true } } },
  });
  const hr = await prisma.employee.findUnique({ where: { employeeId: "HR000001" } });
  const teamId = supervisor?.supervisedTeams[0]?.id;
  if (!teamId || !hr) return;

  await prisma.hrTeamAssignment.deleteMany({ where: { teamId } });
  await prisma.hrTeamAssignment.create({
    data: { teamId, hrEmployeeId: hr.id },
  });
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
  const scenario = params.scenario;
  const isCompleted = scenario.kind === "COMPLETED";
  const daysAhead =
    scenario.kind === "COMPLETED"
      ? -(10 + (params.dayOffset % 8))
      : "daysAhead" in scenario && scenario.daysAhead != null
        ? scenario.daysAhead
        : 3 + (params.dayOffset % 14);
  const hour = 8 + (params.dayOffset % 4);
  const scheduledAt = daysFromNow(daysAhead, hour, 0);
  const endAt = new Date(scheduledAt.getTime() + 60 * 60 * 1000);

  let status: MeetingStatus = MeetingStatus.SCHEDULED;
  let employeeResponse = MeetingParticipantResponse.PENDING;
  let employeeReason: string | null = null;
  let hrResponse: MeetingParticipantResponse | undefined;
  let hrReason: string | null = null;
  let notes = false;
  let reschedule: string | undefined;
  let noteVariant = 0;

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
    noteVariant = scenario.variant ?? params.dayOffset;
  } else if (scenario.kind === "RESCHEDULE_REQUESTED") {
    status = MeetingStatus.RESCHEDULE_REQUESTED;
    employeeResponse = MeetingParticipantResponse.RESCHEDULE_REQUESTED;
    employeeReason =
      "Unable to attend the proposed slot because of a conflicting university / client commitment. Please move to another afternoon this week.";
    hrResponse =
      scenario.hrAccepted === false
        ? MeetingParticipantResponse.PENDING
        : MeetingParticipantResponse.ACCEPTED;
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
    } else if (scenario.hrAccepted === false) {
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
    const sections = demoNotes(
      params.employee.name,
      hrResponse === MeetingParticipantResponse.ACCEPTED,
      noteVariant
    );
    await prisma.meetingNotes.create({
      data: {
        meetingId: meeting.id,
        createdById: params.supervisorId,
        discussionSummary: sections.strengthsWeaknesses.discussion,
        keyPoints: sections.previousAppraisal.context,
        decisionsMade: sections.developmentNeeds.decisions,
        actionItems: sections.decisionsActions.actions,
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

async function seedDemoSupervisorTeam(
  prisma: Db,
  cycleId: string,
  previousCycleId: string | null,
  previousBatchId: string | null
) {
  await ensureDemoHrOwnsSupervisorTeam(prisma);

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
  const hr =
    team.hrAssignments[0]?.hrEmployee ??
    (await prisma.employee.findFirst({ where: { employeeId: "HR000001" } }));
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
    for (const member of members) {
      await ensurePreviousAppraisal(prisma, member.id, previousCycleId, previousBatchId, supervisor.id);
    }
  }

  const alex = members.find((member) => member.employeeId === "EMP000001") ?? members[0];
  const others = members.filter((member) => member.id !== alex?.id);

  // Target mix for supervisor demo (≥10 team members when org seed sized teams correctly):
  // 4 completed · 2 scheduled (accepted) · 1 pending employee (Alex) · 1 reschedule · 1 HR declined · rest not scheduled
  const completed = others.slice(0, 4);
  const scheduledAcceptedHrPending = others[4];
  const scheduledAcceptedHrAccepted = others[5];
  const rescheduleMember = others[6];
  const hrDeclinedMember = others[7];
  // others[8+] remain NOT_SCHEDULED

  let dayOffset = 0;
  for (let index = 0; index < completed.length; index += 1) {
    const employee = completed[index]!;
    dayOffset += 1;
    await createPlanningMeeting(prisma, {
      employee,
      supervisorId: supervisor.id,
      cycleId,
      hrId: hr?.id ?? null,
      scenario: {
        kind: "COMPLETED",
        hrAccepted: index !== 2,
        variant: index,
      },
      dayOffset,
    });
  }

  if (scheduledAcceptedHrPending) {
    await createPlanningMeeting(prisma, {
      employee: scheduledAcceptedHrPending,
      supervisorId: supervisor.id,
      cycleId,
      hrId: hr?.id ?? null,
      scenario: { kind: "SCHEDULED", employeeAccepted: true, hrPending: true, daysAhead: 5 },
      dayOffset: dayOffset + 1,
    });
  }

  if (scheduledAcceptedHrAccepted) {
    await createPlanningMeeting(prisma, {
      employee: scheduledAcceptedHrAccepted,
      supervisorId: supervisor.id,
      cycleId,
      hrId: hr?.id ?? null,
      scenario: { kind: "SCHEDULED", employeeAccepted: true, hrAccepted: true, daysAhead: 8 },
      dayOffset: dayOffset + 2,
    });
  }

  if (alex) {
    await createPlanningMeeting(prisma, {
      employee: alex,
      supervisorId: supervisor.id,
      cycleId,
      hrId: hr?.id ?? null,
      scenario: { kind: "SCHEDULED", employeePending: true, hrPending: true, daysAhead: 4 },
      dayOffset: dayOffset + 3,
    });
  }

  if (rescheduleMember) {
    await createPlanningMeeting(prisma, {
      employee: rescheduleMember,
      supervisorId: supervisor.id,
      cycleId,
      hrId: hr?.id ?? null,
      scenario: { kind: "RESCHEDULE_REQUESTED", hrAccepted: true, daysAhead: 6 },
      dayOffset: dayOffset + 4,
    });
  }

  if (hrDeclinedMember) {
    await createPlanningMeeting(prisma, {
      employee: hrDeclinedMember,
      supervisorId: supervisor.id,
      cycleId,
      hrId: hr?.id ?? null,
      scenario: { kind: "SCHEDULED", employeeAccepted: true, hrDeclined: true, daysAhead: 10 },
      dayOffset: dayOffset + 5,
    });
  }

  // Leave remaining team members NOT_SCHEDULED so supervisors can demo scheduling.
  const scheduledIds = new Set(
    [
      ...completed.map((member) => member.id),
      scheduledAcceptedHrPending?.id,
      scheduledAcceptedHrAccepted?.id,
      alex?.id,
      rescheduleMember?.id,
      hrDeclinedMember?.id,
    ].filter(Boolean) as string[]
  );
  const notScheduledCount = members.filter((member) => !scheduledIds.has(member.id)).length;

  console.log(
    `Demo supervisor ${supervisor.name} (${members.length} employees): ${completed.length} completed, ` +
      `pending invitation for ${alex?.employeeId ?? "—"}, reschedule for ${rescheduleMember?.employeeId ?? "—"}, ` +
      `${notScheduledCount} not scheduled. HR in charge: ${hr?.employeeId ?? "—"}.`
  );
}

async function seedOrganizationMeetings(
  prisma: Db,
  cycleId: string,
  previousCycleId: string | null,
  previousBatchId: string | null
) {
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

  const demoSupervisor = await prisma.employee.findUnique({
    where: { employeeId: "SUP000001" },
    select: { id: true },
  });
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
      scenario = { kind: "COMPLETED", hrAccepted: index % 4 !== 0, variant: index };
      completed += 1;
    } else if (scheduled < 12) {
      scenario = {
        kind: "SCHEDULED",
        employeeAccepted: true,
        hrPending: index % 2 === 0,
        daysAhead: 3 + (index % 10),
      };
      scheduled += 1;
    } else if (pending < 10) {
      scenario = {
        kind: "SCHEDULED",
        employeePending: true,
        hrPending: true,
        daysAhead: 4 + (index % 10),
      };
      pending += 1;
    } else if (reschedule < 8) {
      scenario = { kind: "RESCHEDULE_REQUESTED", hrAccepted: true, daysAhead: 5 + (index % 8) };
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

/** Ensure EMP000901–EMP000904 each have a completed planning meeting for employee demos. */
async function seedNamedEmployeeCompletedMeetings(
  prisma: Db,
  cycleId: string,
  previousCycleId: string | null,
  previousBatchId: string | null
) {
  const targetIds = ["EMP000901", "EMP000902", "EMP000903", "EMP000904"];
  const employees = await prisma.employee.findMany({
    where: { employeeId: { in: targetIds } },
    include: {
      team: {
        include: {
          supervisor: true,
          hrAssignments: { include: { hrEmployee: true } },
        },
      },
    },
  });

  for (let index = 0; index < employees.length; index += 1) {
    const employee = employees[index]!;
    const supervisor =
      employee.team?.supervisor ??
      (await prisma.employee.findFirst({ where: { employeeId: "SUP000001" } }));
    if (!supervisor) continue;

    const hr =
      employee.team?.hrAssignments[0]?.hrEmployee ??
      (await prisma.employee.findFirst({ where: { employeeId: "HR000001" } }));

    await prisma.meeting.deleteMany({
      where: {
        type: MeetingType.PERFORMANCE_PLANNING,
        cycleId,
        employeeId: employee.id,
      },
    });

    if (previousCycleId && employee.departmentId) {
      await ensureObjectives(prisma, cycleId, employee.departmentId);
      await ensurePreviousAppraisal(
        prisma,
        employee.id,
        previousCycleId,
        previousBatchId,
        supervisor.id
      );
    }

    await createPlanningMeeting(prisma, {
      employee,
      supervisorId: supervisor.id,
      cycleId,
      hrId: hr?.id ?? null,
      scenario: { kind: "COMPLETED", hrAccepted: true, variant: index },
      dayOffset: 20 + index,
    });
  }

  console.log(
    `Named employee completed planning meetings seeded for: ${targetIds.join(", ")}.`
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
    ? await prisma.appraisalBatch.findFirst({
        where: { cycleId: previousCycle.id },
        orderBy: { batchNumber: "asc" },
      })
    : null;

  await seedOrganizationMeetings(prisma, cycle.id, previousCycle?.id ?? null, previousBatch?.id ?? null);
  await seedDemoSupervisorTeam(prisma, cycle.id, previousCycle?.id ?? null, previousBatch?.id ?? null);
  await seedNamedEmployeeCompletedMeetings(
    prisma,
    cycle.id,
    previousCycle?.id ?? null,
    previousBatch?.id ?? null
  );
}
