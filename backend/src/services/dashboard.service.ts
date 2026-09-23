import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/errors.js";
import { computeBonus } from "../utils/bonus-formula.js";
import { computePdpScoring } from "../utils/pdp-scoring.js";
import {
  getCurrentAppraisalCycle,
  getWorkforceSummary,
  listAppraisalCycles,
} from "./appraisal-cycle.service.js";
import { scoreEmployee } from "./evaluation-board.service.js";
import {
  getNotificationsForUser,
  getUnreadNotificationCount,
} from "./notification.service.js";
import {
  enrichEmployeeProfile,
  mergeProfileDetails,
  metricFromId,
} from "../utils/demo-profile.js";

function serializeEmployee(employee: {
  id: string;
  employeeId: string;
  name: string;
  role: string;
  companyEmail: string;
  jobTitle: string | null;
  createdAt: Date;
  department: { id: string; name: string } | null;
  team: {
    id: string;
    name: string;
    supervisor: {
      id: string;
      employeeId: string;
      name: string;
      jobTitle: string | null;
      companyEmail: string;
    } | null;
    hrAssignments?: Array<{
      hrEmployee: {
        id: string;
        employeeId: string;
        name: string;
        jobTitle: string | null;
        companyEmail: string;
      };
    }>;
  } | null;
  hrTeamAssignments?: Array<{ team: { id: string; name: string } }>;
  authLock: { lockedUntil: Date } | null;
  profileDetails?: unknown;
}) {
  const locked =
    employee.authLock !== null && employee.authLock.lockedUntil > new Date();
  const demo = mergeProfileDetails(
    enrichEmployeeProfile({
      employeeId: employee.employeeId,
      name: employee.name,
      companyEmail: employee.companyEmail,
      jobTitle: employee.jobTitle,
      createdAt: employee.createdAt,
      role: employee.role,
      departmentName: employee.department?.name ?? null,
    }),
    employee.profileDetails
  );
  const hrResponsible = employee.team?.hrAssignments?.[0]?.hrEmployee ?? null;

  return {
    id: employee.id,
    employeeId: employee.employeeId,
    name: employee.name,
    role: employee.role,
    companyEmail: employee.companyEmail,
    createdAt: employee.createdAt,
    accountStatus: locked ? "Locked" : "Active",
    department: employee.department,
    team: employee.team
      ? {
          id: employee.team.id,
          name: employee.team.name,
          supervisor: employee.team.supervisor,
        }
      : null,
    hrResponsible,
    assignedTeams: employee.hrTeamAssignments?.map((row) => row.team) ?? [],
    ...demo,
  };
}

