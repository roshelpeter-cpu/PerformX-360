import { NotificationType, Role } from "../../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/errors.js";
import { computePdpScoring } from "../utils/pdp-scoring.js";
import { finalPerformanceScore } from "../utils/performance-score.js";
import { createNotification, notifyAllHrUsers } from "./notification.service.js";

type Actor = { id: string; role: Role };

async function activeCycle() {
  const cycle = await prisma.appraisalCycle.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { startDate: "desc" },
  });
  if (!cycle) throw new AppError("No active appraisal cycle is available", 400);
  return cycle;
}

const person = {
  id: true,
  employeeId: true,
  name: true,
  department: { select: { name: true } },
  team: { select: { name: true, supervisor: { select: { id: true, name: true } } } },
} as const;

async function scoreBundle(cycleId: string, employeeId: string) {
  const pdp = await prisma.personalDevelopmentPlan.findFirst({
    where: { employeeId, cycleId, planType: "PDP" },
    select: { goals: { select: { id: true, subGoals: { select: { id: true, status: true } } } } },
  });
  const scoring = pdp
    ? computePdpScoring(
        pdp.goals.map((goal) => ({
          id: goal.id,
          subGoals: goal.subGoals.map((sub) => ({ id: sub.id, status: sub.status })),
        }))
      )
    : null;
  const selfReview = await prisma.selfReview.findUnique({
    where: { employeeId_cycleId: { employeeId, cycleId } },
    select: { status: true, totalScore: true },
  });
  const peers = await prisma.peerReview.findMany({
    where: { cycleId, subjectEmployeeId: employeeId, status: "SUBMITTED" },
    select: { totalScore: true },
  });
  const self = selfReview?.status === "SUBMITTED" ? selfReview.totalScore : 0;
  const peer = Number(peers.reduce((sum, review) => sum + review.totalScore, 0).toFixed(2));
  const scores = finalPerformanceScore(self, peer, scoring?.earnedPoints ?? 0);
  return {
    pdpScore: scoring?.earnedPoints ?? 0,
    pdpProgress: scoring?.progressPercent ?? 0,
    scores,
  };
}

function present(row: {
  id: string;
  reason: string;
  pdpScore: number;
  status: string;
  hrReason: string | null;
  decidedAt: Date | null;
  createdAt: Date;
  employee: {
    id: string;
    employeeId: string;
    name: string;
    department: { name: string } | null;
    team: { name: string; supervisor: { id: string; name: string } | null } | null;
  };
  supervisor: { id: string; name: string; employeeId: string };
  decidedBy: { id: string; name: string } | null;
  scores?: ReturnType<typeof finalPerformanceScore>;
  pdpProgress?: number;
}) {
  return {
    id: row.id,
    reason: row.reason,
    pdpScore: row.pdpScore,
    status: row.status,
    hrReason: row.hrReason,
    decidedAt: row.decidedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    employee: {
      id: row.employee.id,
      employeeId: row.employee.employeeId,
      name: row.employee.name,
      department: row.employee.department?.name ?? "Unassigned",
      team: row.employee.team?.name ?? "—",
    },
    supervisor: { id: row.supervisor.id, employeeId: row.supervisor.employeeId, name: row.supervisor.name },
    decidedBy: row.decidedBy ? { id: row.decidedBy.id, name: row.decidedBy.name } : null,
    scores: row.scores ?? null,
    pdpProgress: row.pdpProgress ?? null,
    band: row.scores?.band ?? null,
  };
}

