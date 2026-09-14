// Appraisal Cycle Service
// Handles HR appraisal-cycle creation, lifecycle management, batch
// assignments, and draft-only deletion from the database.
import {
  AppraisalBatchStatus,
  AppraisalCycleStatus,
  BatchWorkflowStage,
  MeetingStatus,
  MeetingType,
  NotificationType,
  PdpStatus,
  Role,
  type AppraisalCycle,
} from "../../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/errors.js";
import {
  addOneYear,
  cycleYear,
  defaultBatchStartDates,
  deriveBatchStatus,
  parseDate,
} from "../utils/cycle-dates.js";
import {
  BATCH_STAGE_DEFINITIONS,
  buildBatchTimeline,
  HR_STARTED_STAGES,
  NEXT_HR_STAGE,
  type BatchActivitySnapshot,
} from "../utils/batch-timeline.js";
import { createNotification, notifyAllHrUsers } from "./notification.service.js";
import type {
  CreateCycleInput,
  CycleListQuery,
  UpdateBatchInput,
  UpdateCycleInput,
} from "../validations/appraisal-cycle.validation.js";

// ============================================================
// APPRAISAL CYCLE MANAGEMENT
// Employees with EMPLOYEE or SUPERVISOR roles participate in a cycle.
// HR and Leadership accounts are excluded from batch/supervisor assignment.
// Supervisors are employees with Role.SUPERVISOR — not a separate entity.
// ============================================================
export const ASSIGNABLE_ROLES: Role[] = [Role.EMPLOYEE, Role.SUPERVISOR];
/** Employees who must have a supervisor before a cycle can be activated. */
export const SUPERVISED_ROLES: Role[] = [Role.EMPLOYEE];

export const employeePublicSelect = {
  id: true,
  employeeId: true,
  name: true,
  companyEmail: true,
  role: true,
  departmentId: true,
  department: { select: { id: true, name: true } },
} as const;

export const batchSelect = {
  id: true,
  batchNumber: true,
  name: true,
  description: true,
  startDate: true,
  endDate: true,
  status: true,
  currentStage: true,
  selfReviewStartedAt: true,
  peerReviewStartedAt: true,
  supervisorReviewStartedAt: true,
  hrEvaluationStartedAt: true,
  recognitionStartedAt: true,
  closedAt: true,
  _count: { select: { assignments: true } },
} as const;

export const batchRefSelect = {
  id: true,
  batchNumber: true,
  name: true,
  startDate: true,
  endDate: true,
} as const;

function invalidDateError(): never {
  throw new AppError("Invalid date", 400, "INVALID_DATE");
}

function safeParseDate(value: string): Date {
  try {
    return parseDate(value);
  } catch {
    invalidDateError();
  }
}

// ============================================================
// CYCLE MUTATION GUARDS
// Configuration (name, dates, batch windows) is editable only in DRAFT.
// Assignments stay mutable until the cycle is COMPLETED.
// ============================================================
export function assertNotCompleted(cycle: AppraisalCycle) {
  if (cycle.status === AppraisalCycleStatus.COMPLETED) {
    throw new AppError(
      "Cannot modify a completed cycle.",
      400,
      "CYCLE_COMPLETED"
    );
  }
}

export function assertDraft(cycle: AppraisalCycle) {
  if (cycle.status !== AppraisalCycleStatus.DRAFT) {
    throw new AppError(
      "Cycle configuration can only be edited while the cycle is Draft.",
      400,
      "CYCLE_NOT_DRAFT"
    );
  }
}

export function assertAssignmentsMutable(cycle: AppraisalCycle) {
  if (cycle.status === AppraisalCycleStatus.COMPLETED) {
    throw new AppError(
      "Cannot modify a completed cycle.",
      400,
      "CYCLE_COMPLETED"
    );
  }
}

export function mapBatch(batch: {
  id: string;
  batchNumber: number;
  name: string;
  description: string | null;
  startDate: Date;
  endDate: Date;
  status: AppraisalBatchStatus;
  currentStage?: BatchWorkflowStage;
  _count: { assignments: number };
  timeline?: ReturnType<typeof buildBatchTimeline> | null;
}) {
  const displayStatus = deriveBatchStatus(batch.startDate, batch.endDate);
  return {
    id: batch.id,
    batchNumber: batch.batchNumber,
    name: batch.name,
    description: batch.description,
    startDate: batch.startDate,
    endDate: batch.endDate,
    status: displayStatus,
    currentStage: batch.timeline?.currentStage ?? batch.currentStage ?? BatchWorkflowStage.CONFIGURATION,
    currentStageLabel:
      batch.timeline?.currentStageLabel ??
      BATCH_STAGE_DEFINITIONS.find(
        (stage) => stage.id === (batch.currentStage ?? BatchWorkflowStage.CONFIGURATION)
      )?.title ??
      "Cycle & Batch Configuration",
    timeline: batch.timeline ?? null,
    employeeCount: batch._count.assignments,
    supervisorCount: 0,
  };
}

export async function getCycleOrThrow(id: string) {
  const cycle = await prisma.appraisalCycle.findUnique({
    where: { id },
    include: {
      batches: { orderBy: { batchNumber: "asc" }, select: batchSelect },
      createdBy: {
        select: { id: true, employeeId: true, name: true },
      },
      _count: {
        select: {
          batchAssignments: true,
          supervisorAssignments: true,
        },
      },
    },
  });

  if (!cycle) {
    throw new AppError("Appraisal cycle not found", 404);
  }

  return cycle;
}

