import { Role } from "../../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/errors.js";
import { computePdpScoring } from "../utils/pdp-scoring.js";
import { finalPerformanceScore } from "../utils/performance-score.js";

type Actor = { id: string; role: Role };

const PROTECTED_CODES = ["EMP000001", "EMP000901", "EMP000902", "EMP000903", "EMP000904"];

async function activeCycle() {
  const cycle = await prisma.appraisalCycle.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { startDate: "desc" },
  });
  if (!cycle) throw new AppError("No active appraisal cycle is available", 400);
  return cycle;
}

const personSelect = {
  id: true,
  employeeId: true,
  name: true,
  jobTitle: true,
  department: { select: { name: true } },
  team: { select: { name: true, supervisor: { select: { id: true, name: true } } } },
} as const;

function presentEmployee(employee: {
  id: string;
  employeeId: string;
  name: string;
  jobTitle: string | null;
  department: { name: string } | null;
  team: { name: string; supervisor: { id: string; name: string } | null } | null;
}) {
  return {
    id: employee.id,
    employeeId: employee.employeeId,
    name: employee.name,
    jobTitle: employee.jobTitle,
    department: employee.department?.name ?? "Unassigned",
    team: employee.team?.name ?? "—",
    supervisor: employee.team?.supervisor?.name ?? "—",
  };
}

export type EvaluationScoreDetail = {
  pdp: {
    id: string;
    status: string;
    progress: number;
    earnedPoints: number;
    pendingReviews: number;
    updatedAt: string;
  } | null;
  selfStatus: string;
  peerCount: number;
  supervisorDecision: string;
  supervisorComment: string;
  finalStatus: string;
  approvedAt: string | null;
  scores: ReturnType<typeof finalPerformanceScore>;
};

export async function scoreMany(cycleId: string, employeeIds: string[]) {
  if (employeeIds.length === 0) return new Map<string, EvaluationScoreDetail>();
  const [pdps, selfReviews, peers, supervisors, finals] = await Promise.all([
    prisma.personalDevelopmentPlan.findMany({
      where: { cycleId, employeeId: { in: employeeIds } },
      select: {
        employeeId: true,
        id: true,
        status: true,
        updatedAt: true,
        goals: { select: { id: true, subGoals: { select: { id: true, status: true } } } },
      },
    }),
    prisma.selfReview.findMany({
      where: { cycleId, employeeId: { in: employeeIds } },
      select: { employeeId: true, status: true, totalScore: true },
    }),
    prisma.peerReview.findMany({
      where: { cycleId, subjectEmployeeId: { in: employeeIds }, status: "SUBMITTED" },
      select: { subjectEmployeeId: true, totalScore: true },
    }),
    prisma.supervisorReview.findMany({
      where: { cycleId, employeeId: { in: employeeIds } },
      select: { employeeId: true, decision: true, comment: true },
    }),
    prisma.finalEvaluation.findMany({
      where: { cycleId, employeeId: { in: employeeIds } },
      select: { employeeId: true, status: true, approvedAt: true },
    }),
  ]);
  const pdpBy = new Map(pdps.map((row) => [row.employeeId, row]));
  const selfBy = new Map(selfReviews.map((row) => [row.employeeId, row]));
  const supervisorBy = new Map(supervisors.map((row) => [row.employeeId, row]));
  const finalBy = new Map(finals.map((row) => [row.employeeId, row]));
  const peerBy = new Map<string, number[]>();
  for (const row of peers) {
    const list = peerBy.get(row.subjectEmployeeId) ?? [];
    list.push(row.totalScore);
    peerBy.set(row.subjectEmployeeId, list);
  }
  const result = new Map<string, EvaluationScoreDetail>();
  for (const employeeId of employeeIds) {
    const pdp = pdpBy.get(employeeId) ?? null;
    const scoring = pdp
      ? computePdpScoring(
          pdp.goals.map((goal) => ({
            id: goal.id,
            subGoals: goal.subGoals.map((sub) => ({ id: sub.id, status: sub.status })),
          }))
        )
      : null;
    const pendingReviews =
      pdp?.goals.reduce(
        (sum, goal) => sum + goal.subGoals.filter((sub) => sub.status === "PENDING_APPROVAL").length,
        0
      ) ?? 0;
    const selfReview = selfBy.get(employeeId);
    const peerScores = peerBy.get(employeeId) ?? [];
    const supervisor = supervisorBy.get(employeeId);
    const finalRow = finalBy.get(employeeId);
    const self = selfReview?.status === "SUBMITTED" ? selfReview.totalScore : 0;
    const peer = Number(peerScores.reduce((sum, score) => sum + score, 0).toFixed(2));
    result.set(employeeId, {
      pdp: pdp
        ? {
            id: pdp.id,
            status: pdp.status,
            progress: scoring?.progressPercent ?? 0,
            earnedPoints: scoring?.earnedPoints ?? 0,
            pendingReviews,
            updatedAt: pdp.updatedAt.toISOString(),
          }
        : null,
      selfStatus: selfReview?.status ?? "NOT_STARTED",
      peerCount: peerScores.length,
      supervisorDecision: supervisor?.decision ?? "PENDING",
      supervisorComment: supervisor?.comment ?? "",
      finalStatus: finalRow?.status ?? "NOT_STARTED",
      approvedAt: finalRow?.approvedAt?.toISOString() ?? null,
      scores: finalPerformanceScore(self, peer, scoring?.earnedPoints ?? 0),
    });
  }
  return result;
}

