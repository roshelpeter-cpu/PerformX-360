import {
  AwardCategory,
  AwardStatus,
  MeetingParticipantResponse,
  MeetingParticipantRole,
  MeetingStatus,
  MeetingType,
  NotificationType,
  PdpApprovalStatus,
  PdpGoalPriority,
  PdpReviewerRole,
  PdpStatus,
  PdpSubGoalStatus,
  PlanType,
  PrismaClient,
  RescheduleRequestStatus,
  Role,
} from "../generated/prisma/client.js";

type Db = PrismaClient;

const PROTECTED = new Set(["EMP000001", "EMP000901", "EMP000903", "EMP000904"]);

function daysFromNow(days: number) {
  const value = new Date();
  value.setUTCDate(value.getUTCDate() + days);
  return value;
}

function atHour(date: Date, hour: number) {
  const next = new Date(date);
  next.setUTCHours(hour, 0, 0, 0);
  return next;
}

async function createPip(
  prisma: Db,
  params: {
    employee: { id: string; name: string; employeeId: string };
    supervisorId: string;
    hrId: string;
    cycleId: string;
    batchId: string;
    status: PdpStatus;
    employeeApproval: PdpApprovalStatus;
    hrApproval: PdpApprovalStatus;
    summary: string;
  }
) {
  const now = new Date();
  const assigned = params.status === PdpStatus.ACTIVE || params.status === PdpStatus.ASSIGNED || params.status === PdpStatus.COMPLETED;
  const pdp = await prisma.personalDevelopmentPlan.create({
    data: {
      employeeId: params.employee.id,
      supervisorId: params.supervisorId,
      cycleId: params.cycleId,
      batchId: params.batchId,
      title: `Performance Improvement Plan — ${params.employee.name}`,
      summary: params.summary,
      planType: PlanType.PIP,
      status: params.status,
      createdById: params.supervisorId,
      currentVersionNumber: 1,
      assignedAt: assigned ? now : null,
      activatedAt: params.status === PdpStatus.ACTIVE || params.status === PdpStatus.COMPLETED ? now : null,
      approvedAt: assigned ? now : null,
      approvedById: assigned ? params.hrId : null,
    },
  });
  const version = await prisma.pdpVersion.create({
    data: {
      pdpId: pdp.id,
      versionNumber: 1,
      title: pdp.title,
      summary: params.summary,
      isCurrent: true,
      createdById: params.supervisorId,
    },
  });

  const themes = [
    "Stabilise core delivery quality",
    "Close recurring customer issues",
    "Rebuild documentation discipline",
    "Improve stakeholder communication",
    "Demonstrate consistent weekly progress",
  ];
  for (const [index, title] of themes.entries()) {
    await prisma.pdpGoal.create({
      data: {
        pdpId: pdp.id,
        versionId: version.id,
        title,
        objective: `${params.employee.name} will complete "${title}" with weekly supervisor evidence.`,
        expectedOutcome: `Measurable improvement in ${title.toLowerCase()} within the review period.`,
        developmentArea: "Performance recovery",
        category: "Improvement",
        successCriteria: "Supervisor confirms weekly evidence and outcome.",
        dueDate: daysFromNow(30 + index * 14),
        sortOrder: index,
        priority: index < 2 ? PdpGoalPriority.HIGH : PdpGoalPriority.MEDIUM,
        notes: "Seeded PIP improvement action.",
        subGoals: {
          create: Array.from({ length: 3 }, (_, subIndex) => ({
            title: `Action ${subIndex + 1} for ${title}`,
            description: `Complete action ${subIndex + 1} supporting "${title}".`,
            dueDate: daysFromNow(14 + subIndex * 10 + index * 4),
            expectedOutcome: `Action ${subIndex + 1} completed and evidenced.`,
            successCriteria: "Supervisor accepts submitted evidence.",
            sortOrder: subIndex,
            status:
              params.employee.employeeId === "EMP000902" && subIndex === 0
                ? PdpSubGoalStatus.IN_PROGRESS
                : PdpSubGoalStatus.NOT_STARTED,
          })),
        },
      },
    });
  }

  if (params.status !== PdpStatus.DRAFT) {
    await prisma.pdpVersionApproval.createMany({
      data: [
        {
          versionId: version.id,
          reviewerId: params.employee.id,
          reviewerRole: PdpReviewerRole.EMPLOYEE,
          status: params.employeeApproval,
          respondedAt: params.employeeApproval === PdpApprovalStatus.PENDING ? null : now,
        },
        {
          versionId: version.id,
          reviewerId: params.hrId,
          reviewerRole: PdpReviewerRole.HR,
          status: params.hrApproval,
          respondedAt: params.hrApproval === PdpApprovalStatus.PENDING ? null : now,
        },
      ],
    });
  }

  await prisma.pdpActivity.create({
    data: {
      pdpId: pdp.id,
      versionId: version.id,
      actorId: params.supervisorId,
      action: "CREATED",
      message: `Demo PIP seeded for ${params.employee.name}`,
    },
  });

  return pdp;
}

