import { AwardCategory, AwardStatus, NotificationType, Role } from "../../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/errors.js";
import { createNotification } from "./notification.service.js";
import { scoreMany } from "./evaluation-board.service.js";

type Actor = { id: string; role: Role };

const CATEGORY_TITLES: Record<AwardCategory, string> = {
  OUTSTANDING_PERFORMER: "Outstanding Performer Award",
  EMPLOYEE_OF_THE_YEAR: "Employee of the Year",
  EMPLOYEE_OF_THE_MONTH: "Employee of the Month",
};

function assertHrm(actor: Actor) {
  if (actor.role !== Role.HR_MANAGER) {
    throw new AppError("Only an HR Manager can manage awards and recognition", 403);
  }
}

async function activeCycle() {
  const cycle = await prisma.appraisalCycle.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { startDate: "desc" },
  });
  if (!cycle) throw new AppError("No active appraisal cycle is available", 400);
  return cycle;
}

function presentAward(row: {
  id: string;
  category: AwardCategory;
  title: string;
  reason: string;
  finalScore: number;
  performanceBand: string;
  status: AwardStatus;
  approvedAt: Date | null;
  createdAt: Date;
  employee: {
    id: string;
    employeeId: string;
    name: string;
    department: { name: string } | null;
  };
  approvedBy: { id: string; name: string; employeeId: string } | null;
}) {
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    reason: row.reason,
    finalScore: row.finalScore,
    performanceBand: row.performanceBand,
    status: row.status,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    employee: {
      id: row.employee.id,
      employeeId: row.employee.employeeId,
      name: row.employee.name,
      department: row.employee.department?.name ?? "Unassigned",
    },
    approvedBy: row.approvedBy,
  };
}

function buildReason(input: {
  name: string;
  category: AwardCategory;
  finalScore: number;
  band: string;
  pdpProgress: number;
  selfStatus: string;
  peerCount: number;
  supervisorDecision: string;
}) {
  const reviews = [
    input.selfStatus === "SUBMITTED" ? "a submitted self review" : null,
    input.peerCount > 0 ? `${input.peerCount} submitted peer review${input.peerCount === 1 ? "" : "s"}` : null,
    input.supervisorDecision === "APPROVED" ? "supervisor endorsement" : null,
  ].filter(Boolean);
  const reviewText = reviews.length > 0 ? reviews.join(", ") : "completed appraisal evidence";
  if (input.category === AwardCategory.OUTSTANDING_PERFORMER) {
    return `${input.name} is recommended for Outstanding Performer with a final score of ${input.finalScore.toFixed(1)} (${input.band}), ${input.pdpProgress}% PDP completion, and ${reviewText}.`;
  }
  if (input.category === AwardCategory.EMPLOYEE_OF_THE_YEAR) {
    return `${input.name} is recommended for Employee of the Year based on a final score of ${input.finalScore.toFixed(1)} (${input.band}), sustained PDP progress of ${input.pdpProgress}%, and ${reviewText}.`;
  }
  return `${input.name} is recommended for Employee of the Month with a final score of ${input.finalScore.toFixed(1)} (${input.band}), ${input.pdpProgress}% PDP completion, and ${reviewText}.`;
}

export async function listAwards(actor: Actor) {
  assertHrm(actor);
  const cycle = await activeCycle();
  const awards = await prisma.recognitionAward.findMany({
    where: { cycleId: cycle.id },
    include: {
      employee: { select: { id: true, employeeId: true, name: true, department: { select: { name: true } } } },
      approvedBy: { select: { id: true, name: true, employeeId: true } },
    },
    orderBy: [{ status: "asc" }, { finalScore: "desc" }],
  });
  return {
    cycle: { id: cycle.id, name: cycle.name },
    awards: awards.map(presentAward),
  };
}

export async function getAward(actor: Actor, awardId: string) {
  assertHrm(actor);
  const award = await prisma.recognitionAward.findUnique({
    where: { id: awardId },
    include: {
      employee: { select: { id: true, employeeId: true, name: true, department: { select: { name: true } } } },
      approvedBy: { select: { id: true, name: true, employeeId: true } },
    },
  });
  if (!award) throw new AppError("Award not found", 404);
  return presentAward(award);
}

