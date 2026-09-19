import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/errors.js";
import {
  getCurrentAppraisalCycle,
  getWorkforceSummary,
  listAppraisalCycles,
} from "./appraisal-cycle.service.js";
import {
  getNotificationsForUser,
  getUnreadNotificationCount,
} from "./notification.service.js";
import {
  enrichEmployeeProfile,
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
  } | null;
  authLock: { lockedUntil: Date } | null;
}) {
  const locked =
    employee.authLock !== null && employee.authLock.lockedUntil > new Date();
  const demo = enrichEmployeeProfile(employee);

  return {
    id: employee.id,
    employeeId: employee.employeeId,
    name: employee.name,
    role: employee.role,
    companyEmail: employee.companyEmail,
    jobTitle: employee.jobTitle,
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
    { label: "Cycle End", date: cycle.endDate },
  ];
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
    return {
      role: employee.role,
      profile,
      ...assignment,
      ...buildWorkspace({
        role: employee.role,
        employeeId: employee.employeeId,
        name: employee.name,
        notifications,
      }),
      notifications,
      unreadCount,
    };
  }

  if (employee.role === "SUPERVISOR") {
    const team = assignment.cycle
      ? await prisma.employeeSupervisorAssignment.findMany({
          where: {
            cycleId: assignment.cycle.id,
            supervisorId: employee.id,
          },
          include: {
            employee: {
              include: {
                department: true,
                batchAssignments: {
                  where: { cycleId: assignment.cycle.id },
                  include: { batch: true },
                },
              },
            },
          },
          orderBy: { employee: { name: "asc" } },
        })
      : [];

    return {
      role: employee.role,
      profile,
      ...assignment,
      teamCount: team.length,
      team: team.map((row) => ({
        id: row.employee.id,
        employeeId: row.employee.employeeId,
        name: row.employee.name,
        jobTitle: row.employee.jobTitle,
        companyEmail: row.employee.companyEmail,
        department: row.employee.department,
        batch: row.employee.batchAssignments[0]?.batch
          ? {
              id: row.employee.batchAssignments[0].batch.id,
              name: row.employee.batchAssignments[0].batch.name,
              batchNumber: row.employee.batchAssignments[0].batch.batchNumber,
            }
          : null,
      })),
      ...buildWorkspace({
        role: employee.role,
        employeeId: employee.employeeId,
        name: employee.name,
        teamCount: team.length,
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