async function seedAwards(prisma: Db, cycleId: string, hrManagerId: string) {
  await prisma.recognitionAward.deleteMany({ where: { cycleId } });
  const winners = await prisma.employee.findMany({
    where: {
      employeeId: { in: ["EMP000901", "EMP000001", "EMP000903"] },
      role: Role.EMPLOYEE,
    },
  });
  const byCode = new Map(winners.map((row) => [row.employeeId, row]));
  const rows = [
    {
      code: "EMP000901",
      category: AwardCategory.OUTSTANDING_PERFORMER,
      title: "Outstanding Performer Award",
      score: 92.4,
      band: "Outstanding",
      status: AwardStatus.APPROVED,
      reason:
        "Nethmi Silva is recommended for Outstanding Performer with a final score of 92.4 (Outstanding), 94% PDP completion, submitted self and peer reviews, and supervisor endorsement of delivery quality.",
    },
    {
      code: "EMP000001",
      category: AwardCategory.EMPLOYEE_OF_THE_YEAR,
      title: "Employee of the Year",
      score: 88.1,
      band: "Exceeds Expectations",
      status: AwardStatus.PENDING,
      reason:
        "Alex Perera is recommended for Employee of the Year based on a final score of 88.1 (Exceeds Expectations), consistent PDP progress, and strong supervisor and peer review evidence across the cycle.",
    },
    {
      code: "EMP000903",
      category: AwardCategory.EMPLOYEE_OF_THE_MONTH,
      title: "Employee of the Month",
      score: 84.6,
      band: "Exceeds Expectations",
      status: AwardStatus.APPROVED,
      reason:
        "Amaya Peris is recommended for Employee of the Month with a final score of 84.6 (Exceeds Expectations), completed PDP actions, and recognised product analysis achievements this month.",
    },
  ];

  for (const row of rows) {
    const employee = byCode.get(row.code);
    if (!employee) continue;
    await prisma.recognitionAward.create({
      data: {
        cycleId,
        employeeId: employee.id,
        category: row.category,
        title: row.title,
        reason: row.reason,
        finalScore: row.score,
        performanceBand: row.band,
        status: row.status,
        approvedById: row.status === AwardStatus.APPROVED ? hrManagerId : null,
        approvedAt: row.status === AwardStatus.APPROVED ? new Date() : null,
      },
    });
  }
}

