/**
 * Organization-wide Appraisal Cycle service.
 * Product model: one cycle for the whole organization (no appraisal batches).
 * Internal AppraisalBatch rows may still exist for legacy meeting/PDP FKs.
 */
import {
  AppraisalCycleStatus,
  AppraisalStageKey,
  EmployeeCycleProgressStatus,
  Role,
  type Prisma,
} from "../../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/errors.js";
import { addOneYear, cycleYear, parseDate } from "../utils/cycle-dates.js";
import {
  buildDefaultStages,
  currentPhaseFromStages,
  deriveStageStatus,
} from "../utils/cycle-stages.js";
import type {
  CreateCycleInput,
  CycleListQuery,
  UpdateCycleInput,
} from "../validations/appraisal-cycle.validation.js";

export const ASSIGNABLE_ROLES: Role[] = [Role.EMPLOYEE, Role.SUPERVISOR];

const actorSelect = {
  id: true,
  employeeId: true,
  name: true,
} as const;

function safeParseDate(value: string): Date {
  try {
    return parseDate(value);
  } catch {
    throw new AppError("Invalid date", 400, "INVALID_DATE");
  }
}

async function recordActivity(
  cycleId: string,
  actorId: string,
  action: string,
  details: string,
  tx: Prisma.TransactionClient | typeof prisma = prisma
) {
  await tx.appraisalCycleActivity.create({
    data: { cycleId, actorId, action, details },
  });
}

async function ensureOrgBatch(
  tx: Prisma.TransactionClient,
  cycleId: string,
  cycleStart: Date,
  cycleEnd: Date
) {
  const existing = await tx.appraisalBatch.findFirst({
    where: { cycleId },
    orderBy: { batchNumber: "asc" },
  });
  if (existing) return existing;
  return tx.appraisalBatch.create({
    data: {
      cycleId,
      batchNumber: 1,
      name: "Organization",
      description: "Internal organization-wide window (not shown as a batch).",
      startDate: cycleStart,
      endDate: cycleEnd,
      status: "ONGOING",
    },
  });
}

async function syncStages(
  tx: Prisma.TransactionClient,
  cycleId: string,
  cycleStart: Date,
  stagesInput?: Array<{
    key?: string | undefined;
    title?: string | undefined;
    startDate: string;
    endDate: string;
  }>
) {
  await tx.appraisalCycleStage.deleteMany({ where: { cycleId } });
  const defaults = buildDefaultStages(cycleStart);
  const rows =
    stagesInput && stagesInput.length > 0
      ? stagesInput.map((stage, index) => {
          const fallback = defaults[index] ?? defaults[0]!;
          return {
            cycleId,
            key: (stage.key as AppraisalStageKey) || fallback.key,
            title: stage.title?.trim() || fallback.title,
            startDate: safeParseDate(stage.startDate),
            endDate: safeParseDate(stage.endDate),
            sortOrder: index + 1,
          };
        })
      : defaults.map((stage) => ({ cycleId, ...stage }));

  await tx.appraisalCycleStage.createMany({ data: rows });
}

function progressFromParticipations(
  rows: Array<{ status: EmployeeCycleProgressStatus; progressPercent: number }>
) {
  const total = rows.length;
  const completed = rows.filter(
    (row) => row.status === EmployeeCycleProgressStatus.COMPLETED
  ).length;
  const inProgress = rows.filter(
    (row) => row.status === EmployeeCycleProgressStatus.IN_PROGRESS
  ).length;
  const overdue = rows.filter(
    (row) => row.status === EmployeeCycleProgressStatus.OVERDUE
  ).length;
  const notStarted = Math.max(total - completed - inProgress - overdue, 0);
  const progressPercent =
    total > 0
      ? Math.round(
          rows.reduce((sum, row) => sum + row.progressPercent, 0) / total
        )
      : 0;
  return {
    totalEmployees: total,
    completed,
    inProgress,
    overdue,
    notStarted,
    progressPercent,
  };
}

function mapStages(
  stages: Array<{
    id: string;
    key: AppraisalStageKey;
    title: string;
    startDate: Date;
    endDate: Date;
    sortOrder: number;
  }>,
  cycleStatus: AppraisalCycleStatus
) {
  return stages
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((stage) => ({
      id: stage.id,
      key: stage.key,
      title: stage.title,
      startDate: stage.startDate,
      endDate: stage.endDate,
      sortOrder: stage.sortOrder,
      status: deriveStageStatus(stage.startDate, stage.endDate, cycleStatus),
    }));
}