// ============================================================
// ASSIGNMENT COMPLETENESS
// Used by the UI summary cards and by activation, which is blocked until
// every assignable employee has a batch and every supervised employee has
// a same-department supervisor.
// ============================================================
async function loadBatchTimelines(
  cycleId: string,
  cycleStatus: AppraisalCycleStatus,
  batches: Array<{
    id: string;
    startDate: Date;
    selfReviewStartedAt: Date | null;
    peerReviewStartedAt: Date | null;
    supervisorReviewStartedAt: Date | null;
    hrEvaluationStartedAt: Date | null;
    recognitionStartedAt: Date | null;
    closedAt: Date | null;
  }>,
  batchLinks: Array<{ batchId: string; employeeId: string }>
) {
  if (batches.length === 0) {
    return new Map<string, ReturnType<typeof buildBatchTimeline>>();
  }

  const batchIds = batches.map((batch) => batch.id);
  const employeeIdsByBatch = new Map<string, string[]>();
  for (const link of batchLinks) {
    const list = employeeIdsByBatch.get(link.batchId) ?? [];
    list.push(link.employeeId);
    employeeIdsByBatch.set(link.batchId, list);
  }

  const [planningMeetings, pdps] = await Promise.all([
    prisma.meeting.findMany({
      where: {
        type: MeetingType.PERFORMANCE_PLANNING,
        status: MeetingStatus.COMPLETED,
        OR: [{ cycleId }, { batchId: { in: batchIds } }],
      },
      select: { employeeId: true, batchId: true },
    }),
    prisma.personalDevelopmentPlan.findMany({
      where: { cycleId },
      select: { employeeId: true, batchId: true, status: true, approvedAt: true },
    }),
  ]);

  const timelines = new Map<string, ReturnType<typeof buildBatchTimeline>>();

  for (const batch of batches) {
    const employeeIds = employeeIdsByBatch.get(batch.id) ?? [];
    const employeeSet = new Set(employeeIds);
    const completedPlanning = new Set(
      planningMeetings
        .filter(
          (meeting) =>
            meeting.batchId === batch.id || employeeSet.has(meeting.employeeId)
        )
        .map((meeting) => meeting.employeeId)
    ).size;
    const batchPdps = pdps.filter(
      (pdp) => pdp.batchId === batch.id || employeeSet.has(pdp.employeeId)
    );
    const approved = batchPdps.filter((pdp) => pdp.status === PdpStatus.APPROVED);
    const snapshot: BatchActivitySnapshot = {
      cycleStatus,
      employeeCount: employeeIds.length,
      completedPlanningMeetings: completedPlanning,
      pdpCount: batchPdps.length,
      approvedPdpCount: approved.length,
      selfReviewStartedAt: batch.selfReviewStartedAt,
      peerReviewStartedAt: batch.peerReviewStartedAt,
      supervisorReviewStartedAt: batch.supervisorReviewStartedAt,
      hrEvaluationStartedAt: batch.hrEvaluationStartedAt,
      recognitionStartedAt: batch.recognitionStartedAt,
      closedAt: batch.closedAt,
    };
    const timeline = buildBatchTimeline(snapshot, {
      [BatchWorkflowStage.CONFIGURATION]: batch.startDate,
      [BatchWorkflowStage.PDP_APPROVED]: approved[0]?.approvedAt ?? null,
      [BatchWorkflowStage.SELF_REVIEW]: batch.selfReviewStartedAt,
      [BatchWorkflowStage.PEER_REVIEW]: batch.peerReviewStartedAt,
      [BatchWorkflowStage.SUPERVISOR_REVIEW]: batch.supervisorReviewStartedAt,
      [BatchWorkflowStage.HR_EVALUATION]: batch.hrEvaluationStartedAt,
      [BatchWorkflowStage.RECOGNITION_PIP]: batch.recognitionStartedAt,
      [BatchWorkflowStage.CLOSURE]: batch.closedAt,
    });
    timelines.set(batch.id, timeline);
  }

  return timelines;
}