export async function listPromotionRecommendations(actor: Actor) {
  if (actor.role !== Role.HR && actor.role !== Role.HR_MANAGER && actor.role !== Role.SUPERVISOR) {
    throw new AppError("You do not have permission to view promotion recommendations", 403);
  }
  const cycle = await activeCycle();
  const where =
    actor.role === Role.SUPERVISOR
      ? { cycleId: cycle.id, supervisorId: actor.id }
      : { cycleId: cycle.id };
  const rows = await prisma.promotionRecommendation.findMany({
    where,
    include: {
      employee: { select: person },
      supervisor: { select: { id: true, name: true, employeeId: true } },
      decidedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  const items = [];
  for (const row of rows) {
    const bundle = await scoreBundle(cycle.id, row.employeeId);
    items.push(present({ ...row, scores: bundle.scores, pdpProgress: bundle.pdpProgress, pdpScore: bundle.pdpScore }));
  }
  return { cycle: { id: cycle.id, name: cycle.name }, items };
}

export async function getPromotionRecommendation(actor: Actor, id: string) {
  const list = await listPromotionRecommendations(actor);
  const item = list.items.find((row) => row.id === id);
  if (!item) throw new AppError("Promotion recommendation not found", 404);
  return item;
}

export async function recommendPromotion(actor: Actor, employeeId: string, reason: string) {
  if (actor.role !== Role.SUPERVISOR) {
    throw new AppError("Only the supervisor can recommend an employee for promotion", 403);
  }
  const trimmed = reason.trim();
  if (trimmed.length < 8) throw new AppError("A reason for the recommendation is required", 400);
  const team = await prisma.team.findFirst({
    where: { supervisorId: actor.id, employees: { some: { id: employeeId, deactivatedAt: null } } },
    select: { id: true },
  });
  if (!team) throw new AppError("You can only recommend employees on your team", 403);
  const cycle = await activeCycle();
  const bundle = await scoreBundle(cycle.id, employeeId);
  if (bundle.pdpProgress < 80) {
    throw new AppError("Promotion recommendations are available once the PDP is in the final stage", 400);
  }
  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { name: true } });
  const row = await prisma.promotionRecommendation.upsert({
    where: { cycleId_employeeId: { cycleId: cycle.id, employeeId } },
    create: {
      cycleId: cycle.id,
      employeeId,
      supervisorId: actor.id,
      reason: trimmed,
      pdpScore: bundle.pdpScore,
      status: "PENDING",
    },
    update: {
      supervisorId: actor.id,
      reason: trimmed,
      pdpScore: bundle.pdpScore,
      status: "PENDING",
      hrReason: null,
      decidedById: null,
      decidedAt: null,
    },
    include: {
      employee: { select: person },
      supervisor: { select: { id: true, name: true, employeeId: true } },
      decidedBy: { select: { id: true, name: true } },
    },
  });
  await notifyAllHrUsers({
    type: NotificationType.PROMOTION_RECOMMENDED,
    title: "Promotion recommendation submitted",
    message: `${employee?.name ?? "An employee"} was recommended for promotion. Reason: ${trimmed}`,
    subjectEmployeeId: employeeId,
    metadata: { cycleId: cycle.id, recommendationId: row.id },
  });
  return present({ ...row, scores: bundle.scores, pdpProgress: bundle.pdpProgress });
}

async function decide(actor: Actor, id: string, status: "SHORTLISTED" | "REJECTED", reason: string) {
  if (actor.role !== Role.HR) {
    throw new AppError("Only HR can shortlist or reject a promotion recommendation", 403);
  }
  const trimmed = reason.trim();
  if (trimmed.length < 8) throw new AppError("An HR decision reason is required", 400);
  const existing = await prisma.promotionRecommendation.findUnique({
    where: { id },
    include: { employee: { select: { name: true } }, supervisor: { select: { id: true } } },
  });
  if (!existing) throw new AppError("Promotion recommendation not found", 404);
  if (existing.status !== "PENDING") {
    throw new AppError("This recommendation has already been decided", 400);
  }
  const row = await prisma.promotionRecommendation.update({
    where: { id },
    data: { status, hrReason: trimmed, decidedById: actor.id, decidedAt: new Date() },
    include: {
      employee: { select: person },
      supervisor: { select: { id: true, name: true, employeeId: true } },
      decidedBy: { select: { id: true, name: true } },
    },
  });
  const label = status === "SHORTLISTED" ? "shortlisted" : "rejected";
  await createNotification({
    type: NotificationType.PROMOTION_DECIDED,
    title: `Promotion recommendation ${label}`,
    message: `HR ${label} the promotion recommendation for ${existing.employee.name}. Reason: ${trimmed}`,
    recipientId: existing.supervisor.id,
    subjectEmployeeId: existing.employeeId,
    metadata: { recommendationId: id, status },
  });
  await createNotification({
    type: NotificationType.PROMOTION_DECIDED,
    title: `Promotion recommendation ${label}`,
    message: `HR ${label} your promotion recommendation. Reason: ${trimmed}`,
    recipientId: existing.employeeId,
    subjectEmployeeId: existing.employeeId,
    metadata: { recommendationId: id, status },
  });
  const bundle = await scoreBundle(existing.cycleId, existing.employeeId);
  return present({ ...row, scores: bundle.scores, pdpProgress: bundle.pdpProgress, pdpScore: bundle.pdpScore });
}

export function shortlistPromotion(actor: Actor, id: string, reason: string) {
  return decide(actor, id, "SHORTLISTED", reason);
}

export function rejectPromotion(actor: Actor, id: string, reason: string) {
  return decide(actor, id, "REJECTED", reason);
}