async function loadProgress(cycleId: string) {
  const rows = await prisma.employeeCycleParticipation.findMany({
    where: { cycleId },
    select: { status: true, progressPercent: true },
  });
  if (rows.length > 0) return progressFromParticipations(rows);

  const total = await prisma.employee.count({
    where: { role: { in: ASSIGNABLE_ROLES } },
  });
  return {
    totalEmployees: total,
    completed: 0,
    inProgress: 0,
    overdue: 0,
    notStarted: total,
    progressPercent: 0,
  };
}

export async function getWorkforceSummary() {
  const [totalAssignableEmployees, supervisorCount, departmentCount, statusCounts] =
    await Promise.all([
      prisma.employee.count({ where: { role: { in: ASSIGNABLE_ROLES } } }),
      prisma.employee.count({ where: { role: Role.SUPERVISOR } }),
      prisma.department.count(),
      prisma.appraisalCycle.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
    ]);

  const countByStatus = Object.fromEntries(
    statusCounts.map((row) => [row.status, row._count._all])
  );

  return {
    totalAssignableEmployees,
    supervisorCount,
    departmentCount,
    employeesInCycles: totalAssignableEmployees,
    activeCycles: countByStatus[AppraisalCycleStatus.ACTIVE] ?? 0,
    upcomingCycles: countByStatus[AppraisalCycleStatus.UPCOMING] ?? 0,
    completedCycles: countByStatus[AppraisalCycleStatus.COMPLETED] ?? 0,
    draftCycles: countByStatus[AppraisalCycleStatus.DRAFT] ?? 0,
  };
}