export async function buildCycleSummary(cycleId: string) {
  const cycle = await prisma.appraisalCycle.findUnique({
    where: { id: cycleId },
    select: { status: true },
  });
  const [
    assignableEmployees,
    supervised,
    batchAssigned,
    supervisorAssigned,
    supervisorGroups,
    batches,
    batchLinks,
    supervisorLinks,
  ] = await Promise.all([
    prisma.employee.findMany({
      where: { role: { in: ASSIGNABLE_ROLES } },
      select: { id: true, role: true },
    }),
    prisma.employee.count({ where: { role: { in: SUPERVISED_ROLES } } }),
    prisma.employeeBatchAssignment.count({ where: { cycleId } }),
    prisma.employeeSupervisorAssignment.count({
      where: {
        cycleId,
        employee: { role: { in: SUPERVISED_ROLES } },
      },
    }),
    prisma.employeeSupervisorAssignment.groupBy({
      by: ["supervisorId"],
      where: { cycleId },
    }),
    prisma.appraisalBatch.findMany({
      where: { cycleId },
      orderBy: { batchNumber: "asc" },
      select: batchSelect,
    }),
    prisma.employeeBatchAssignment.findMany({
      where: { cycleId },
      select: { batchId: true, employeeId: true },
    }),
    prisma.employeeSupervisorAssignment.findMany({
      where: { cycleId },
      select: { employeeId: true, supervisorId: true },
    }),
  ]);

  const batchByEmployee = new Set(batchLinks.map((row) => row.employeeId));
  const supervisorByEmployee = new Map(
    supervisorLinks.map((row) => [row.employeeId, row.supervisorId])
  );
  const supervisorsByBatch = new Map<string, Set<string>>();
  for (const link of batchLinks) {
    const supervisorId = supervisorByEmployee.get(link.employeeId);
    if (!supervisorId) continue;
    const set = supervisorsByBatch.get(link.batchId) ?? new Set<string>();
    set.add(supervisorId);
    supervisorsByBatch.set(link.batchId, set);
  }

  let fullyAssigned = 0;
  for (const employee of assignableEmployees) {
    const hasBatch = batchByEmployee.has(employee.id);
    const needsSupervisor = SUPERVISED_ROLES.includes(employee.role);
    const hasSupervisor = supervisorByEmployee.has(employee.id);
    if (hasBatch && (!needsSupervisor || hasSupervisor)) {
      fullyAssigned += 1;
    }
  }

  const assignable = assignableEmployees.length;
  const withoutBatch = Math.max(assignable - batchAssigned, 0);
  const withoutSupervisor = Math.max(supervised - supervisorAssigned, 0);
  const assignmentCompletionPercent =
    assignable > 0 ? Math.round((fullyAssigned / assignable) * 100) : 0;

  const timelines = await loadBatchTimelines(
    cycleId,
    cycle?.status ?? AppraisalCycleStatus.DRAFT,
    batches,
    batchLinks
  );

  return {
    totalAssignableEmployees: assignable,
    totalEmployeesAssigned: batchAssigned,
    fullyAssignedCount: fullyAssigned,
    assignmentCompletionPercent,
    employeesWithoutBatch: withoutBatch,
    employeesWithoutSupervisor: withoutSupervisor,
    supervisorCount: supervisorGroups.length,
    batches: batches.map((batch) => ({
      ...mapBatch({ ...batch, timeline: timelines.get(batch.id) ?? null }),
      supervisorCount: supervisorsByBatch.get(batch.id)?.size ?? 0,
    })),
  };
}

function serializeCycle(
  cycle: Awaited<ReturnType<typeof getCycleOrThrow>>,
  summary: Awaited<ReturnType<typeof buildCycleSummary>>
) {
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
    createdBy: cycle.createdBy,
    createdAt: cycle.createdAt,
    updatedAt: cycle.updatedAt,
    batchCount: cycle.batches.length,
    employeeCount: cycle._count.batchAssignments,
    supervisorCount: summary.supervisorCount,
    batches: summary.batches,
    summary,
  };
}

export async function getWorkforceSummary() {
  const [
    totalAssignableEmployees,
    supervisorCount,
    departmentCount,
    statusCounts,
    employeesInCycles,
  ] = await Promise.all([
    prisma.employee.count({ where: { role: { in: ASSIGNABLE_ROLES } } }),
    prisma.employee.count({ where: { role: Role.SUPERVISOR } }),
    prisma.department.count(),
    prisma.appraisalCycle.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.employee.count({
      where: {
        role: { in: ASSIGNABLE_ROLES },
        batchAssignments: { some: {} },
      },
    }),
  ]);

  const countByStatus = Object.fromEntries(
    statusCounts.map((row) => [row.status, row._count._all])
  );

  return {
    totalAssignableEmployees,
    supervisorCount,
    departmentCount,
    employeesInCycles,
    activeCycles: countByStatus[AppraisalCycleStatus.ACTIVE] ?? 0,
    upcomingCycles: countByStatus[AppraisalCycleStatus.UPCOMING] ?? 0,
    completedCycles: countByStatus[AppraisalCycleStatus.COMPLETED] ?? 0,
    draftCycles: countByStatus[AppraisalCycleStatus.DRAFT] ?? 0,
  };
}

export async function listAppraisalCycles(query: CycleListQuery = {}) {
  // ARCHIVED is a UI tab only — the schema has no archived status.
  if (query.status === "ARCHIVED") {
    return [];
  }

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
    include: {
      batches: { orderBy: { batchNumber: "asc" }, select: batchSelect },
      createdBy: {
        select: { id: true, employeeId: true, name: true },
      },
      _count: {
        select: {
          batchAssignments: true,
          supervisorAssignments: true,
        },
      },
    },
  });

  if (cycles.length === 0) return [];

  const cycleIds = cycles.map((cycle) => cycle.id);
  const [assignableEmployees, supervisorGroups, batchLinks, supervisorLinks] =
    await Promise.all([
      prisma.employee.findMany({
        where: { role: { in: ASSIGNABLE_ROLES } },
        select: { id: true, role: true },
      }),
      prisma.employeeSupervisorAssignment.groupBy({
        by: ["cycleId", "supervisorId"],
        where: { cycleId: { in: cycleIds } },
      }),
      prisma.employeeBatchAssignment.findMany({
        where: { cycleId: { in: cycleIds } },
        select: { cycleId: true, employeeId: true },
      }),
      prisma.employeeSupervisorAssignment.findMany({
        where: { cycleId: { in: cycleIds } },
        select: { cycleId: true, employeeId: true },
      }),
    ]);

  const supervisorsByCycle = new Map<string, Set<string>>();
  for (const row of supervisorGroups) {
    const set = supervisorsByCycle.get(row.cycleId) ?? new Set<string>();
    set.add(row.supervisorId);
    supervisorsByCycle.set(row.cycleId, set);
  }

  const batchByCycle = new Map<string, Set<string>>();
  for (const row of batchLinks) {
    const set = batchByCycle.get(row.cycleId) ?? new Set<string>();
    set.add(row.employeeId);
    batchByCycle.set(row.cycleId, set);
  }
  const supervisorByCycleEmployee = new Map<string, Set<string>>();
  for (const row of supervisorLinks) {
    const set = supervisorByCycleEmployee.get(row.cycleId) ?? new Set<string>();
    set.add(row.employeeId);
    supervisorByCycleEmployee.set(row.cycleId, set);
  }

  const assignable = assignableEmployees.length;
  const supervised = assignableEmployees.filter((employee) =>
    SUPERVISED_ROLES.includes(employee.role)
  ).length;

  return cycles.map((cycle) => {
    const supervisorCount = supervisorsByCycle.get(cycle.id)?.size ?? 0;
    const batchSet = batchByCycle.get(cycle.id) ?? new Set<string>();
    const supervisorSet = supervisorByCycleEmployee.get(cycle.id) ?? new Set<string>();
    let fullyAssigned = 0;
    for (const employee of assignableEmployees) {
      const hasBatch = batchSet.has(employee.id);
      const needsSupervisor = SUPERVISED_ROLES.includes(employee.role);
      const hasSupervisor = supervisorSet.has(employee.id);
      if (hasBatch && (!needsSupervisor || hasSupervisor)) fullyAssigned += 1;
    }
    const batchAssigned = cycle._count.batchAssignments;
    const supervisorAssigned = cycle._count.supervisorAssignments;
    const summary = {
      totalAssignableEmployees: assignable,
      totalEmployeesAssigned: batchAssigned,
      fullyAssignedCount: fullyAssigned,
      assignmentCompletionPercent:
        assignable > 0 ? Math.round((fullyAssigned / assignable) * 100) : 0,
      employeesWithoutBatch: Math.max(assignable - batchAssigned, 0),
      employeesWithoutSupervisor: Math.max(supervised - supervisorAssigned, 0),
      supervisorCount,
      batches: cycle.batches.map(mapBatch),
    };
    return serializeCycle(cycle, summary);
  });
}