async function seedPips(prisma: Db, cycleId: string, batchId: string, supervisorId: string, hrId: string) {
  await prisma.personalDevelopmentPlan.deleteMany({ where: { cycleId, planType: PlanType.PIP } });

  const kevin = await prisma.employee.findUnique({ where: { employeeId: "EMP000902" } });
  const pool = await prisma.employee.findMany({
    where: {
      role: Role.EMPLOYEE,
      deactivatedAt: null,
      employeeId: { notIn: [...PROTECTED] },
    },
    include: { department: true, team: { include: { supervisor: true } } },
    orderBy: { employeeId: "asc" },
    take: 24,
  });

  const candidates = pool
    .filter((employee) => employee.employeeId !== "EMP000902")
    .slice(0, 9);
  if (kevin) candidates.unshift(kevin);

  const statuses: Array<{
    status: PdpStatus;
    employeeApproval: PdpApprovalStatus;
    hrApproval: PdpApprovalStatus;
    summary: string;
  }> = [
    {
      status: PdpStatus.ACTIVE,
      employeeApproval: PdpApprovalStatus.APPROVED,
      hrApproval: PdpApprovalStatus.APPROVED,
      summary: "Active improvement plan focusing on ticket quality, response times, and documented handovers.",
    },
    {
      status: PdpStatus.DRAFT,
      employeeApproval: PdpApprovalStatus.PENDING,
      hrApproval: PdpApprovalStatus.PENDING,
      summary: "Draft PIP prepared after a low final score and incomplete delivery evidence.",
    },
    {
      status: PdpStatus.PENDING_EMPLOYEE_REVIEW,
      employeeApproval: PdpApprovalStatus.PENDING,
      hrApproval: PdpApprovalStatus.PENDING,
      summary: "PIP submitted for employee review after supervisor created recovery goals.",
    },
    {
      status: PdpStatus.PENDING_HR_REVIEW,
      employeeApproval: PdpApprovalStatus.APPROVED,
      hrApproval: PdpApprovalStatus.PENDING,
      summary: "Employee accepted the PIP. Awaiting HR approval before activation.",
    },
    {
      status: PdpStatus.COMPLETED,
      employeeApproval: PdpApprovalStatus.APPROVED,
      hrApproval: PdpApprovalStatus.APPROVED,
      summary: "Completed PIP after the employee closed all required recovery actions.",
    },
    {
      status: PdpStatus.DRAFT,
      employeeApproval: PdpApprovalStatus.PENDING,
      hrApproval: PdpApprovalStatus.PENDING,
      summary: "Draft recovery plan for low appraisal band and missed PDP milestones.",
    },
    {
      status: PdpStatus.PENDING_EMPLOYEE_REVIEW,
      employeeApproval: PdpApprovalStatus.PENDING,
      hrApproval: PdpApprovalStatus.PENDING,
      summary: "Waiting on employee review of the proposed improvement actions.",
    },
    {
      status: PdpStatus.PENDING_HR_REVIEW,
      employeeApproval: PdpApprovalStatus.APPROVED,
      hrApproval: PdpApprovalStatus.PENDING,
      summary: "HR review required after employee approval of the PIP.",
    },
    {
      status: PdpStatus.ACTIVE,
      employeeApproval: PdpApprovalStatus.APPROVED,
      hrApproval: PdpApprovalStatus.APPROVED,
      summary: "Active PIP with weekly evidence checkpoints.",
    },
    {
      status: PdpStatus.COMPLETED,
      employeeApproval: PdpApprovalStatus.APPROVED,
      hrApproval: PdpApprovalStatus.APPROVED,
      summary: "Closed PIP used as a completed demonstration record.",
    },
  ];

  for (const [index, employee] of candidates.slice(0, 10).entries()) {
    const scenario = statuses[index] ?? statuses[0]!;
    const ownerId = employee.team?.supervisor?.id ?? supervisorId;
    await createPip(prisma, {
      employee,
      supervisorId: ownerId,
      hrId,
      cycleId,
      batchId,
      ...scenario,
    });
    if (employee.employeeId === "EMP000902") {
      await prisma.notification.create({
        data: {
          type: NotificationType.PIP_ASSIGNED,
          title: "PIP has been assigned to you",
          message: "Your supervisor assigned an active Performance Improvement Plan. Open My PIP to review goals and actions.",
          recipientId: employee.id,
          subjectEmployeeId: employee.id,
          metadata: { demoKey: "final-features-pip" },
        },
      });
    }
  }
}