async function serializeCycle(cycleId: string) {
  const cycle = await prisma.appraisalCycle.findUnique({
    where: { id: cycleId },
    include: {
      createdBy: { select: actorSelect },
      stages: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!cycle) throw new AppError("Appraisal cycle not found", 404);

  const [progress, recentActivity] = await Promise.all([
    loadProgress(cycleId),
    prisma.appraisalCycleActivity.findMany({
      where: { cycleId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { actor: { select: actorSelect } },
    }),
  ]);

  const stages = mapStages(cycle.stages, cycle.status);
  const currentPhase = currentPhaseFromStages(stages);

  return {
    id: cycle.id,
    name: cycle.name,
    description: cycle.description,
    startDate: cycle.startDate,
    endDate: cycle.endDate,
    year: cycleYear(cycle.startDate),
    status: cycle.status,
    confirmedAt: cycle.confirmedAt,
    activatedAt: cycle.activatedAt,
    completedAt: cycle.completedAt,
    createdAt: cycle.createdAt,
    updatedAt: cycle.updatedAt,
    createdBy: cycle.createdBy,
    stages,
    currentPhase,
    progress,
    employeeCount: progress.totalEmployees,
    recentActivity: recentActivity.map((item) => ({
      id: item.id,
      date: item.createdAt,
      user: item.actor,
      action: item.action,
      details: item.details,
    })),
    // Compatibility fields for older UI pieces still compiling.
    batches: [],
    summary: {
      totalAssignableEmployees: progress.totalEmployees,
      totalEmployeesAssigned: progress.totalEmployees,
      fullyAssignedCount: progress.completed + progress.inProgress,
      assignmentCompletionPercent: progress.progressPercent,
      employeesWithoutBatch: 0,
      employeesWithoutSupervisor: 0,
      supervisorCount: 0,
      batches: [],
      completed: progress.completed,
      inProgress: progress.inProgress,
      overdue: progress.overdue,
    },
  };
}

export async function listAppraisalCycles(query: CycleListQuery = {}) {
  if (query.status === "ARCHIVED") return [];

  const statusFilter =
    query.status && query.status !== "ALL"
      ? { status: query.status as AppraisalCycleStatus }
      : {};

  const yearFilter =
    query.year !== undefined
      ? {
          startDate: {
            gte: new Date(Date.UTC(query.year, 0, 1)),
            lt: new Date(Date.UTC(query.year + 1, 0, 1)),
          },
        }
      : {};

  const cycles = await prisma.appraisalCycle.findMany({
    where: {
      ...statusFilter,
      ...yearFilter,
      ...(query.search
        ? { name: { contains: query.search, mode: "insensitive" as const } }
        : {}),
    },
    orderBy: [{ startDate: "desc" }],
    select: { id: true },
  });

  return Promise.all(cycles.map((cycle) => serializeCycle(cycle.id)));
}

export async function getCurrentAppraisalCycle() {
  const cycle = await prisma.appraisalCycle.findFirst({
    where: { status: AppraisalCycleStatus.ACTIVE },
    select: { id: true },
  });
  if (!cycle) return null;
  return serializeCycle(cycle.id);
}

export async function listHistoricalCycles() {
  const cycles = await prisma.appraisalCycle.findMany({
    where: { status: AppraisalCycleStatus.COMPLETED },
    orderBy: [{ startDate: "desc" }],
    select: { id: true },
  });
  return Promise.all(cycles.map((cycle) => serializeCycle(cycle.id)));
}

export async function getAppraisalCycleById(id: string) {
  return serializeCycle(id);
}

export async function listRecentCycleActivities(limit = 20) {
  const rows = await prisma.appraisalCycleActivity.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      actor: { select: actorSelect },
      cycle: { select: { id: true, name: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    date: row.createdAt,
    user: row.actor,
    action: row.action,
    details: row.details,
    cycle: row.cycle,
  }));
}

export async function createAppraisalCycle(
  input: CreateCycleInput,
  createdById: string
) {
  const startDate = safeParseDate(input.startDate);
  const endDate = addOneYear(startDate);
  const status = input.confirm
    ? AppraisalCycleStatus.UPCOMING
    : AppraisalCycleStatus.DRAFT;

  const cycle = await prisma.$transaction(async (tx) => {
    const created = await tx.appraisalCycle.create({
      data: {
        name: input.name.trim(),
        description: input.description?.trim() || null,
        startDate,
        endDate,
        status,
        confirmedAt: input.confirm ? new Date() : null,
        createdById,
      },
    });

    await ensureOrgBatch(tx, created.id, startDate, endDate);
    await syncStages(tx, created.id, startDate, input.stages);

    await recordActivity(
      created.id,
      createdById,
      "Created cycle",
      `Created ${created.name}`,
      tx
    );
    if (input.confirm) {
      await recordActivity(
        created.id,
        createdById,
        "Submitted cycle",
        `${created.name} moved to Upcoming`,
        tx
      );
    }

    // Seed participation stubs for all assignable employees.
    const employees = await tx.employee.findMany({
      where: { role: { in: ASSIGNABLE_ROLES } },
      select: { id: true },
    });
    if (employees.length > 0) {
      await tx.employeeCycleParticipation.createMany({
        data: employees.map((employee) => ({
          cycleId: created.id,
          employeeId: employee.id,
          status: EmployeeCycleProgressStatus.NOT_STARTED,
          progressPercent: 0,
        })),
        skipDuplicates: true,
      });
    }

    // Keep one org batch assignment for legacy FK consumers.
    const batch = await tx.appraisalBatch.findFirst({
      where: { cycleId: created.id },
    });
    if (batch && employees.length > 0) {
      await tx.employeeBatchAssignment.createMany({
        data: employees.map((employee) => ({
          cycleId: created.id,
          batchId: batch.id,
          employeeId: employee.id,
        })),
        skipDuplicates: true,
      });
    }

    return created;
  });

  return serializeCycle(cycle.id);
}

export async function updateAppraisalCycle(
  id: string,
  input: UpdateCycleInput,
  actorId?: string
) {
  const cycle = await prisma.appraisalCycle.findUnique({ where: { id } });
  if (!cycle) throw new AppError("Appraisal cycle not found", 404);
  if (cycle.status !== AppraisalCycleStatus.DRAFT) {
    throw new AppError(
      "Cycle configuration can only be edited while the cycle is Draft.",
      400,
      "CYCLE_NOT_DRAFT"
    );
  }

  const startDate = input.startDate
    ? safeParseDate(input.startDate)
    : cycle.startDate;
  const endDate = addOneYear(startDate);

  await prisma.$transaction(async (tx) => {
    await tx.appraisalCycle.update({
      where: { id },
      data: {
        name: input.name?.trim() ?? cycle.name,
        description:
          input.description !== undefined
            ? input.description?.trim() || null
            : cycle.description,
        startDate,
        endDate,
      },
    });

    const batch = await ensureOrgBatch(tx, id, startDate, endDate);
    await tx.appraisalBatch.update({
      where: { id: batch.id },
      data: { startDate, endDate },
    });

    if (input.stages || input.startDate) {
      await syncStages(tx, id, startDate, input.stages);
      if (actorId) {
        await recordActivity(
          id,
          actorId,
          input.stages ? "Updated timeline" : "Updated cycle details",
          input.stages
            ? `Modified timeline for ${cycle.name}`
            : `Updated details for ${cycle.name}`,
          tx
        );
      }
    } else if (actorId) {
      await recordActivity(
        id,
        actorId,
        "Updated settings",
        `Updated settings for ${cycle.name}`,
        tx
      );
    }
  });

  return serializeCycle(id);
}

export async function confirmAppraisalCycle(cycleId: string, actorId: string) {
  const cycle = await prisma.appraisalCycle.findUnique({ where: { id: cycleId } });
  if (!cycle) throw new AppError("Appraisal cycle not found", 404);
  if (cycle.status === AppraisalCycleStatus.UPCOMING) {
    return serializeCycle(cycleId);
  }
  if (cycle.status !== AppraisalCycleStatus.DRAFT) {
    throw new AppError("Only a Draft cycle can be submitted.", 400, "CYCLE_NOT_DRAFT");
  }

  await prisma.$transaction(async (tx) => {
    await tx.appraisalCycle.update({
      where: { id: cycleId },
      data: {
        status: AppraisalCycleStatus.UPCOMING,
        confirmedAt: new Date(),
      },
    });
    await recordActivity(
      cycleId,
      actorId,
      "Submitted cycle",
      `${cycle.name} is now Upcoming`,
      tx
    );
  });

  return serializeCycle(cycleId);
}

export async function getActivationReadiness(cycleId: string) {
  const cycle = await prisma.appraisalCycle.findUnique({ where: { id: cycleId } });
  if (!cycle) throw new AppError("Appraisal cycle not found", 404);
  if (cycle.status === AppraisalCycleStatus.ACTIVE) {
    throw new AppError("Cycle is already active.", 400, "CYCLE_ALREADY_ACTIVE");
  }

  const existingActive = await prisma.appraisalCycle.findFirst({
    where: { status: AppraisalCycleStatus.ACTIVE, NOT: { id: cycleId } },
    select: { id: true, name: true },
  });

  const errors: string[] = [];
  if (existingActive) {
    errors.push(
      `Only one active appraisal cycle is allowed. "${existingActive.name}" is already active.`
    );
  }

  const progress = await loadProgress(cycleId);

  return {
    cycle: { id: cycle.id, name: cycle.name, status: cycle.status },
    canActivate: errors.length === 0 && cycle.status === AppraisalCycleStatus.UPCOMING,
    errors,
    warnings: [] as string[],
    summary: {
      totalAssignableEmployees: progress.totalEmployees,
      totalEmployeesAssigned: progress.totalEmployees,
      fullyAssignedCount: progress.completed + progress.inProgress,
      assignmentCompletionPercent: progress.progressPercent,
      employeesWithoutBatch: 0,
      employeesWithoutSupervisor: 0,
      supervisorCount: 0,
      batches: [],
    },
    missingBatch: [],
    missingSupervisor: [],
    crossDepartmentCount: 0,
    conflictingActiveCycle: existingActive,
  };
}

export async function activateAppraisalCycle(cycleId: string, actorId: string) {
  const cycle = await prisma.appraisalCycle.findUnique({ where: { id: cycleId } });
  if (!cycle) throw new AppError("Appraisal cycle not found", 404);
  if (cycle.status === AppraisalCycleStatus.ACTIVE) {
    throw new AppError("Cycle is already active.", 400, "CYCLE_ALREADY_ACTIVE");
  }
  if (cycle.status !== AppraisalCycleStatus.UPCOMING) {
    throw new AppError(
      "A cycle must be submitted (Upcoming) before it can be activated.",
      400,
      "CYCLE_NOT_UPCOMING"
    );
  }

  const readiness = await getActivationReadiness(cycleId);
  if (!readiness.canActivate) {
    throw new AppError(
      readiness.errors[0] ?? "Cannot activate cycle.",
      400,
      "CYCLE_NOT_READY"
    );
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.appraisalCycle.update({
        where: { id: cycleId },
        data: {
          status: AppraisalCycleStatus.ACTIVE,
          activeLock: "ACTIVE",
          activatedAt: new Date(),
        },
      });
      await recordActivity(
        cycleId,
        actorId,
        "Activated cycle",
        `${cycle.name} is now active`,
        tx
      );
    });
  } catch (error) {
    const code =
      typeof error === "object" && error && "code" in error
        ? String((error as { code?: string }).code)
        : "";
    if (code === "P2002") {
      throw new AppError(
        "Only one active appraisal cycle is allowed.",
        400,
        "ACTIVE_CYCLE_EXISTS"
      );
    }
    throw error;
  }

  return serializeCycle(cycleId);
}