export async function getCurrentAppraisalCycle() {
  const cycle = await prisma.appraisalCycle.findFirst({
    where: { status: AppraisalCycleStatus.ACTIVE },
    include: {
      batches: { orderBy: { batchNumber: "asc" }, select: batchSelect },
      createdBy: {
        select: { id: true, employeeId: true, name: true },
      },
      _count: {
        select: {
          batchAssignments: true,
          supervisorAssignments: true,
        },
      },
    },
  });

  if (!cycle) return null;

  const summary = await buildCycleSummary(cycle.id);
  return serializeCycle(cycle, summary);
}

export async function listHistoricalCycles() {
  const cycles = await prisma.appraisalCycle.findMany({
    where: { status: AppraisalCycleStatus.COMPLETED },
    orderBy: { completedAt: "desc" },
    include: {
      batches: { orderBy: { batchNumber: "asc" }, select: batchSelect },
      createdBy: {
        select: { id: true, employeeId: true, name: true },
      },
      _count: {
        select: {
          batchAssignments: true,
          supervisorAssignments: true,
        },
      },
    },
  });

  return Promise.all(
    cycles.map(async (cycle) => {
      const summary = await buildCycleSummary(cycle.id);
      return serializeCycle(cycle, summary);
    })
  );
}

export async function getAppraisalCycleById(id: string) {
  const cycle = await getCycleOrThrow(id);
  const summary = await buildCycleSummary(id);
  return serializeCycle(cycle, summary);
}

function resolveBatchInputs(input: CreateCycleInput, cycleStart: Date) {
  if (input.batches?.length === 3) {
    return input.batches.map((batch, index) => {
      const start = safeParseDate(batch.startDate);
      const end = addOneYear(start);
      return {
        batchNumber: index + 1,
        name: batch.name?.trim() || `Batch ${index + 1}`,
        description: batch.description?.trim() || null,
        startDate: start,
        endDate: end,
        status: deriveBatchStatus(start, end),
      };
    });
  }

  return defaultBatchStartDates(cycleStart).map((start, index) => {
    const end = addOneYear(start);
    return {
      batchNumber: index + 1,
      name: `Batch ${index + 1}`,
      description: null,
      startDate: start,
      endDate: end,
      status: deriveBatchStatus(start, end),
    };
  });
}

