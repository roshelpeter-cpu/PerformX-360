import {
  PdpApprovalStatus,
  PdpChangeRequestStatus,
  PdpGoalPriority,
  PdpReviewerRole,
  PdpStatus,
  PdpSupervisorChangeAction,
  PrismaClient,
  Role,
} from "../generated/prisma/client.js";
import {
  highProgressDemoGoals,
  zeroProgressDemoGoals,
} from "./seed-pdp-demo-goals.js";

type Db = PrismaClient;

const DEMO_CODES = [
  "EMP000901",
  "EMP000902",
  "EMP000903",
  "EMP000904",
  "EMP000001",
] as const;

function daysFromNow(days: number) {
  const value = new Date();
  value.setUTCDate(value.getUTCDate() + days);
  return value;
}

function goalSet(pdpId: string, versionId: string, employeeName: string, variant: number) {
  const themes = [
    "Strengthen stakeholder communication",
    "Build technical depth",
    "Improve documentation discipline",
    "Grow facilitation confidence",
    "Deliver stretch ownership",
  ];
  const categories = [
    "Communication",
    "Skill Development",
    "Delivery Quality",
    "Leadership",
    "Professional Growth",
  ];

  return themes.map((title, index) => {
    const rotated = (index + variant) % themes.length;
    return {
      pdpId,
      versionId,
      title: themes[rotated]!,
      objective: `${employeeName} will progress "${themes[rotated]}" with measurable cycle outcomes.`,
      expectedOutcome: `Demonstrable improvement in ${categories[rotated]!.toLowerCase()} by mid-cycle review.`,
      developmentArea: categories[rotated]!,
      category: categories[rotated]!,
      successCriteria: "Evidence reviewed with supervisor at the 30-day and mid-cycle check-ins.",
      dueDate: daysFromNow(90 + index * 15),
      sortOrder: index,
      priority: index < 2 ? PdpGoalPriority.HIGH : PdpGoalPriority.MEDIUM,
      notes: "Seeded for viva demonstration with five supporting sub-goals.",
      subGoals: {
        create: Array.from({ length: 5 }, (_, subIndex) => ({
          title: `Sub-goal ${subIndex + 1}: concrete step for ${themes[rotated]}`,
          description: `Complete milestone ${subIndex + 1} supporting "${themes[rotated]}" for ${employeeName}.`,
          dueDate: daysFromNow(30 + subIndex * 20 + index * 5),
          expectedOutcome: `Milestone ${subIndex + 1} completed and evidenced.`,
          successCriteria: `Supervisor confirms milestone ${subIndex + 1} in 1:1 notes.`,
          sortOrder: subIndex,
        })),
      },
    };
  });
}