async function loadActiveAssignment(employeeDbId: string) {
  const activeCycle = await prisma.appraisalCycle.findFirst({
    where: { status: "ACTIVE" },
    include: {
      batches: { orderBy: { batchNumber: "asc" } },
      stages: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!activeCycle) {
    return {
      cycle: null,
      batch: null,
      supervisor: null,
      keyDates: [] as Array<{ label: string; date: Date }>,
    };
  }

  const [batchAssignment, supervisorAssignment] = await Promise.all([
    prisma.employeeBatchAssignment.findUnique({
      where: {
        cycleId_employeeId: {
          cycleId: activeCycle.id,
          employeeId: employeeDbId,
        },
      },
      include: {
        batch: true,
      },
    }),
    prisma.employeeSupervisorAssignment.findUnique({
      where: {
        cycleId_employeeId: {
          cycleId: activeCycle.id,
          employeeId: employeeDbId,
        },
      },
      include: {
        supervisor: {
          select: {
            id: true,
            employeeId: true,
            name: true,
            jobTitle: true,
            companyEmail: true,
          },
        },
      },
    }),
  ]);

  return {
    cycle: {
      id: activeCycle.id,
      name: activeCycle.name,
      status: activeCycle.status,
      startDate: activeCycle.startDate,
      endDate: activeCycle.endDate,
      description: activeCycle.description,
    },
    batch: batchAssignment?.batch
      ? {
          id: batchAssignment.batch.id,
          name: batchAssignment.batch.name,
          batchNumber: batchAssignment.batch.batchNumber,
          status: batchAssignment.batch.status,
          currentStage: batchAssignment.batch.currentStage,
          startDate: batchAssignment.batch.startDate,
          endDate: batchAssignment.batch.endDate,
        }
      : null,
    supervisor: supervisorAssignment?.supervisor ?? null,
    keyDates: buildKeyDates(activeCycle),
  };
}

function buildKeyDates(cycle: {
  startDate: Date;
  endDate: Date;
  stages: Array<{ key: string; title: string; startDate: Date; endDate: Date }>;
}) {
  const selfReview = cycle.stages.find((stage) => stage.key === "SELF_REVIEW");
  const peerReview = cycle.stages.find((stage) => stage.key === "PEER_REVIEW");
  const managerReview = cycle.stages.find(
    (stage) => stage.key === "SUPERVISOR_REVIEW"
  );
  const hrEvaluation = cycle.stages.find((stage) => stage.key === "HR_EVALUATION");
  return [
    { label: "Cycle Start", date: cycle.startDate },
    {
      label: "Self Review Deadline",
      date: selfReview?.endDate ?? cycle.endDate,
    },
    {
      label: "Peer Review Period",
      date: peerReview?.startDate ?? cycle.startDate,
    },
    {
      label: "Manager Review Period",
      date: managerReview?.startDate ?? cycle.startDate,
    },
    {
      label: "Promotion Review",
      date: hrEvaluation?.startDate ?? managerReview?.endDate ?? cycle.endDate,
    },
    { label: "Cycle End", date: cycle.endDate },
  ];
}

async function loadEmployeeInsights(employeeId: string, cycleId: string) {
  const [detail, bonus, awards, promotion, pip] = await Promise.all([
    scoreEmployee(cycleId, employeeId),
    prisma.bonusCalculation.findUnique({
      where: { cycleId_employeeId: { cycleId, employeeId } },
    }),
    prisma.recognitionAward.findMany({
      where: { cycleId, employeeId },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, category: true, status: true, createdAt: true },
    }),
    prisma.promotionRecommendation.findUnique({
      where: { cycleId_employeeId: { cycleId, employeeId } },
      select: { status: true, reason: true, pdpScore: true },
    }),
    prisma.personalDevelopmentPlan.findFirst({
      where: {
        employeeId,
        cycleId,
        planType: "PIP",
        status: { in: ["ACTIVE", "ASSIGNED", "APPROVED"] },
      },
      include: {
        supervisor: { select: { name: true } },
        cycle: { select: { name: true, startDate: true, endDate: true } },
        goals: { select: { id: true, title: true, subGoals: { select: { id: true, title: true, status: true, dueDate: true } } } },
      },
    }),
  ]);

  const derivedBonus = bonus ?? computeBonus(detail.scores.total);
  const scoring = pip
    ? computePdpScoring(
        pip.goals.map((goal) => ({
          id: goal.id,
          subGoals: goal.subGoals.map((sub) => ({ id: sub.id, status: sub.status })),
        }))
      )
    : null;

  const promotionLabel =
    promotion?.status === "SHORTLISTED"
      ? "Recommended"
      : promotion?.status === "REJECTED"
        ? "Not approved"
        : promotion
          ? "Under review"
          : "Not recommended";

  return {
    insight: {
      bonusAmount: bonus?.amount ?? (detail.scores.total >= 60 ? derivedBonus.amount : 0),
      bonusAuthorized: bonus?.status === "AUTHORIZED",
      performanceBand: detail.scores.band,
      awardsReceived: awards.filter((row) => row.status === "APPROVED").length,
      promotionStatus: promotionLabel,
      recommendedTitle: promotion ? "Senior role review" : null,
    },
    performance: {
      overall: Math.round(detail.scores.total),
      goals: Math.round(detail.pdp?.progress ?? detail.scores.supervisorPdp),
      competencies: Math.round(detail.scores.supervisorPdp),
      peerReview: Math.round(detail.scores.peer),
      selfReview: Math.round(detail.scores.self),
    },
    rewards: {
      bonusAmount: bonus?.amount ?? 0,
      awards: awards.map((row) => ({
        id: row.id,
        title: row.title,
        category: row.category,
        status: row.status,
      })),
    },
    career: {
      promotionStatus: promotionLabel,
      reason: promotion?.reason ?? null,
      recommendedTitle: promotion ? "Senior role review" : null,
    },
    assignedPip: pip
      ? {
          id: pip.id,
          title: pip.title,
          status: pip.status,
          assignedAt: pip.assignedAt?.toISOString() ?? null,
          supervisorName: pip.supervisor?.name ?? null,
          progress: scoring?.progressPercent ?? 0,
          earnedPoints: scoring?.earnedPoints ?? 0,
          reviewPeriod: pip.cycle.name,
          goals: pip.goals.slice(0, 4).map((goal) => {
            const done = goal.subGoals.filter((sub) => sub.status === "COMPLETED").length;
            return {
              title: goal.title,
              progress: goal.subGoals.length ? Math.round((done / goal.subGoals.length) * 100) : 0,
              actions: goal.subGoals.slice(0, 3).map((sub) => ({
                title: sub.title,
                status: sub.status,
              })),
            };
          }),
          pendingAction:
            pip.status === "ASSIGNED"
              ? "Open your PIP and review the assigned improvement goals."
              : "Update PIP evidence for actions still in progress.",
        }
      : null,
  };
}

function buildWorkspace(input: {
  role: string;
  employeeId: string;
  name: string;
  teamCount?: number;
  workforce?: {
    totalAssignableEmployees: number;
  };
  notifications: Array<{
    id: string;
    title: string;
    message: string;
  }>;
  orgActivities?: Array<{
    id: string;
    title: string;
    detail: string;
  }>;
}) {
  const id = input.employeeId;
  if (input.role === "EMPLOYEE") {
    return {
      stats: [
        {
          label: "Assigned Goals",
          value: metricFromId(id, "goals", 4, 8),
          hint: "This cycle",
          change: "+1 vs last cycle",
        },
        {
          label: "Goals in Progress",
          value: metricFromId(id, "gip", 1, 4),
          hint: "Keep updating evidence",
          change: "+12% vs last cycle",
        },
        {
          label: "Goals Completed",
          value: metricFromId(id, "gc", 0, 3),
          hint: "Submitted this cycle",
          change: "+8% vs last cycle",
        },
        {
          label: "Upcoming Meetings",
          value: metricFromId(id, "meet", 1, 3),
          hint: "Next 14 days",
          change: "+1 vs last week",
        },
      ],
      activities: [
        {
          id: `${id}-a1`,
          when: "Today",
          time: "09:15 AM",
          title: "Goal evidence reminder",
          detail: `Update progress on your current goals, ${input.name.split(" ")[0]}.`,
        },
        {
          id: `${id}-a2`,
          when: "Yesterday",
          time: "04:30 PM",
          title: "Self review window",
          detail: "Self review submissions are now open for this cycle.",
        },
        ...input.notifications.slice(0, 2).map((item) => ({
          id: item.id,
          when: "Recently",
          time: "",
          title: item.title,
          detail: item.message,
        })),
      ],
      pendingActions: [
        {
          count: metricFromId(id, "self", 1, 2),
          title: "Self review",
          detail: "Complete your self review for this cycle",
        },
        {
          count: metricFromId(id, "goalact", 1, 3),
          title: "Goal updates",
          detail: "Add evidence for goals in progress",
        },
        {
          count: 1,
          title: "Evidence submission",
          detail: "Upload supporting documents",
        },
        {
          count: metricFromId(id, "meetp", 1, 2),
          title: "Upcoming meetings",
          detail: "Confirm your next planning or review meeting",
        },
      ],
    };
  }

  if (input.role === "SUPERVISOR") {
    const teamSize = input.teamCount ?? 0;
    return {
      stats: [
        {
          label: "Team Members",
          value: teamSize,
          hint: "Assigned to you",
          change: teamSize > 0 ? "+2 vs last cycle" : "No change",
        },
        {
          label: "Goals in Progress",
          value: Math.max(2, teamSize * 2),
          hint: "Across your team",
          change: "+12% vs last cycle",
        },
        {
          label: "Goals Completed",
          value: Math.max(1, Math.floor(teamSize * 0.6)),
          hint: "Team completions",
          change: "+8% vs last cycle",
        },
        {
          label: "Upcoming Meetings",
          value: metricFromId(id, "smeet", 2, 6),
          hint: "Team reviews",
          change: "+20% vs last cycle",
        },
      ],
      activities: [
        {
          id: `${id}-s1`,
          when: "Today",
          time: "10:24 AM",
          title: "Team check-in",
          detail: "Review progress for employees assigned to you.",
        },
        {
          id: `${id}-s2`,
          when: "Today",
          time: "09:15 AM",
          title: "PDP meetings scheduled",
          detail: "Follow-up reviews are scheduled for next week.",
        },
        ...input.notifications.slice(0, 2).map((item) => ({
          id: item.id,
          when: "Recently",
          time: "",
          title: item.title,
          detail: item.message,
        })),
      ],
      pendingActions: [
        {
          count: Math.max(1, Math.floor(teamSize / 3) || 2),
          title: "Reviews to complete",
          detail: "Supervisor reviews awaiting your input",
        },
        {
          count: metricFromId(id, "pdp", 2, 5),
          title: "Goals / PDP actions",
          detail: "Team development plans to review",
        },
        {
          count: metricFromId(id, "smeetp", 1, 3),
          title: "Meeting actions",
          detail: "Upcoming team review meetings",
        },
        {
          count: 1,
          title: "Evidence follow-up",
          detail: "Employees still missing supporting documents",
        },
      ],
    };
  }

  const total = input.workforce?.totalAssignableEmployees ?? 0;
  return {
    stats: [
      {
        label: "Total Employees",
        value: total,
        hint: "Assignable people",
        change: "+6% vs last cycle",
      },
      {
        label: "Goals in Progress",
        value: Math.max(12, Math.round(total * 0.22)),
        hint: "Organisation-wide",
        change: "+12% vs last cycle",
      },
      {
        label: "Goals Completed",
        value: Math.max(8, Math.round(total * 0.11)),
        hint: "This cycle",
        change: "+8% vs last cycle",
      },
      {
        label: "Upcoming Meetings",
        value: metricFromId(id, "hrmeet", 8, 18),
        hint: "Next 14 days",
        change: "+20% vs last cycle",
      },
    ],
    activities:
      input.orgActivities && input.orgActivities.length > 0
        ? input.orgActivities
        : [
            {
              id: `${id}-h1`,
              when: "Today",
              time: "10:24 AM",
              title: "Cycle coverage update",
              detail: "Workforce assignment coverage is being monitored.",
            },
          ],
    pendingActions: [
      {
        count: 8,
        title: "Reviews to approve",
        detail: "Manager reviews pending",
      },
      {
        count: 5,
        title: "PDPs to be reviewed",
        detail: "Awaiting HR approval",
      },
      {
        count: 3,
        title: "Employees without goals",
        detail: "Assign goals for current cycle",
      },
      {
        count: 2,
        title: "Meeting requests",
        detail: "Awaiting confirmation",
      },
    ],
  };
}

export async function getDashboardForUser(userId: string) {
  const employee = await prisma.employee.findUnique({
    where: { id: userId },
    include: {
      department: true,
      authLock: true,
      hrTeamAssignments: {
        include: { team: { select: { id: true, name: true } } },
      },
      team: {
        include: {
          supervisor: {
            select: {
              id: true,
              employeeId: true,
              name: true,
              jobTitle: true,
              companyEmail: true,
            },
          },
          hrAssignments: {
            include: {
              hrEmployee: {
                select: {
                  id: true,
                  employeeId: true,
                  name: true,
                  jobTitle: true,
                  companyEmail: true,
                },
              },
            },
            take: 1,
          },
        },
      },
    },
  });

  if (!employee) {
    throw new AppError("Authentication required", 401);
  }

  const [notifications, unreadCount] = await Promise.all([
    getNotificationsForUser(employee.id, 8),
    getUnreadNotificationCount(employee.id),
  ]);

  const profile = serializeEmployee(employee);
  const assignment = await loadActiveAssignment(employee.id);

  if (employee.role === "EMPLOYEE") {
    const extras = assignment.cycle
      ? await loadEmployeeInsights(employee.id, assignment.cycle.id)
      : {
          insight: {
            bonusAmount: 0,
            bonusAuthorized: false,
            performanceBand: "Needs Improvement",
            awardsReceived: 0,
            promotionStatus: "Not recommended",
            recommendedTitle: null as string | null,
          },
          performance: { overall: 0, goals: 0, competencies: 0, peerReview: 0, selfReview: 0 },
          rewards: { bonusAmount: 0, awards: [] as Array<{ id: string; title: string; category: string; status: string }> },
          career: { promotionStatus: "Not recommended", reason: null as string | null, recommendedTitle: null as string | null },
          assignedPip: null,
        };
    const workspace = buildWorkspace({
      role: employee.role,
      employeeId: employee.employeeId,
      name: employee.name,
      notifications,
    });
    const stats = [
      {
        label: "Bonus Earned",
        value: extras.insight.bonusAmount,
        hint: extras.insight.bonusAuthorized ? "Authorized this cycle" : "This cycle",
        change: extras.insight.bonusAuthorized ? "Authorized" : extras.insight.bonusAmount > 0 ? "Estimated from score" : "No bonus yet",
      },
      {
        label: "Performance Band",
        value: extras.insight.performanceBand,
        hint: "Current appraisal",
        change: extras.performance.overall ? `${extras.performance.overall}% overall` : "Awaiting reviews",
      },
      {
        label: "Awards Received",
        value: extras.insight.awardsReceived,
        hint: "This cycle",
        change: extras.rewards.awards.length ? `${extras.rewards.awards.length} nomination(s)` : "No nominations yet",
      },
      {
        label: "Promotion Status",
        value: extras.insight.promotionStatus,
        hint: extras.career.recommendedTitle ?? "Current cycle",
        change: extras.career.reason ? "Supervisor case on file" : "No recommendation yet",
      },
    ];
    const pendingActions = extras.assignedPip
      ? [
          {
            count: 1,
            title: extras.assignedPip.status === "ASSIGNED" ? "Open assigned PIP" : "Update PIP progress",
            detail: extras.assignedPip.pendingAction,
          },
          ...workspace.pendingActions,
        ]
      : workspace.pendingActions;
    return {
      role: employee.role,
      profile,
      ...assignment,
      assignedPip: extras.assignedPip,
      insight: extras.insight,
      performance: extras.performance,
      rewards: extras.rewards,
      career: extras.career,
      ...workspace,
      stats,
      pendingActions,
      notifications,
      unreadCount,
    };
  }

  if (employee.role === "SUPERVISOR") {
    const supervisedTeams = await prisma.team.findMany({
      where: { supervisorId: employee.id },
      select: { id: true },
    });
    const teamMembers = await prisma.employee.findMany({
      where: {
        role: "EMPLOYEE",
        teamId: { in: supervisedTeams.map((team) => team.id) },
      },
      include: {
        department: true,
        batchAssignments: {
          where: assignment.cycle ? { cycleId: assignment.cycle.id } : { cycleId: "__none__" },
          include: { batch: true },
        },
      },
      orderBy: { name: "asc" },
    });

    return {
      role: employee.role,
      profile,
      ...assignment,
      teamCount: teamMembers.length,
      team: teamMembers.map((member) => ({
        id: member.id,
        employeeId: member.employeeId,
        name: member.name,
        jobTitle: member.jobTitle,
        companyEmail: member.companyEmail,
        department: member.department,
        batch: member.batchAssignments?.[0]?.batch
          ? {
              id: member.batchAssignments[0].batch.id,
              name: member.batchAssignments[0].batch.name,
              batchNumber: member.batchAssignments[0].batch.batchNumber,
            }
          : null,
      })),
      ...buildWorkspace({
        role: employee.role,
        employeeId: employee.employeeId,
        name: employee.name,
        teamCount: teamMembers.length,
        notifications,
      }),
      notifications,
      unreadCount,
    };
  }

  const [workforce, cycles, pendingResets, recentActivity] = await Promise.all([
    getWorkforceSummary(),
    listAppraisalCycles(),
    prisma.passwordResetRequest.count({ where: { status: "PENDING" } }),
    prisma.appraisalCycleActivity.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        actor: { select: { name: true } },
      },
    }),
  ]);

  const orgActivities = recentActivity.map((row) => ({
    id: row.id,
    when: "Recently",
    time: "",
    title: row.action.replaceAll("_", " "),
    detail: row.details,
  }));

  const workspace = buildWorkspace({
    role: employee.role,
    employeeId: employee.employeeId,
    name: employee.name,
    workforce,
    notifications,
    orgActivities,
  });

  if (employee.role === "HR" || employee.role === "HR_MANAGER") {
    const currentCycle = await getCurrentAppraisalCycle();
    return {
      role: employee.role,
      profile,
      ...assignment,
      workforce,
      currentCycle,
      cycles: cycles.slice(0, 6),
      pendingPasswordResets: pendingResets,
      ...workspace,
      notifications,
      unreadCount,
    };
  }

  const departmentCounts = await prisma.department.findMany({
    select: {
      id: true,
      name: true,
      _count: { select: { employees: true } },
    },
    orderBy: { name: "asc" },
  });

  return {
    role: employee.role,
    profile,
    ...assignment,
    workforce,
    cycles: cycles.slice(0, 8),
    departments: departmentCounts.map((department) => ({
      id: department.id,
      name: department.name,
      employeeCount: department._count.employees,
    })),
    ...workspace,
    notifications,
    unreadCount,
  };
}