export async function completeAppraisalCycle(cycleId: string, actorId: string) {
  const cycle = await prisma.appraisalCycle.findUnique({ where: { id: cycleId } });
  if (!cycle) throw new AppError("Appraisal cycle not found", 404);
  if (cycle.status !== AppraisalCycleStatus.ACTIVE) {
    throw new AppError("Only an Active cycle can be completed.", 400, "CYCLE_NOT_ACTIVE");
  }

  await prisma.$transaction(async (tx) => {
    await tx.appraisalCycle.update({
      where: { id: cycleId },
      data: {
        status: AppraisalCycleStatus.COMPLETED,
        activeLock: null,
        completedAt: new Date(),
      },
    });
    await tx.employeeCycleParticipation.updateMany({
      where: { cycleId },
      data: {
        status: EmployeeCycleProgressStatus.COMPLETED,
        progressPercent: 100,
      },
    });
    await recordActivity(
      cycleId,
      actorId,
      "Completed cycle",
      `${cycle.name} marked completed`,
      tx
    );
  });

  return serializeCycle(cycleId);
}

export async function deleteDraftAppraisalCycle(id: string) {
  const cycle = await prisma.appraisalCycle.findUnique({ where: { id } });
  if (!cycle) throw new AppError("Appraisal cycle not found", 404);
  if (cycle.status !== AppraisalCycleStatus.DRAFT) {
    throw new AppError("Only draft cycles can be deleted.", 400, "CYCLE_NOT_DRAFT");
  }
  await prisma.appraisalCycle.delete({ where: { id } });
  return { id, deleted: true as const };
}