async function resolveDemoEmployees(prisma: Db) {
  const supervisor = await prisma.employee.findUnique({
    where: { employeeId: "SUP000001" },
    include: {
      supervisedTeams: {
        include: {
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
    console.log("seedPdps: SUP000001 team not found — skipping.");
    return null;
  }

  const team = supervisor.supervisedTeams[0];
  const hr =
    team.hrAssignments[0]?.hrEmployee ??
    (await prisma.employee.findFirst({ where: { employeeId: "HR000001" } }));

  if (!hr) {
    console.log("seedPdps: HR representative not found — skipping.");
    return null;
  }

  // Ensure demo HR owns this team and named demo employees sit on it so
  // supervisor/HR scope boards show the seeded PDP scenarios.
  await prisma.hrTeamAssignment.deleteMany({ where: { teamId: team.id } });
  await prisma.hrTeamAssignment.create({
    data: { teamId: team.id, hrEmployeeId: hr.id },
  });

  const named = await prisma.employee.findMany({
    where: { employeeId: { in: [...DEMO_CODES] } },
    orderBy: { employeeId: "asc" },
  });

  for (const employee of named) {
    await prisma.employee.update({
      where: { id: employee.id },
      data: {
        teamId: team.id,
        departmentId: team.departmentId ?? employee.departmentId,
      },
    });
  }

  const refreshedTeamMembers = await prisma.employee.findMany({
    where: { role: Role.EMPLOYEE, deactivatedAt: null, teamId: team.id },
    orderBy: { employeeId: "asc" },
  });

  const byCode = new Map(
    (await prisma.employee.findMany({ where: { employeeId: { in: [...DEMO_CODES] } } })).map(
      (e) => [e.employeeId, e]
    )
  );
  const teamMembers = refreshedTeamMembers;

  const pick = (code: string, fallbackIndex: number) =>
    byCode.get(code) ?? teamMembers[fallbackIndex] ?? teamMembers[0];

  const employees = [
    pick("EMP000901", 0),
    pick("EMP000902", 1),
    pick("EMP000903", 2),
    pick("EMP000904", 3),
    pick("EMP000001", 4),
    teamMembers.find((m) => !["EMP000901", "EMP000902", "EMP000903", "EMP000904", "EMP000001"].includes(m.employeeId)),
    teamMembers.filter((m) => !["EMP000901", "EMP000902", "EMP000903", "EMP000904", "EMP000001"].includes(m.employeeId))[1],
    teamMembers.filter((m) => !["EMP000901", "EMP000902", "EMP000903", "EMP000904", "EMP000001"].includes(m.employeeId))[2],
  ].filter((employee, index, arr): employee is NonNullable<typeof employee> => {
    if (!employee) return false;
    return arr.findIndex((other) => other?.id === employee.id) === index;
  });

  while (employees.length < 8 && teamMembers.length > employees.length) {
    const next = teamMembers.find((member) => !employees.some((e) => e.id === member.id));
    if (!next) break;
    employees.push(next);
  }

  if (employees.length < 8) {
    console.log(
      `seedPdps: only ${employees.length} demo employees available (need 8). Seeding what is available.`
    );
  }

  return { supervisor, hr, employees: employees.slice(0, 8), teamId: team.id, teamMembers };
}

async function createBasePdp(
  prisma: Db,
  params: {
    employee: { id: string; name: string; employeeId: string };
    supervisorId: string;
    cycleId: string;
    batchId: string;
    title: string;
    summary: string;
    status: PdpStatus;
    variant: number;
    assignedAt?: Date | null;
    approvedAt?: Date | null;
    activatedAt?: Date | null;
    goalMode?: "default" | "highProgress" | "zeroProgress";
  }
) {
  const pdp = await prisma.personalDevelopmentPlan.create({
    data: {
      employeeId: params.employee.id,
      supervisorId: params.supervisorId,
      cycleId: params.cycleId,
      batchId: params.batchId,
      title: params.title,
      summary: params.summary,
      status: params.status,
      createdById: params.supervisorId,
      currentVersionNumber: 1,
      assignedAt: params.assignedAt ?? null,
      activatedAt: params.activatedAt ?? null,
      approvedAt: params.approvedAt ?? null,
      approvedById: params.approvedAt ? params.supervisorId : null,
    },
  });

  const version = await prisma.pdpVersion.create({
    data: {
      pdpId: pdp.id,
      versionNumber: 1,
      title: params.title,
      summary: params.summary,
      isCurrent: true,
      createdById: params.supervisorId,
    },
  });

  const goals =
    params.goalMode === "highProgress" &&
    (params.employee.employeeId === "EMP000901" || params.employee.employeeId === "EMP000902")
      ? highProgressDemoGoals(
          pdp.id,
          version.id,
          params.employee.name,
          params.employee.employeeId
        )
      : params.goalMode === "zeroProgress"
        ? zeroProgressDemoGoals(pdp.id, version.id, params.employee.name)
        : goalSet(pdp.id, version.id, params.employee.name, params.variant);

  for (const goalData of goals) {
    await prisma.pdpGoal.create({ data: goalData });
  }

  await prisma.pdpActivity.create({
    data: {
      pdpId: pdp.id,
      versionId: version.id,
      actorId: params.supervisorId,
      action: "CREATED",
      message: `Demo PDP seeded for ${params.employee.name}`,
    },
  });

  return { pdp, version };
}

async function createApprovals(
  prisma: Db,
  versionId: string,
  employeeId: string,
  hrId: string,
  employeeStatus: PdpApprovalStatus,
  hrStatus: PdpApprovalStatus,
  employeeComment?: string | null,
  hrComment?: string | null
) {
  const now = new Date();
  await prisma.pdpVersionApproval.createMany({
    data: [
      {
        versionId,
        reviewerId: employeeId,
        reviewerRole: PdpReviewerRole.EMPLOYEE,
        status: employeeStatus,
        comment: employeeComment ?? null,
        respondedAt: employeeStatus === PdpApprovalStatus.PENDING ? null : now,
      },
      {
        versionId,
        reviewerId: hrId,
        reviewerRole: PdpReviewerRole.HR,
        status: hrStatus,
        comment: hrComment ?? null,
        respondedAt: hrStatus === PdpApprovalStatus.PENDING ? null : now,
      },
    ],
  });
}

/**
 * Seeds 8 current-cycle PDP demo scenarios for SUP000001 team / EMP000901–904.
 * Deletes only current-cycle PDPs for those demo employees — preserves previous-cycle COMPLETED PDPs.
 */
export async function seedPdps(prisma: Db) {
  const cycle = await prisma.appraisalCycle.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { startDate: "desc" },
  });
  if (!cycle) {
    console.log("seedPdps: no active appraisal cycle — skipping.");
    return;
  }

  const batch =
    (await prisma.appraisalBatch.findFirst({
      where: { cycleId: cycle.id },
      orderBy: { batchNumber: "asc" },
    })) ??
    (await prisma.appraisalBatch.create({
      data: {
        cycleId: cycle.id,
        batchNumber: 1,
        name: "Organization",
        startDate: cycle.startDate,
        endDate: cycle.endDate,
        status: "ONGOING",
      },
    }));

  const demo = await resolveDemoEmployees(prisma);
  if (!demo) return;

  const { supervisor, hr, employees, teamMembers } = demo;
  const demoEmployeeIds = employees.map((e) => e.id);

  const hrScopedEmployees = await prisma.employee.findMany({
    where: {
      role: Role.EMPLOYEE,
      deactivatedAt: null,
      team: { hrAssignments: { some: { hrEmployeeId: hr.id } } },
    },
    orderBy: { employeeId: "asc" },
  });

  const seedPool = [...teamMembers];
  for (const member of hrScopedEmployees) {
    if (!seedPool.some((existing) => existing.id === member.id)) {
      seedPool.push(member);
    }
  }

  await prisma.personalDevelopmentPlan.deleteMany({
    where: {
      cycleId: cycle.id,
      employeeId: { in: seedPool.map((m) => m.id) },
    },
  });

  const scenarios: Array<{
    label: string;
    status: PdpStatus;
    build: (employee: (typeof employees)[number], index: number) => Promise<void>;
  }> = [
    {
      label: "Draft",
      status: PdpStatus.DRAFT,
      build: async (employee, index) => {
        await createBasePdp(prisma, {
          employee,
          supervisorId: supervisor.id,
          cycleId: cycle.id,
          batchId: batch.id,
          title: `PDP Draft — ${employee.name}`,
          summary: "Initial draft awaiting supervisor completion before approval.",
          status: PdpStatus.DRAFT,
          variant: index,
        });
      },
    },
    {
      label: "Pending both",
      status: PdpStatus.PENDING_EMPLOYEE_REVIEW,
      build: async (employee, index) => {
        const { pdp, version } = await createBasePdp(prisma, {
          employee,
          supervisorId: supervisor.id,
          cycleId: cycle.id,
          batchId: batch.id,
          title: `PDP Review — ${employee.name}`,
          summary: "Submitted for concurrent employee and HR review.",
          status: PdpStatus.PENDING_EMPLOYEE_REVIEW,
          variant: index,
        });
        await createApprovals(
          prisma,
          version.id,
          employee.id,
          hr.id,
          PdpApprovalStatus.PENDING,
          PdpApprovalStatus.PENDING
        );
        await prisma.pdpActivity.create({
          data: {
            pdpId: pdp.id,
            versionId: version.id,
            actorId: supervisor.id,
            action: "SENT_FOR_APPROVAL",
            message: "Demo: sent for employee and HR approval",
          },
        });
      },
    },
    {
      label: "Employee approved / HR pending",
      status: PdpStatus.PENDING_HR_REVIEW,
      build: async (employee, index) => {
        const { pdp, version } = await createBasePdp(prisma, {
          employee,
          supervisorId: supervisor.id,
          cycleId: cycle.id,
          batchId: batch.id,
          title: `PDP HR Review — ${employee.name}`,
          summary: "Employee approved; waiting on HR review.",
          status: PdpStatus.PENDING_HR_REVIEW,
          variant: index,
        });
        await createApprovals(
          prisma,
          version.id,
          employee.id,
          hr.id,
          PdpApprovalStatus.APPROVED,
          PdpApprovalStatus.PENDING
        );
        await prisma.personalDevelopmentPlan.update({
          where: { id: pdp.id },
          data: { employeeAgreedAt: new Date() },
        });
      },
    },
    {
      label: "Employee changes requested",
      status: PdpStatus.CHANGES_REQUESTED_BY_EMPLOYEE,
      build: async (employee, index) => {
        const { pdp, version } = await createBasePdp(prisma, {
          employee,
          supervisorId: supervisor.id,
          cycleId: cycle.id,
          batchId: batch.id,
          title: `PDP Changes (Employee) — ${employee.name}`,
          summary: "Employee requested adjustments to development goals.",
          status: PdpStatus.CHANGES_REQUESTED_BY_EMPLOYEE,
          variant: index,
        });
        await createApprovals(
          prisma,
          version.id,
          employee.id,
          hr.id,
          PdpApprovalStatus.CHANGES_REQUESTED,
          PdpApprovalStatus.PENDING,
          "Please adjust the facilitation goal timeline — too aggressive for this quarter."
        );
        await prisma.pdpChangeRequest.create({
          data: {
            pdpId: pdp.id,
            versionId: version.id,
            requestedById: employee.id,
            requesterRole: PdpReviewerRole.EMPLOYEE,
            message:
              "Please adjust the facilitation goal timeline — too aggressive for this quarter.",
            status: PdpChangeRequestStatus.OPEN,
          },
        });
      },
    },
    {
      label: "HR changes requested",
      status: PdpStatus.CHANGES_REQUESTED_BY_HR,
      build: async (employee, index) => {
        const { pdp, version } = await createBasePdp(prisma, {
          employee,
          supervisorId: supervisor.id,
          cycleId: cycle.id,
          batchId: batch.id,
          title: `PDP Changes (HR) — ${employee.name}`,
          summary: "HR requested clearer success criteria on development goals.",
          status: PdpStatus.CHANGES_REQUESTED_BY_HR,
          variant: index,
        });
        await createApprovals(
          prisma,
          version.id,
          employee.id,
          hr.id,
          PdpApprovalStatus.APPROVED,
          PdpApprovalStatus.CHANGES_REQUESTED,
          null,
          "Add measurable success criteria and align the second goal to department priorities."
        );
        await prisma.pdpChangeRequest.create({
          data: {
            pdpId: pdp.id,
            versionId: version.id,
            requestedById: hr.id,
            requesterRole: PdpReviewerRole.HR,
            message:
              "Add measurable success criteria and align the second goal to department priorities.",
            status: PdpChangeRequestStatus.OPEN,
          },
        });
      },
    },
    {
      label: "Escalated awaiting HR decision",
      status: PdpStatus.AWAITING_HR_DECISION,
      build: async (employee, index) => {
        const { pdp, version } = await createBasePdp(prisma, {
          employee,
          supervisorId: supervisor.id,
          cycleId: cycle.id,
          batchId: batch.id,
          title: `PDP Escalation — ${employee.name}`,
          summary: "Supervisor cannot apply requested changes; HR decision required.",
          status: PdpStatus.AWAITING_HR_DECISION,
          variant: index,
        });
        await createApprovals(
          prisma,
          version.id,
          employee.id,
          hr.id,
          PdpApprovalStatus.CHANGES_REQUESTED,
          PdpApprovalStatus.PENDING,
          "Please replace the stretch ownership goal with a mentoring-focused objective."
        );
        await prisma.pdpChangeRequest.create({
          data: {
            pdpId: pdp.id,
            versionId: version.id,
            requestedById: employee.id,
            requesterRole: PdpReviewerRole.EMPLOYEE,
            message:
              "Please replace the stretch ownership goal with a mentoring-focused objective.",
            status: PdpChangeRequestStatus.SUPERVISOR_CANNOT_CHANGE,
            supervisorAction: PdpSupervisorChangeAction.CANNOT_CHANGE,
            supervisorId: supervisor.id,
            supervisorRespondedAt: new Date(),
            supervisorResponse:
              "Role capacity this cycle does not allow replacing the stretch ownership goal.",
          },
        });
      },
    },
    {
      label: "Both approved ready to assign",
      status: PdpStatus.APPROVED,
      build: async (employee, index) => {
        const { pdp, version } = await createBasePdp(prisma, {
          employee,
          supervisorId: supervisor.id,
          cycleId: cycle.id,
          batchId: batch.id,
          title: `PDP Approved — ${employee.name}`,
          summary: "Both employee and HR approved; ready for supervisor assignment.",
          status: PdpStatus.APPROVED,
          variant: index,
          approvedAt: new Date(),
        });
        await createApprovals(
          prisma,
          version.id,
          employee.id,
          hr.id,
          PdpApprovalStatus.APPROVED,
          PdpApprovalStatus.APPROVED
        );
        await prisma.personalDevelopmentPlan.update({
          where: { id: pdp.id },
          data: {
            employeeAgreedAt: new Date(),
            hrReviewedAt: new Date(),
          },
        });
      },
    },
    {
      label: "Active",
      status: PdpStatus.ACTIVE,
      build: async (employee, index) => {
        const { pdp, version } = await createBasePdp(prisma, {
          employee,
          supervisorId: supervisor.id,
          cycleId: cycle.id,
          batchId: batch.id,
          title: `Active PDP — ${employee.name}`,
          summary: "Assigned and active for the current appraisal cycle.",
          status: PdpStatus.ACTIVE,
          variant: index,
          approvedAt: new Date(),
          assignedAt: new Date(),
        });
        await createApprovals(
          prisma,
          version.id,
          employee.id,
          hr.id,
          PdpApprovalStatus.APPROVED,
          PdpApprovalStatus.APPROVED
        );
        await prisma.personalDevelopmentPlan.update({
          where: { id: pdp.id },
          data: {
            employeeAgreedAt: new Date(),
            hrReviewedAt: new Date(),
          },
        });
        await prisma.pdpActivity.create({
          data: {
            pdpId: pdp.id,
            versionId: version.id,
            actorId: supervisor.id,
            action: "ASSIGNED",
            message: "Demo: PDP assigned and marked active",
          },
        });
      },
    },
  ];

  for (let index = 0; index < Math.min(scenarios.length, employees.length); index += 1) {
    const employee = employees[index]!;

    // EMP000901 / EMP000902 — active My PDP dashboard with high demo progress.
    // EMP000001 / EMP000903 are intentionally untouched by these branches.
    if (employee.employeeId === "EMP000901" || employee.employeeId === "EMP000902") {
      const { pdp, version } = await createBasePdp(prisma, {
        employee,
        supervisorId: supervisor.id,
        cycleId: cycle.id,
        batchId: batch.id,
        title: `My Personal Development Plan — ${employee.name}`,
        summary:
          "Active professional development plan for the current appraisal cycle. Track goals, complete sub-goals, and grow with Altrium.",
        status: PdpStatus.ACTIVE,
        variant: index,
        assignedAt: new Date(),
        activatedAt: new Date(),
        approvedAt: new Date(),
        goalMode: "highProgress",
      });
      await createApprovals(
        prisma,
        version.id,
        employee.id,
        hr.id,
        PdpApprovalStatus.APPROVED,
        PdpApprovalStatus.APPROVED
      );
      await prisma.personalDevelopmentPlan.update({
        where: { id: pdp.id },
        data: {
          employeeAgreedAt: new Date(),
          hrReviewedAt: new Date(),
        },
      });
      await prisma.pdpActivity.createMany({
        data: [
          {
            pdpId: pdp.id,
            versionId: version.id,
            actorId: supervisor.id,
            action: "ASSIGNED",
            message: "Demo: PDP assigned to employee",
            createdAt: new Date(Date.UTC(2026, 8, 1, 10, 0, 0)),
          },
          {
            pdpId: pdp.id,
            versionId: version.id,
            actorId: employee.id,
            action: "ACTIVATED",
            message: "Demo: employee activated assigned PDP",
            createdAt: new Date(Date.UTC(2026, 8, 2, 9, 30, 0)),
          },
          {
            pdpId: pdp.id,
            versionId: version.id,
            actorId: employee.id,
            action: "PROGRESS_UPDATE",
            message: 'Marked "Build a full-stack project (MERN)" as Completed',
            createdAt: new Date(Date.UTC(2026, 8, 12, 14, 0, 0)),
          },
          {
            pdpId: pdp.id,
            versionId: version.id,
            actorId: employee.id,
            action: "EVIDENCE_UPLOADED",
            message: 'Uploaded evidence for "Complete React Advanced Course"',
            createdAt: new Date(Date.UTC(2026, 8, 12, 11, 0, 0)),
          },
          {
            pdpId: pdp.id,
            versionId: version.id,
            actorId: employee.id,
            action: "COMMENT_ADDED",
            message: 'Commented on "Learn RESTful API development"',
            createdAt: new Date(Date.UTC(2026, 8, 10, 16, 0, 0)),
          },
        ],
      });
      console.log(
        `  PDP scenario ACTIVE dashboard → ${employee.employeeId} (${employee.name})`
      );
      continue;
    }

    // EMP000904 — assigned PDP gate (session opens dashboard; DB stays ASSIGNED).
    if (employee.employeeId === "EMP000904") {
      const { pdp, version } = await createBasePdp(prisma, {
        employee,
        supervisorId: supervisor.id,
        cycleId: cycle.id,
        batchId: batch.id,
        title: `Assigned PDP — ${employee.name}`,
        summary:
          "Your supervisor has assigned this Personal Development Plan. Open it to review your goals and begin tracking progress.",
        status: PdpStatus.ASSIGNED,
        variant: index,
        assignedAt: new Date(),
        approvedAt: new Date(),
        goalMode: "zeroProgress",
      });
      await createApprovals(
        prisma,
        version.id,
        employee.id,
        hr.id,
        PdpApprovalStatus.APPROVED,
        PdpApprovalStatus.APPROVED
      );
      await prisma.personalDevelopmentPlan.update({
        where: { id: pdp.id },
        data: {
          employeeAgreedAt: new Date(),
          hrReviewedAt: new Date(),
        },
      });
      await prisma.pdpActivity.create({
        data: {
          pdpId: pdp.id,
          versionId: version.id,
          actorId: supervisor.id,
          action: "ASSIGNED",
          message: "Demo: PDP assigned — awaiting employee to view assigned plan",
        },
      });
      console.log(
        `  PDP scenario ASSIGNED gate → ${employee.employeeId} (${employee.name})`
      );
      continue;
    }

    // EMP000903 = pending employee (1). EMP000001 keeps index-based scenario (HR changes).
    let scenarioIndex = index;
    if (employee.employeeId === "EMP000903") scenarioIndex = 1;

    const scenario = scenarios[scenarioIndex]!;
    await scenario.build(employee, index);
    console.log(
      `  PDP scenario ${scenarioIndex + 1}: ${scenario.label} → ${employee.employeeId} (${employee.name})`
    );
  }

  // Extra PDPs so HR category tabs each show at least 4 examples.
  const extras = seedPool.filter((member) => !demoEmployeeIds.includes(member.id));
  const extraPlans: Array<{
    label: string;
    status: PdpStatus;
    empApproval: PdpApprovalStatus;
    hrApproval: PdpApprovalStatus;
    count: number;
  }> = [
    { label: "Draft", status: PdpStatus.DRAFT, empApproval: PdpApprovalStatus.PENDING, hrApproval: PdpApprovalStatus.PENDING, count: 4 },
    { label: "Waiting Employee", status: PdpStatus.PENDING_EMPLOYEE_REVIEW, empApproval: PdpApprovalStatus.PENDING, hrApproval: PdpApprovalStatus.PENDING, count: 4 },
    { label: "Waiting HR", status: PdpStatus.PENDING_HR_REVIEW, empApproval: PdpApprovalStatus.APPROVED, hrApproval: PdpApprovalStatus.PENDING, count: 4 },
    { label: "Approved", status: PdpStatus.APPROVED, empApproval: PdpApprovalStatus.APPROVED, hrApproval: PdpApprovalStatus.APPROVED, count: 4 },
    { label: "Completed/Active", status: PdpStatus.ACTIVE, empApproval: PdpApprovalStatus.APPROVED, hrApproval: PdpApprovalStatus.APPROVED, count: 4 },
    { label: "Change Requests", status: PdpStatus.CHANGES_REQUESTED_BY_HR, empApproval: PdpApprovalStatus.APPROVED, hrApproval: PdpApprovalStatus.CHANGES_REQUESTED, count: 4 },
  ];

  let extraCursor = 0;
  for (const plan of extraPlans) {
    for (let i = 0; i < plan.count; i += 1) {
      const employee = extras[extraCursor++];
      if (!employee) break;
      const { pdp, version } = await createBasePdp(prisma, {
        employee,
        supervisorId: supervisor.id,
        cycleId: cycle.id,
        batchId: batch.id,
        title: `PDP ${plan.label} — ${employee.name}`,
        summary: `Deterministic HR demo record (${plan.label}).`,
        status: plan.status,
        variant: i,
        assignedAt: plan.status === PdpStatus.ACTIVE ? new Date() : null,
        approvedAt:
          plan.status === PdpStatus.APPROVED || plan.status === PdpStatus.ACTIVE
            ? new Date()
            : null,
      });
      if (plan.status !== PdpStatus.DRAFT) {
        await createApprovals(
          prisma,
          version.id,
          employee.id,
          hr.id,
          plan.empApproval,
          plan.hrApproval,
          null,
          plan.hrApproval === PdpApprovalStatus.CHANGES_REQUESTED
            ? "Please include a measurable completion target for this development objective."
            : null
        );
      }
      if (plan.status === PdpStatus.CHANGES_REQUESTED_BY_HR) {
        await prisma.pdpChangeRequest.create({
          data: {
            pdpId: pdp.id,
            versionId: version.id,
            requestedById: hr.id,
            requesterRole: PdpReviewerRole.HR,
            message:
              "Please include a measurable completion target for this development objective.",
            status: PdpChangeRequestStatus.OPEN,
          },
        });
      }
      if (plan.status === PdpStatus.ACTIVE) {
        await prisma.personalDevelopmentPlan.update({
          where: { id: pdp.id },
          data: { activatedAt: new Date() },
        });
      }
    }
  }

  console.log(
    `seedPdps: seeded named demos + HR category extras for ${supervisor.employeeId} / HR ${hr.employeeId}.`
  );
}
