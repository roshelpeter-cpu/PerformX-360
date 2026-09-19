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

function serializeEmployee(employee: {
  id: string;
  employeeId: string;
  name: string;
  role: string;
  companyEmail: string;
  jobTitle: string | null;
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
}) {
  return {
    id: employee.id,
    employeeId: employee.employeeId,
    name: employee.name,
    role: employee.role,
    companyEmail: employee.companyEmail,
    jobTitle: employee.jobTitle,
    department: employee.department,
    team: employee.team
      ? {
          id: employee.team.id,
          name: employee.team.name,
          supervisor: employee.team.supervisor,
        }
      : null,
  };
}

async function loadActiveAssignment(employeeDbId: string) {
  const activeCycle = await prisma.appraisalCycle.findFirst({
    where: { status: "ACTIVE" },
    include: {
      batches: { orderBy: { batchNumber: "asc" } },
    },
  });

  if (!activeCycle) {
    return {
      cycle: null,
      batch: null,
      supervisor: null,
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
  };
}

export async function getDashboardForUser(userId: string) {
  const employee = await prisma.employee.findUnique({
    where: { id: userId },
    include: {
      department: true,
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
      notifications,
      unreadCount,
    };
  }

  const [workforce, cycles, pendingResets] = await Promise.all([
    getWorkforceSummary(),
    listAppraisalCycles(),
    prisma.passwordResetRequest.count({ where: { status: "PENDING" } }),
  ]);

  if (employee.role === "HR" || employee.role === "HR_MANAGER") {
    const currentCycle = await getCurrentAppraisalCycle();
    return {
      role: employee.role,
      profile,
      workforce,
      currentCycle,
      cycles: cycles.slice(0, 6),
      pendingPasswordResets: pendingResets,
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
    workforce,
    cycles: cycles.slice(0, 8),
    departments: departmentCounts.map((department) => ({
      id: department.id,
      name: department.name,
      employeeCount: department._count.employees,
    })),
    notifications,
    unreadCount,
  };
}