async function createFollowUpSet(
  prisma: Db,
  params: {
    employeeId: string;
    supervisorId: string;
    cycleId: string;
    createdById: string;
    statuses: MeetingStatus[];
    additional?: { status: MeetingStatus; purpose: string };
  }
) {
  const start = Date.now();
  for (let slot = 1; slot <= 5; slot += 1) {
    const scheduledAt = atHour(daysFromNow(slot === 1 ? 4 : slot * 45 - 40), 10);
    const meeting = await prisma.meeting.create({
      data: {
        type: MeetingType.FOLLOW_UP,
        title: `Follow-up Meeting ${slot}`,
        description: `Standard follow-up meeting ${slot} of 5.`,
        employeeId: params.employeeId,
        supervisorId: params.supervisorId,
        cycleId: params.cycleId,
        scheduledAt,
        endAt: new Date(scheduledAt.getTime() + 45 * 60 * 1000),
        location: "Supervisor office",
        status: params.statuses[slot - 1] ?? MeetingStatus.SCHEDULED,
        createdById: params.createdById,
        followUpSlot: slot,
        isAdditionalFollowUp: false,
        previousScheduledAt:
          params.statuses[slot - 1] === MeetingStatus.RESCHEDULED ? new Date(start - 86400000) : null,
      },
    });
    await prisma.meetingParticipant.createMany({
      data: [
        {
          meetingId: meeting.id,
          employeeId: params.employeeId,
          participantRole: MeetingParticipantRole.EMPLOYEE,
          response:
            params.statuses[slot - 1] === MeetingStatus.CONFIRMED
              ? MeetingParticipantResponse.ACCEPTED
              : params.statuses[slot - 1] === MeetingStatus.RESCHEDULE_REQUESTED
                ? MeetingParticipantResponse.RESCHEDULE_REQUESTED
                : MeetingParticipantResponse.PENDING,
        },
        {
          meetingId: meeting.id,
          employeeId: params.supervisorId,
          participantRole: MeetingParticipantRole.SUPERVISOR,
          response: MeetingParticipantResponse.ACCEPTED,
        },
      ],
    });
    if (params.statuses[slot - 1] === MeetingStatus.RESCHEDULE_REQUESTED) {
      await prisma.meetingRescheduleRequest.create({
        data: {
          meetingId: meeting.id,
          requesterId: params.employeeId,
          reason: "Clash with a client workshop that cannot be moved.",
          status: RescheduleRequestStatus.PENDING,
        },
      });
    }
  }

  if (params.additional) {
    const scheduledAt = atHour(daysFromNow(18), 14);
    const meeting = await prisma.meeting.create({
      data: {
        type: MeetingType.FOLLOW_UP,
        title: "Additional Follow-up Meeting",
        description: params.additional.purpose,
        employeeId: params.employeeId,
        supervisorId: params.supervisorId,
        cycleId: params.cycleId,
        scheduledAt,
        endAt: new Date(scheduledAt.getTime() + 45 * 60 * 1000),
        location: "Teams call",
        status: params.additional.status,
        createdById: params.createdById,
        isAdditionalFollowUp: true,
      },
    });
    await prisma.meetingParticipant.createMany({
      data: [
        {
          meetingId: meeting.id,
          employeeId: params.employeeId,
          participantRole: MeetingParticipantRole.EMPLOYEE,
          response: MeetingParticipantResponse.PENDING,
        },
        {
          meetingId: meeting.id,
          employeeId: params.supervisorId,
          participantRole: MeetingParticipantRole.SUPERVISOR,
          response: MeetingParticipantResponse.ACCEPTED,
        },
      ],
    });
  }
}