export async function listDepartments() {
  return prisma.department.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { employees: true, teams: true } } },
  });
}

export async function listCycleHrGroups(cycleId: string, search?: string) {
  await getAppraisalCycleById(cycleId);

  const hrStaff = await prisma.employee.findMany({
    where: {
      role: Role.HR,
      ...(search
        ? { name: { contains: search, mode: "insensitive" as const } }
        : {}),
    },
    orderBy: { employeeId: "asc" },
    select: {
      id: true,
      employeeId: true,
      name: true,
      hrTeamAssignments: {
        include: {
          team: {
            include: {
              employees: {
                where: { role: { in: ASSIGNABLE_ROLES } },
                select: { id: true },
              },
            },
          },
        },
      },
    },
  });

  return hrStaff.map((hr, index) => {
    const teamCount = hr.hrTeamAssignments.length;
    const employeeCount = hr.hrTeamAssignments.reduce(
      (sum, assignment) => sum + assignment.team.employees.length,
      0
    );
    return {
      id: hr.id,
      label: `HR ${index + 1}`,
      employeeId: hr.employeeId,
      name: hr.name,
      teamCount,
      employeeCount,
      teams: [],
    };
  });
}

export async function listHrGroupTeams(cycleId: string, hrEmployeeId: string) {
  await getAppraisalCycleById(cycleId);

  const hr = await prisma.employee.findFirst({
    where: { id: hrEmployeeId, role: Role.HR },
    select: {
      id: true,
      employeeId: true,
      name: true,
      hrTeamAssignments: {
        include: {
          team: {
            include: {
              supervisor: { select: actorSelect },
              department: { select: { id: true, name: true } },
              employees: {
                where: { role: { in: ASSIGNABLE_ROLES } },
                select: { id: true },
              },
            },
          },
        },
      },
    },
  });
  if (!hr) throw new AppError("HR staff member not found", 404);

  const employeeIds = hr.hrTeamAssignments.flatMap((row) =>
    row.team.employees.map((employee) => employee.id)
  );
  const participations = await prisma.employeeCycleParticipation.findMany({
    where: { cycleId, employeeId: { in: employeeIds } },
  });
  const byEmployee = new Map(
    participations.map((row) => [row.employeeId, row])
  );

  const teams = hr.hrTeamAssignments.map((assignment) => {
    const members = assignment.team.employees;
    const memberProgress = members.map(
      (employee) => byEmployee.get(employee.id)
    );
    const completed = memberProgress.filter(
      (row) => row?.status === EmployeeCycleProgressStatus.COMPLETED
    ).length;
    const inProgress = memberProgress.filter(
      (row) => row?.status === EmployeeCycleProgressStatus.IN_PROGRESS
    ).length;
    const overdue = memberProgress.filter(
      (row) => row?.status === EmployeeCycleProgressStatus.OVERDUE
    ).length;
    const avg =
      members.length > 0
        ? Math.round(
            memberProgress.reduce(
              (sum, row) => sum + (row?.progressPercent ?? 0),
              0
            ) / members.length
          )
        : 0;
    let status = "Not Started";
    if (completed === members.length && members.length > 0) status = "Completed";
    else if (overdue > 0) status = "Overdue";
    else if (inProgress > 0 || completed > 0) status = "In Progress";

    return {
      id: assignment.team.id,
      name: assignment.team.name,
      department: assignment.team.department,
      supervisor: assignment.team.supervisor,
      employeeCount: members.length,
      progressPercent: avg,
      status,
    };
  });

  return {
    hr: {
      id: hr.id,
      employeeId: hr.employeeId,
      name: hr.name,
      label: hr.name,
    },
    teamCount: teams.length,
    employeeCount: teams.reduce((sum, team) => sum + team.employeeCount, 0),
    teams,
  };
}