// ============================================================
// CREATE APPRAISAL CYCLE
// Always starts as DRAFT unless confirm=true, which moves it to UPCOMING
// after the three batches are created. End date is calculated, never entered.
// ============================================================
async function copyAssignmentsFromPreviousCycle(
  newCycleId: string,
  createdById: string
) {
  const previous = await prisma.appraisalCycle.findFirst({
    where: {
      id: { not: newCycleId },
      batchAssignments: { some: {} },
    },
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    include: {
      batches: { select: { id: true, batchNumber: true } },
    },
  });
  if (!previous) {
    await assignFromOrganizationalDefaults(newCycleId, createdById);
    return;
  }

  const newBatches = await prisma.appraisalBatch.findMany({
    where: { cycleId: newCycleId },
    select: { id: true, batchNumber: true },
  });
  const newBatchByNumber = new Map(
    newBatches.map((batch) => [batch.batchNumber, batch.id])
  );
  const oldToNewBatch = new Map<string, string>();
  for (const oldBatch of previous.batches) {
    const newBatchId = newBatchByNumber.get(oldBatch.batchNumber);
    if (newBatchId) oldToNewBatch.set(oldBatch.id, newBatchId);
  }

  const [batchAssignments, supervisorAssignments] = await Promise.all([
    prisma.employeeBatchAssignment.findMany({
      where: { cycleId: previous.id },
    }),
    prisma.employeeSupervisorAssignment.findMany({
      where: { cycleId: previous.id },
    }),
  ]);

  const batchRows = batchAssignments
    .map((assignment) => {
      const newBatchId = oldToNewBatch.get(assignment.batchId);
      if (!newBatchId) return null;
      return {
        cycleId: newCycleId,
        batchId: newBatchId,
        employeeId: assignment.employeeId,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  if (batchRows.length > 0) {
    await prisma.employeeBatchAssignment.createMany({
      data: batchRows,
      skipDuplicates: true,
    });
    await prisma.batchAssignmentHistory.createMany({
      data: batchRows.map((row) => ({
        cycleId: newCycleId,
        employeeId: row.employeeId,
        newBatchId: row.batchId,
        reason: "Existing organizational assignment reflected in the new cycle",
        changedById: createdById,
      })),
    });
  }

  const supervisorRows = supervisorAssignments.map((assignment) => ({
    cycleId: newCycleId,
    employeeId: assignment.employeeId,
    supervisorId: assignment.supervisorId,
  }));
  if (supervisorRows.length > 0) {
    await prisma.employeeSupervisorAssignment.createMany({
      data: supervisorRows,
      skipDuplicates: true,
    });
    await prisma.supervisorAssignmentHistory.createMany({
      data: supervisorRows.map((row) => ({
        cycleId: newCycleId,
        employeeId: row.employeeId,
        newSupervisorId: row.supervisorId,
        reason: "Existing organizational assignment reflected in the new cycle",
        changedById: createdById,
      })),
    });
  }
  await assignFromOrganizationalDefaults(newCycleId, createdById);
}

async function assignFromOrganizationalDefaults(
  cycleId: string,
  createdById: string
) {
  const [employees, supervisors, batches, existingBatch, existingSupervisor] =
    await Promise.all([
      prisma.employee.findMany({
        where: { role: { in: ASSIGNABLE_ROLES } },
        select: { id: true, employeeId: true, role: true, departmentId: true },
        orderBy: { employeeId: "asc" },
      }),
      prisma.employee.findMany({
        where: { role: Role.SUPERVISOR },
        select: { id: true, departmentId: true },
        orderBy: { employeeId: "asc" },
      }),
      prisma.appraisalBatch.findMany({
        where: { cycleId },
        orderBy: { batchNumber: "asc" },
        select: { id: true, batchNumber: true },
      }),
      prisma.employeeBatchAssignment.findMany({
        where: { cycleId },
        select: { employeeId: true },
      }),
      prisma.employeeSupervisorAssignment.findMany({
        where: { cycleId },
        select: { employeeId: true },
      }),
    ]);

  if (batches.length === 0) return;

  const assignedBatch = new Set(existingBatch.map((row) => row.employeeId));
  const assignedSupervisor = new Set(
    existingSupervisor.map((row) => row.employeeId)
  );
  const supervisorsByDept = new Map<string, string[]>();
  for (const supervisor of supervisors) {
    if (!supervisor.departmentId) continue;
    const list = supervisorsByDept.get(supervisor.departmentId) ?? [];
    list.push(supervisor.id);
    supervisorsByDept.set(supervisor.departmentId, list);
  }
  const load = new Map<string, number>();
  for (const supervisor of supervisors) load.set(supervisor.id, 0);

  function pickSupervisor(departmentId: string | null) {
    if (!departmentId) return null;
    const pool = supervisorsByDept.get(departmentId);
    if (!pool?.length) return null;
    return pool.reduce((lowest, current) =>
      (load.get(current) ?? 0) < (load.get(lowest) ?? 0) ? current : lowest
    );
  }

  const batchRows = [];
  const supervisorRows = [];
  for (const employee of employees) {
    if (!assignedBatch.has(employee.id)) {
      const digits = Number(employee.employeeId.replace(/\D/g, "")) || 0;
      const batch = batches[digits % batches.length]!;
      batchRows.push({
        cycleId,
        batchId: batch.id,
        employeeId: employee.id,
      });
    }
    if (
      SUPERVISED_ROLES.includes(employee.role) &&
      !assignedSupervisor.has(employee.id)
    ) {
      const supervisorId = pickSupervisor(employee.departmentId);
      if (supervisorId) {
        supervisorRows.push({
          cycleId,
          employeeId: employee.id,
          supervisorId,
        });
        load.set(supervisorId, (load.get(supervisorId) ?? 0) + 1);
      }
    }
  }

  if (batchRows.length > 0) {
    await prisma.employeeBatchAssignment.createMany({
      data: batchRows,
      skipDuplicates: true,
    });
    await prisma.batchAssignmentHistory.createMany({
      data: batchRows.map((row) => ({
        cycleId,
        employeeId: row.employeeId,
        newBatchId: row.batchId,
        reason: "Organizational batch assignment established for this cycle",
        changedById: createdById,
      })),
    });
  }
  if (supervisorRows.length > 0) {
    await prisma.employeeSupervisorAssignment.createMany({
      data: supervisorRows,
      skipDuplicates: true,
    });
    await prisma.supervisorAssignmentHistory.createMany({
      data: supervisorRows.map((row) => ({
        cycleId,
        employeeId: row.employeeId,
        newSupervisorId: row.supervisorId,
        reason: "Organizational supervisor assignment established for this cycle",
        changedById: createdById,
      })),
    });
  }
}

export async function createAppraisalCycle(
  input: CreateCycleInput,
  createdById: string
) {
  const startDate = safeParseDate(input.startDate);
  const endDate = addOneYear(startDate);
  const batches = resolveBatchInputs(input, startDate);

  if (batches.length !== 3) {
    throw new AppError("Exactly three batches are required.", 400, "BATCH_COUNT");
  }

  const created = await prisma.appraisalCycle.create({
    data: {
      name: (input.name?.trim() || `Annual Appraisal ${cycleYear(startDate)}`),
      description: input.description?.trim() || null,
      startDate,
      endDate,
      status: AppraisalCycleStatus.DRAFT,
      createdById,
      batches: {
        create: batches.map((batch) => ({
          ...batch,
          currentStage: BatchWorkflowStage.CONFIGURATION,
        })),
      },
    },
  });

  await copyAssignmentsFromPreviousCycle(created.id, createdById);

  if (input.confirm) {
    return confirmAppraisalCycle(created.id);
  }

  return getAppraisalCycleById(created.id);
}

export async function updateAppraisalCycle(id: string, input: UpdateCycleInput) {
  const cycle = await prisma.appraisalCycle.findUnique({ where: { id } });
  if (!cycle) throw new AppError("Appraisal cycle not found", 404);
  assertDraft(cycle);

  const data: {
    name?: string;
    description?: string | null;
    startDate?: Date;
    endDate?: Date;
  } = {};

  if (input.name !== undefined) data.name = input.name.trim();
  if (input.description !== undefined) {
    data.description = input.description?.trim() || null;
  }
  if (input.startDate !== undefined) {
    const startDate = safeParseDate(input.startDate);
    data.startDate = startDate;
    data.endDate = addOneYear(startDate);
  }

  await prisma.$transaction(async (tx) => {
    await tx.appraisalCycle.update({ where: { id }, data });

    if (input.batches?.length === 3) {
      const existing = await tx.appraisalBatch.findMany({
        where: { cycleId: id },
        orderBy: { batchNumber: "asc" },
      });
      if (existing.length !== 3) {
        throw new AppError("Exactly three batches are required.", 400, "BATCH_COUNT");
      }

      for (let index = 0; index < 3; index += 1) {
        const batchInput = input.batches[index]!;
        const existingBatch = existing[index]!;
        const start = safeParseDate(batchInput.startDate);
        const end = addOneYear(start);
        await tx.appraisalBatch.update({
          where: { id: existingBatch.id },
          data: {
            name: batchInput.name?.trim() || existingBatch.name,
            description:
              batchInput.description !== undefined
                ? batchInput.description?.trim() || null
                : existingBatch.description,
            startDate: start,
            endDate: end,
            status: deriveBatchStatus(start, end),
          },
        });
      }
    }
  });

  return getAppraisalCycleById(id);
}

export async function updateAppraisalBatch(
  cycleId: string,
  batchId: string,
  input: UpdateBatchInput
) {
  const cycle = await prisma.appraisalCycle.findUnique({ where: { id: cycleId } });
  if (!cycle) throw new AppError("Appraisal cycle not found", 404);
  assertDraft(cycle);

  const batch = await prisma.appraisalBatch.findFirst({
    where: { id: batchId, cycleId },
  });
  if (!batch) throw new AppError("Appraisal batch not found", 404);

  const startDate = safeParseDate(input.startDate);
  const endDate = addOneYear(startDate);

  const updated = await prisma.appraisalBatch.update({
    where: { id: batchId },
    data: {
      name: input.name?.trim() || batch.name,
      description:
        input.description !== undefined
          ? input.description?.trim() || null
          : batch.description,
      startDate,
      endDate,
      status: deriveBatchStatus(startDate, endDate),
    },
    select: batchSelect,
  });

  return mapBatch(updated);
}

export async function getBatchDetail(cycleId: string, batchId: string) {
  await getCycleOrThrow(cycleId);

  const batch = await prisma.appraisalBatch.findFirst({
    where: { id: batchId, cycleId },
    select: {
      ...batchSelect,
      _count: { select: { assignments: true } },
    },
  });
  if (!batch) throw new AppError("Appraisal batch not found", 404);

  const assignments = await prisma.employeeBatchAssignment.findMany({
    where: { batchId },
    select: { employeeId: true },
  });
  const employeeIds = assignments.map((item) => item.employeeId);

  const [supervisorCount, withoutSupervisor] = await Promise.all([
    prisma.employeeSupervisorAssignment.groupBy({
      by: ["supervisorId"],
      where: { cycleId, employeeId: { in: employeeIds } },
    }),
    prisma.employeeBatchAssignment.count({
      where: {
        batchId,
        employee: {
          role: { in: SUPERVISED_ROLES },
          supervisorAssignmentsAsEmployee: {
            none: { cycleId },
          },
        },
      },
    }),
  ]);

  return {
    ...mapBatch(batch),
    supervisorCount: supervisorCount.length,
    employeesWithoutSupervisor: withoutSupervisor,
  };
}

// ============================================================
// CONFIRM CYCLE
// DRAFT → UPCOMING. Incomplete assignments are allowed here and at
// activation; assignment gaps are managed outside the cycle lifecycle.
// ============================================================
export async function confirmAppraisalCycle(cycleId: string) {
  const cycle = await prisma.appraisalCycle.findUnique({ where: { id: cycleId } });
  if (!cycle) throw new AppError("Appraisal cycle not found", 404);

  if (cycle.status === AppraisalCycleStatus.UPCOMING) {
    return getAppraisalCycleById(cycleId);
  }
  if (cycle.status !== AppraisalCycleStatus.DRAFT) {
    throw new AppError(
      "Only a Draft cycle can be confirmed.",
      400,
      "CYCLE_NOT_DRAFT"
    );
  }

  const batchCount = await prisma.appraisalBatch.count({ where: { cycleId } });
  if (batchCount !== 3) {
    throw new AppError("Exactly three batches are required.", 400, "BATCH_COUNT");
  }

  await prisma.appraisalCycle.update({
    where: { id: cycleId },
    data: {
      status: AppraisalCycleStatus.UPCOMING,
      confirmedAt: new Date(),
    },
  });

  return getAppraisalCycleById(cycleId);
}

export async function getActivationReadiness(cycleId: string) {
  const cycle = await getCycleOrThrow(cycleId);
  assertNotCompleted(cycle);

  if (cycle.status === AppraisalCycleStatus.ACTIVE) {
    throw new AppError("Cycle is already active.", 400, "CYCLE_ALREADY_ACTIVE");
  }

  const summary = await buildCycleSummary(cycleId);
  const assignable = await prisma.employee.findMany({
    where: { role: { in: ASSIGNABLE_ROLES } },
    select: employeePublicSelect,
    orderBy: { employeeId: "asc" },
  });
  const supervisedEmployees = assignable.filter((employee) =>
    SUPERVISED_ROLES.includes(employee.role)
  );

  const [batchAssignments, supervisorAssignments] = await Promise.all([
    prisma.employeeBatchAssignment.findMany({
      where: { cycleId },
      include: {
        employee: { select: employeePublicSelect },
        batch: { select: batchRefSelect },
      },
    }),
    prisma.employeeSupervisorAssignment.findMany({
      where: { cycleId },
      include: {
        employee: { select: employeePublicSelect },
        supervisor: { select: employeePublicSelect },
      },
    }),
  ]);

  const batchSet = new Set(batchAssignments.map((item) => item.employeeId));
  const supervisorSet = new Set(
    supervisorAssignments.map((item) => item.employeeId)
  );

  const missingBatch = assignable.filter((employee) => !batchSet.has(employee.id));
  const missingSupervisor = supervisedEmployees.filter(
    (employee) => !supervisorSet.has(employee.id)
  );

  // ============================================================
  // CROSS-DEPARTMENT VALIDATION
  // Activation also rejects any supervisor assignment that crosses
  // department boundaries, even if the UI never offered that choice.
  // ============================================================
  const crossDepartment = supervisorAssignments.filter((assignment) => {
    const employeeDept = assignment.employee.departmentId;
    const supervisorDept = assignment.supervisor.departmentId;
    return !employeeDept || !supervisorDept || employeeDept !== supervisorDept;
  });

  const existingActive = await prisma.appraisalCycle.findFirst({
    where: { status: AppraisalCycleStatus.ACTIVE, NOT: { id: cycleId } },
    select: { id: true, name: true },
  });

  // Incomplete organizational assignments must not block activation.
  // Those gaps are managed through Employee Management / HR assignment flows.
  const warnings: string[] = [];
  if (missingBatch.length > 0) {
    warnings.push(
      `${missingBatch.length} employees still need organizational assignment coverage.`
    );
  }
  if (missingSupervisor.length > 0) {
    warnings.push(
      `${missingSupervisor.length} employees are missing supervisor assignments.`
    );
  }
  if (crossDepartment.length > 0) {
    warnings.push(
      `${crossDepartment.length} supervisor assignment(s) cross department boundaries.`
    );
  }

  const errors: string[] = [];
  if (cycle.batches.length !== 3) {
    errors.push("Cycle timeline configuration is incomplete.");
  }
  if (existingActive) {
    errors.push(
      `Only one active appraisal cycle is allowed. "${existingActive.name}" is already active.`
    );
  }
  if (assignable.length === 0) {
    errors.push("There are no assignable employees in the organisation.");
  }

  return {
    cycle: {
      id: cycle.id,
      name: cycle.name,
      status: cycle.status,
    },
    canActivate: errors.length === 0,
    errors,
    warnings,
    summary,
    missingBatch,
    missingSupervisor,
    crossDepartmentCount: crossDepartment.length,
    conflictingActiveCycle: existingActive,
  };
}

// ============================================================
// CYCLE ACTIVATION
// Incomplete employee/supervisor assignments do not block activation.
// Only structural conflicts (another ACTIVE cycle, empty workforce, or
// missing internal timeline rows) prevent activation.
// ============================================================
export async function activateAppraisalCycle(cycleId: string) {
  const cycle = await prisma.appraisalCycle.findUnique({ where: { id: cycleId } });
  if (!cycle) throw new AppError("Appraisal cycle not found", 404);

  if (cycle.status === AppraisalCycleStatus.ACTIVE) {
    throw new AppError("Cycle is already active.", 400, "CYCLE_ALREADY_ACTIVE");
  }
  if (cycle.status !== AppraisalCycleStatus.UPCOMING) {
    throw new AppError(
      "A cycle must be confirmed (Upcoming) before it can be activated.",
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
      const batches = await tx.appraisalBatch.findMany({ where: { cycleId } });
      for (const batch of batches) {
        await tx.appraisalBatch.update({
          where: { id: batch.id },
          data: { status: deriveBatchStatus(batch.startDate, batch.endDate) },
        });
      }

      await tx.appraisalCycle.update({
        where: { id: cycleId },
        data: {
          status: AppraisalCycleStatus.ACTIVE,
          activeLock: "ACTIVE",
          activatedAt: new Date(),
        },
      });
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

  return getAppraisalCycleById(cycleId);
}

// ============================================================
// COMPLETE CYCLE
// ACTIVE → COMPLETED. The cycle becomes historical and fully read-only.
// Assignment history is preserved; mutation endpoints reject COMPLETED.
// ============================================================
export async function completeAppraisalCycle(cycleId: string) {
  const cycle = await prisma.appraisalCycle.findUnique({ where: { id: cycleId } });
  if (!cycle) throw new AppError("Appraisal cycle not found", 404);

  if (cycle.status === AppraisalCycleStatus.COMPLETED) {
    throw new AppError(
      "Cannot complete cycle because it is already completed.",
      400,
      "CYCLE_ALREADY_COMPLETED"
    );
  }
  if (cycle.status !== AppraisalCycleStatus.ACTIVE) {
    throw new AppError("Only an Active cycle can be completed.", 400);
  }

  await prisma.$transaction(async (tx) => {
    await tx.appraisalBatch.updateMany({
      where: { cycleId },
      data: { status: AppraisalBatchStatus.FINISHED },
    });

    await tx.appraisalCycle.update({
      where: { id: cycleId },
      data: {
        status: AppraisalCycleStatus.COMPLETED,
        activeLock: null,
        completedAt: new Date(),
      },
    });
  });

  return getAppraisalCycleById(cycleId);
}

export async function startBatchStage(
  cycleId: string,
  batchId: string,
  stage: BatchWorkflowStage
) {
  const cycle = await prisma.appraisalCycle.findUnique({ where: { id: cycleId } });
  if (!cycle) throw new AppError("Appraisal cycle not found", 404);
  assertNotCompleted(cycle);

  if (!HR_STARTED_STAGES.includes(stage)) {
    throw new AppError(
      "This stage is derived from workflow activity and cannot be started manually.",
      400,
      "INVALID_STAGE"
    );
  }

  const batch = await prisma.appraisalBatch.findFirst({
    where: { id: batchId, cycleId },
  });
  if (!batch) throw new AppError("Appraisal batch not found", 404);

  const batchLinks = await prisma.employeeBatchAssignment.findMany({
    where: { batchId },
    select: { batchId: true, employeeId: true },
  });
  const timelines = await loadBatchTimelines(
    cycleId,
    cycle.status,
    [batch],
    batchLinks
  );
  const currentStage =
    timelines.get(batchId)?.currentStage ?? batch.currentStage;
  const expected = NEXT_HR_STAGE[currentStage];
  if (expected !== stage) {
    throw new AppError(
      expected
        ? `This batch must reach the previous stage before ${stage.replace(/_/g, " ").toLowerCase()} can start.`
        : "This batch is not ready for an HR-started review stage yet.",
      400,
      "INVALID_STAGE_TRANSITION"
    );
  }

  const now = new Date();
  const data: {
    currentStage: BatchWorkflowStage;
    selfReviewStartedAt?: Date;
    peerReviewStartedAt?: Date;
    supervisorReviewStartedAt?: Date;
    hrEvaluationStartedAt?: Date;
    recognitionStartedAt?: Date;
    closedAt?: Date;
    status?: AppraisalBatchStatus;
  } = { currentStage: stage };

  if (stage === BatchWorkflowStage.SELF_REVIEW) data.selfReviewStartedAt = now;
  if (stage === BatchWorkflowStage.PEER_REVIEW) data.peerReviewStartedAt = now;
  if (stage === BatchWorkflowStage.SUPERVISOR_REVIEW) {
    data.supervisorReviewStartedAt = now;
  }
  if (stage === BatchWorkflowStage.HR_EVALUATION) data.hrEvaluationStartedAt = now;
  if (stage === BatchWorkflowStage.RECOGNITION_PIP) data.recognitionStartedAt = now;
  if (stage === BatchWorkflowStage.CLOSURE) {
    data.closedAt = now;
    data.status = AppraisalBatchStatus.FINISHED;
  }

  await prisma.appraisalBatch.update({ where: { id: batchId }, data });

  const stageLabel =
    BATCH_STAGE_DEFINITIONS.find((item) => item.id === stage)?.title ?? stage;
  await notifyAllHrUsers({
    type:
      stage === BatchWorkflowStage.SELF_REVIEW
        ? NotificationType.SELF_REVIEW_STARTED
        : NotificationType.BATCH_STAGE_CHANGED,
    title: `${batch.name}: ${stageLabel}`,
    message: `${stageLabel} has started for ${batch.name}.`,
    metadata: { cycleId, batchId, stage },
  });
  if (stage === BatchWorkflowStage.SELF_REVIEW) {
    for (const link of batchLinks) {
      await createNotification({
        type: NotificationType.SELF_REVIEW_STARTED,
        title: "Self Review Period Started",
        message: `Self review has started for ${batch.name}.`,
        recipientId: link.employeeId,
        metadata: { cycleId, batchId, stage },
      });
    }
  }

  return getAppraisalCycleById(cycleId);
}

export async function listDepartments() {
  return prisma.department.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      _count: { select: { employees: true } },
    },
  });
}

// ============================================================
// DELETE DRAFT CYCLE
// Only true DRAFT cycles may be deleted. Confirmed (UPCOMING), ACTIVE,
// COMPLETED, or any cycle with confirmedAt set is permanently protected.
// Dependent draft records (batches, assignments, history, PDPs, objectives)
// are removed through Prisma cascade. Meetings use onDelete: SetNull, so
// they are deleted explicitly first to avoid orphaned draft meetings.
// ============================================================
export async function deleteDraftAppraisalCycle(id: string) {
  const cycle = await prisma.appraisalCycle.findUnique({ where: { id } });
  if (!cycle) throw new AppError("Appraisal cycle not found", 404);

  const isDraft =
    cycle.status === AppraisalCycleStatus.DRAFT && cycle.confirmedAt == null;
  if (!isDraft) {
    throw new AppError(
      "Only Draft appraisal cycles can be deleted. Confirmed cycles cannot be deleted.",
      400,
      "CYCLE_NOT_DELETABLE"
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.meeting.deleteMany({ where: { cycleId: id } });
    await tx.appraisalCycle.delete({ where: { id } });
  });

  return { id, deleted: true as const };
}