async function seedFollowUps(prisma: Db, cycleId: string, supervisorId: string) {
  await prisma.meeting.deleteMany({ where: { cycleId, type: MeetingType.FOLLOW_UP } });

  const named = await prisma.employee.findMany({
    where: { employeeId: { in: ["EMP000901", "EMP000902", "EMP000903", "EMP000904", "EMP000001"] } },
  });
  const extras = await prisma.employee.findMany({
    where: {
      role: Role.EMPLOYEE,
      deactivatedAt: null,
      employeeId: { notIn: ["EMP000901", "EMP000902", "EMP000903", "EMP000904", "EMP000001"] },
    },
    include: { team: true },
    take: 4,
    orderBy: { employeeId: "asc" },
  });
  const byCode = new Map(named.map((row) => [row.employeeId, row]));

  const kevin = byCode.get("EMP000902");
  const nethmi = byCode.get("EMP000901");
  const alex = byCode.get("EMP000001");
  if (nethmi) {
    await createFollowUpSet(prisma, {
      employeeId: nethmi.id,
      supervisorId,
      cycleId,
      createdById: supervisorId,
      statuses: [
        MeetingStatus.CONFIRMED,
        MeetingStatus.SCHEDULED,
        MeetingStatus.SCHEDULED,
        MeetingStatus.SCHEDULED,
        MeetingStatus.SCHEDULED,
      ],
    });
  }
  if (kevin) {
    await createFollowUpSet(prisma, {
      employeeId: kevin.id,
      supervisorId,
      cycleId,
      createdById: supervisorId,
      statuses: [
        MeetingStatus.SCHEDULED,
        MeetingStatus.RESCHEDULE_REQUESTED,
        MeetingStatus.RESCHEDULED,
        MeetingStatus.SCHEDULED,
        MeetingStatus.COMPLETED,
      ],
      additional: { status: MeetingStatus.SCHEDULED, purpose: "Review PIP evidence before the next checkpoint." },
    });
  }
  if (alex) {
    await createFollowUpSet(prisma, {
      employeeId: alex.id,
      supervisorId,
      cycleId,
      createdById: supervisorId,
      statuses: [
        MeetingStatus.SCHEDULED,
        MeetingStatus.SCHEDULED,
        MeetingStatus.SCHEDULED,
        MeetingStatus.SCHEDULED,
        MeetingStatus.SCHEDULED,
      ],
    });
  }
  if (extras[0]) {
    await createFollowUpSet(prisma, {
      employeeId: extras[0].id,
      supervisorId: extras[0].team?.supervisorId ?? supervisorId,
      cycleId,
      createdById: supervisorId,
      statuses: [
        MeetingStatus.CONFIRMED,
        MeetingStatus.SCHEDULED,
        MeetingStatus.SCHEDULED,
        MeetingStatus.SCHEDULED,
        MeetingStatus.SCHEDULED,
      ],
    });
  }
}

export async function seedFinalFeatures(prisma: Db) {
  const cycle = await prisma.appraisalCycle.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { startDate: "desc" },
  });
  if (!cycle) {
    console.log("seedFinalFeatures: no active cycle — skipping.");
    return;
  }
  const supervisor = await prisma.employee.findUnique({ where: { employeeId: "SUP000001" } });
  const hr = await prisma.employee.findUnique({ where: { employeeId: "HR000001" } });
  const hrManager = await prisma.employee.findUnique({ where: { employeeId: "HRM000001" } });
  if (!supervisor || !hr || !hrManager) {
    console.log("seedFinalFeatures: named accounts missing — skipping.");
    return;
  }
  const batch =
    (await prisma.appraisalBatch.findFirst({ where: { cycleId: cycle.id }, orderBy: { batchNumber: "asc" } })) ??
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

  await prisma.notification.deleteMany({
    where: { metadata: { path: ["demoKey"], equals: "final-features-pip" } },
  });
  await seedAwards(prisma, cycle.id, hrManager.id);
  await seedPips(prisma, cycle.id, batch.id, supervisor.id, hr.id);
  await seedFollowUps(prisma, cycle.id, supervisor.id);
  console.log("Final features demo data seeded: awards, PIPs, follow-up meetings.");
}

if (process.argv[1]?.includes("seed-final-features")) {
  const { default: dotenv } = await import("dotenv/config");
  void dotenv;
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  seedFinalFeatures(prisma)
    .catch((error) => {
      console.error(error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