export async function reassignHrTeam(
  cycleId: string,
  teamId: string,
  newHrEmployeeId: string,
  actorId: string,
  reason?: string
) {
  await getAppraisalCycleById(cycleId);

  const [team, hr] = await Promise.all([
    prisma.team.findUnique({
      where: { id: teamId },
      include: { hrAssignments: true },
    }),
    prisma.employee.findFirst({
      where: { id: newHrEmployeeId, role: Role.HR },
      select: actorSelect,
    }),
  ]);
  if (!team) throw new AppError("Team not found", 404);
  if (!hr) throw new AppError("HR staff member not found", 404);

  await prisma.$transaction(async (tx) => {
    await tx.hrTeamAssignment.deleteMany({ where: { teamId } });
    await tx.hrTeamAssignment.create({
      data: { teamId, hrEmployeeId: newHrEmployeeId },
    });
    await recordActivity(
      cycleId,
      actorId,
      "Reassigned HR",
      `Team "${team.name}" reassigned to ${hr.name}${
        reason ? ` — ${reason}` : ""
      }`,
      tx
    );
  });

  return listHrGroupTeams(cycleId, newHrEmployeeId);
}

export async function listCycleEmployeesOrg(
  cycleId: string,
  filters: {
    search?: string | undefined;
    departmentId?: string | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
  } = {}
) {
  await getAppraisalCycleById(cycleId);
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;

  const where: Prisma.EmployeeWhereInput = {
    role: { in: ASSIGNABLE_ROLES },
    ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
    ...(filters.search
      ? {
          OR: [
            { name: { contains: filters.search, mode: "insensitive" } },
            { employeeId: { contains: filters.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, employees] = await Promise.all([
    prisma.employee.count({ where }),
    prisma.employee.findMany({
      where,
      orderBy: { employeeId: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        employeeId: true,
        name: true,
        role: true,
        department: { select: { id: true, name: true } },
        team: {
          select: {
            id: true,
            name: true,
            supervisor: { select: actorSelect },
          },
        },
      },
    }),
  ]);

  const participations = await prisma.employeeCycleParticipation.findMany({
    where: {
      cycleId,
      employeeId: { in: employees.map((employee) => employee.id) },
    },
  });
  const byId = new Map(participations.map((row) => [row.employeeId, row]));

  return {
    employees: employees.map((employee) => {
      const participation = byId.get(employee.id);
      return {
        id: employee.id,
        employeeId: employee.employeeId,
        name: employee.name,
        role: employee.role,
        department: employee.department,
        team: employee.team
          ? { id: employee.team.id, name: employee.team.name }
          : null,
        supervisor: employee.team?.supervisor ?? null,
        progressPercent: participation?.progressPercent ?? 0,
        status: participation?.status ?? EmployeeCycleProgressStatus.NOT_STARTED,
        stageLabel: participation?.status ?? "NOT_STARTED",
      };
    }),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

// Re-export stubs expected by older controllers for batch endpoints.
export {
  getActivationReadiness as getActivationPreview,
};