export async function generateAwards(actor: Actor) {
  assertHrm(actor);
  const cycle = await activeCycle();
  const existing = await prisma.recognitionAward.findMany({
    where: { cycleId: cycle.id },
    select: { category: true, employeeId: true },
  });
  const existingCategories = new Set(existing.map((row) => row.category));
  const usedEmployees = new Set(existing.map((row) => row.employeeId));

  const employees = await prisma.employee.findMany({
    where: { role: Role.EMPLOYEE, deactivatedAt: null },
    select: { id: true, employeeId: true, name: true },
  });
  const scores = await scoreMany(
    cycle.id,
    employees.map((employee) => employee.id)
  );
  const ranked = employees
    .map((employee) => {
      const detail = scores.get(employee.id);
      return {
        employee,
        detail,
        finalScore: detail?.scores.total ?? 0,
        band: detail?.scores.band ?? "Needs Improvement",
        pdpProgress: detail?.pdp?.progress ?? 0,
      };
    })
    .filter((row) => row.finalScore > 0)
    .sort((a, b) => b.finalScore - a.finalScore || b.pdpProgress - a.pdpProgress);

  const picks: Array<{ category: AwardCategory; row: (typeof ranked)[number] }> = [];
  const takeNext = (category: AwardCategory) => {
    if (existingCategories.has(category)) return;
    const next = ranked.find((row) => !usedEmployees.has(row.employee.id));
    if (!next) return;
    usedEmployees.add(next.employee.id);
    picks.push({ category, row: next });
  };
  takeNext(AwardCategory.OUTSTANDING_PERFORMER);
  takeNext(AwardCategory.EMPLOYEE_OF_THE_YEAR);
  takeNext(AwardCategory.EMPLOYEE_OF_THE_MONTH);

  for (const pick of picks) {
    const reason = buildReason({
      name: pick.row.employee.name,
      category: pick.category,
      finalScore: pick.row.finalScore,
      band: pick.row.band,
      pdpProgress: pick.row.pdpProgress,
      selfStatus: pick.row.detail?.selfStatus ?? "NOT_STARTED",
      peerCount: pick.row.detail?.peerCount ?? 0,
      supervisorDecision: pick.row.detail?.supervisorDecision ?? "PENDING",
    });
    const created = await prisma.recognitionAward.create({
      data: {
        cycleId: cycle.id,
        employeeId: pick.row.employee.id,
        category: pick.category,
        title: CATEGORY_TITLES[pick.category],
        reason,
        finalScore: pick.row.finalScore,
        performanceBand: pick.row.band,
        status: AwardStatus.PENDING,
      },
    });
    await createNotification({
      type: NotificationType.AWARD_RECOMMENDED,
      title: `${CATEGORY_TITLES[pick.category]} recommended`,
      message: reason,
      recipientId: actor.id,
      subjectEmployeeId: pick.row.employee.id,
      metadata: { awardId: created.id },
    });
  }

  return listAwards(actor);
}

export async function approveAward(actor: Actor, awardId: string) {
  assertHrm(actor);
  const award = await prisma.recognitionAward.findUnique({
    where: { id: awardId },
    include: { employee: { select: { id: true, name: true } } },
  });
  if (!award) throw new AppError("Award not found", 404);
  if (award.status === AwardStatus.APPROVED) {
    return getAward(actor, awardId);
  }

  await prisma.recognitionAward.update({
    where: { id: awardId },
    data: {
      status: AwardStatus.APPROVED,
      approvedById: actor.id,
      approvedAt: new Date(),
    },
  });
  await createNotification({
    type: NotificationType.AWARD_APPROVED,
    title: `${award.title} approved`,
    message: `${award.employee.name} has been approved for ${award.title}.`,
    recipientId: award.employeeId,
    subjectEmployeeId: award.employeeId,
    metadata: { awardId },
  });
  return getAward(actor, awardId);
}