export async function scoreEmployee(cycleId: string, employeeId: string): Promise<EvaluationScoreDetail> {
  const map = await scoreMany(cycleId, [employeeId]);
  return (
    map.get(employeeId) ?? {
      pdp: null,
      selfStatus: "NOT_STARTED",
      peerCount: 0,
      supervisorDecision: "PENDING",
      supervisorComment: "",
      finalStatus: "NOT_STARTED",
      approvedAt: null,
      scores: finalPerformanceScore(0, 0, 0),
    }
  );
}

function isCompletedPackage(row: EvaluationScoreDetail) {
  return (
    row.selfStatus === "SUBMITTED" &&
    row.peerCount >= 2 &&
    row.supervisorDecision === "APPROVED" &&
    Boolean(row.pdp)
  );
}

export async function listHrPerformanceBoard(actor: Actor) {
  if (actor.role !== Role.HR && actor.role !== Role.HR_MANAGER) {
    throw new AppError("Only HR can view the performance evaluation board", 403);
  }
  const cycle = await activeCycle();
  const withPdp = await prisma.personalDevelopmentPlan.findMany({
    where: { cycleId: cycle.id, employee: { role: Role.EMPLOYEE, deactivatedAt: null } },
    select: { employeeId: true },
    orderBy: { updatedAt: "desc" },
  });
  const assignedIds = [...new Set(withPdp.map((row) => row.employeeId))];
  const protectedPeople = await prisma.employee.findMany({
    where: { employeeId: { in: PROTECTED_CODES }, deactivatedAt: null },
    select: { id: true },
  });
  const assignedPick = [
    ...protectedPeople.map((person) => person.id).filter((id) => assignedIds.includes(id)),
    ...assignedIds.filter((id) => !protectedPeople.some((person) => person.id === id)),
  ].slice(0, 18);

  const notAssigned = await prisma.employee.findMany({
    where: {
      role: Role.EMPLOYEE,
      deactivatedAt: null,
      id: { notIn: assignedIds },
    },
    select: personSelect,
    orderBy: { name: "asc" },
    take: 12,
  });

  const assignedPeople = await prisma.employee.findMany({
    where: { id: { in: assignedPick } },
    select: personSelect,
    orderBy: { name: "asc" },
  });

  const assignedScores = await scoreMany(cycle.id, assignedPeople.map((employee) => employee.id));
  const assigned = assignedPeople.map((employee) => ({
    employee: presentEmployee(employee),
    ...(assignedScores.get(employee.id) ?? {
      pdp: null,
      selfStatus: "NOT_STARTED",
      peerCount: 0,
      supervisorDecision: "PENDING",
      supervisorComment: "",
      finalStatus: "NOT_STARTED",
      approvedAt: null,
      scores: finalPerformanceScore(0, 0, 0),
    }),
  }));

  return {
    cycle: { id: cycle.id, name: cycle.name },
    assigned,
    notAssigned: notAssigned.map((employee) => ({
      employee: presentEmployee(employee),
      pdp: null,
      selfStatus: "NOT_STARTED",
      peerCount: 0,
      supervisorDecision: "PENDING",
      supervisorComment: "",
      finalStatus: "NOT_STARTED",
      approvedAt: null,
      scores: finalPerformanceScore(0, 0, 0),
    })),
  };
}

export async function listFinalEvaluationBoard(actor: Actor) {
  if (actor.role !== Role.HR && actor.role !== Role.HR_MANAGER && actor.role !== Role.SUPERVISOR) {
    throw new AppError("You do not have permission to view final evaluations", 403);
  }
  const cycle = await activeCycle();
  const limit = actor.role === Role.SUPERVISOR ? 3 : actor.role === Role.HR ? 10 : 20;

  const employeeWhere =
    actor.role === Role.SUPERVISOR
      ? { role: Role.EMPLOYEE, deactivatedAt: null, team: { supervisorId: actor.id } }
      : { role: Role.EMPLOYEE, deactivatedAt: null };

  const completedReviews = await prisma.supervisorReview.findMany({
    where: {
      cycleId: cycle.id,
      decision: "APPROVED",
      ...(actor.role === Role.SUPERVISOR ? { employee: { team: { supervisorId: actor.id } } } : {}),
    },
    select: { employeeId: true },
  });
  const candidateIds = completedReviews.map((row) => row.employeeId);
  const employees = await prisma.employee.findMany({
    where: { ...employeeWhere, id: { in: candidateIds } },
    select: personSelect,
    orderBy: { name: "asc" },
  });
  const scores = await scoreMany(
    cycle.id,
    employees.map((employee) => employee.id)
  );
  const rows = employees
    .map((employee) => {
      const detail = scores.get(employee.id);
      if (!detail || !isCompletedPackage(detail)) return null;
      return { employee: presentEmployee(employee), ...detail };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .slice(0, limit);

  return {
    cycle: { id: cycle.id, name: cycle.name },
    items: rows,
  };
}
