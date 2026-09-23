import { NotificationType, Role } from "../../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/errors.js";
import { computeBonus } from "../utils/bonus-formula.js";
import { createNotification } from "./notification.service.js";
import { scoreEmployee, scoreMany } from "./evaluation-board.service.js";

type Actor = { id: string; role: Role };

function assertHrm(actor: Actor) {
  if (actor.role !== Role.HR_MANAGER) {
    throw new AppError("Only an HR Manager can calculate or authorize bonuses", 403);
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

function presentBonus(row: {
  id: string;
  finalScore: number;
  band: string;
  bonusMonths: number;
  dailyAmount: number;
  workingDaysPerMonth: number;
  amount: number;
  calculation: string;
  status: string;
  authorizedAt: Date | null;
  employee: { id: string; employeeId: string; name: string };
}) {
  return {
    id: row.id,
    finalScore: row.finalScore,
    band: row.band,
    bonusMonths: row.bonusMonths,
    dailyAmount: row.dailyAmount,
    workingDaysPerMonth: row.workingDaysPerMonth,
    amount: row.amount,
    calculation: row.calculation,
    status: row.status,
    authorizedAt: row.authorizedAt?.toISOString() ?? null,
    employee: row.employee,
  };
}

function eligible(detail: Awaited<ReturnType<typeof scoreEmployee>>) {
  return (
    detail.selfStatus === "SUBMITTED" &&
    detail.peerCount >= 2 &&
    detail.supervisorDecision === "APPROVED" &&
    Boolean(detail.pdp) &&
    (detail.finalStatus === "FINAL_APPROVED" || detail.supervisorDecision === "APPROVED")
  );
}

export async function listBonuses(actor: Actor) {
  assertHrm(actor);
  const cycle = await activeCycle();
  const existing = await prisma.bonusCalculation.findMany({
    where: { cycleId: cycle.id },
    include: { employee: { select: { id: true, employeeId: true, name: true } } },
    orderBy: { updatedAt: "desc" },
  });
  const byEmployee = new Map(existing.map((row) => [row.employeeId, row]));

  const approved = await prisma.supervisorReview.findMany({
    where: { cycleId: cycle.id, decision: "APPROVED" },
    select: { employeeId: true },
  });
  const employees = await prisma.employee.findMany({
    where: { role: Role.EMPLOYEE, deactivatedAt: null, id: { in: approved.map((row) => row.employeeId) } },
    select: { id: true, employeeId: true, name: true },
    orderBy: { name: "asc" },
  });
  const details = await scoreMany(
    cycle.id,
    employees.map((employee) => employee.id)
  );

  const needsCalculation = [];
  for (const employee of employees) {
    const saved = byEmployee.get(employee.id);
    if (saved?.status === "AUTHORIZED") continue;
    const detail = details.get(employee.id);
    if (!detail || !eligible(detail)) continue;
    needsCalculation.push({
      employee,
      finalScore: detail.scores.total,
      band: detail.scores.band,
      bonusStatus: saved ? "Calculated" : "Needs Calculation",
      calculation: saved ? presentBonus(saved) : null,
    });
    if (needsCalculation.length >= 20) break;
  }

  const completed = existing
    .filter((row) => row.status === "AUTHORIZED")
    .slice(0, 10)
    .map(presentBonus);

  return {
    cycle: { id: cycle.id, name: cycle.name },
    formula: {
      dailyAmount: 2500,
      workingDaysPerMonth: 22,
      months: {
        "90-100": 6,
        "80-89": 5.5,
        "70-79": 5,
        "60-69": 4,
        "below-60": 0,
      },
      interpretation: "Bonus Amount = Fixed Daily Bonus Amount × months × 22 working days",
    },
    needsCalculation,
    completed,
  };
}

export async function getBonus(actor: Actor, employeeId: string) {
  assertHrm(actor);
  const cycle = await activeCycle();
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, deactivatedAt: null },
    select: { id: true, employeeId: true, name: true },
  });
  if (!employee) throw new AppError("Employee not found", 404);
  const detail = await scoreEmployee(cycle.id, employeeId);
  const saved = await prisma.bonusCalculation.findUnique({
    where: { cycleId_employeeId: { cycleId: cycle.id, employeeId } },
    include: { employee: { select: { id: true, employeeId: true, name: true } } },
  });
  return {
    employee,
    scores: detail.scores,
    eligible: eligible(detail),
    bonus: saved ? presentBonus(saved) : null,
  };
}

export async function calculateBonus(actor: Actor, employeeId: string) {
  assertHrm(actor);
  const cycle = await activeCycle();
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, role: Role.EMPLOYEE, deactivatedAt: null },
    select: { id: true, employeeId: true, name: true },
  });
  if (!employee) throw new AppError("Employee not found", 404);
  const detail = await scoreEmployee(cycle.id, employeeId);
  if (!eligible(detail)) {
    throw new AppError("Bonus can be calculated only after self, peer, and supervisor reviews are complete", 400);
  }
  const existing = await prisma.bonusCalculation.findUnique({
    where: { cycleId_employeeId: { cycleId: cycle.id, employeeId } },
  });
  if (existing?.status === "AUTHORIZED") {
    throw new AppError("This bonus has already been authorized", 400);
  }
  const computed = computeBonus(detail.scores.total);
  const row = await prisma.bonusCalculation.upsert({
    where: { cycleId_employeeId: { cycleId: cycle.id, employeeId } },
    create: {
      cycleId: cycle.id,
      employeeId,
      finalScore: computed.finalScore,
      band: computed.band,
      bonusMonths: computed.bonusMonths,
      dailyAmount: computed.dailyAmount,
      workingDaysPerMonth: computed.workingDaysPerMonth,
      amount: computed.amount,
      calculation: computed.calculation,
      status: "CALCULATED",
    },
    update: {
      finalScore: computed.finalScore,
      band: computed.band,
      bonusMonths: computed.bonusMonths,
      dailyAmount: computed.dailyAmount,
      workingDaysPerMonth: computed.workingDaysPerMonth,
      amount: computed.amount,
      calculation: computed.calculation,
      status: "CALCULATED",
    },
    include: { employee: { select: { id: true, employeeId: true, name: true } } },
  });
  return presentBonus(row);
}

export async function authorizeBonus(actor: Actor, employeeId: string) {
  assertHrm(actor);
  const cycle = await activeCycle();
  let row = await prisma.bonusCalculation.findUnique({
    where: { cycleId_employeeId: { cycleId: cycle.id, employeeId } },
    include: { employee: { select: { id: true, employeeId: true, name: true } } },
  });
  if (!row) {
    await calculateBonus(actor, employeeId);
    row = await prisma.bonusCalculation.findUniqueOrThrow({
      where: { cycleId_employeeId: { cycleId: cycle.id, employeeId } },
      include: { employee: { select: { id: true, employeeId: true, name: true } } },
    });
  }
  if (row.status === "AUTHORIZED") {
    return presentBonus(row);
  }
  const updated = await prisma.bonusCalculation.update({
    where: { id: row.id },
    data: { status: "AUTHORIZED", authorizedById: actor.id, authorizedAt: new Date() },
    include: { employee: { select: { id: true, employeeId: true, name: true } } },
  });
  await createNotification({
    type: NotificationType.BONUS_AUTHORIZED,
    title: "Bonus authorized",
    message: `Your performance bonus of ${updated.amount.toFixed(2)} has been authorized.`,
    recipientId: employeeId,
    subjectEmployeeId: employeeId,
    metadata: { cycleId: cycle.id, amount: updated.amount },
  });
  return presentBonus(updated);
}
