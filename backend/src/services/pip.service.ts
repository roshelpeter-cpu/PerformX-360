import { PlanType, Role } from "../../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/errors.js";
import { scoreMany } from "./evaluation-board.service.js";

type Actor = { id: string; role: Role };

function pipLabel(status: string | null) {
  if (!status) return "Not Started";
  if (status === "DRAFT") return "Draft";
  if (status === "PENDING_EMPLOYEE_REVIEW" || status === "PENDING_EMPLOYEE_REREVIEW") {
    return "Pending Employee Approval";
  }
  if (status === "PENDING_HR_REVIEW" || status === "PENDING_REAPPROVAL") {
    return "Pending HR Approval";
  }
  if (status === "ACTIVE" || status === "ASSIGNED" || status === "APPROVED") return "Active";
  if (status === "COMPLETED") return "Completed";
  return status.replaceAll("_", " ");
}

function appraisalFinished(finalStatus: string, supervisorDecision: string) {
  return finalStatus === "FINAL_APPROVED" || supervisorDecision === "APPROVED" ? "Appraisal Finished" : "In Progress";
}

export async function listPipBoard(actor: Actor) {
  if (
    actor.role !== Role.SUPERVISOR &&
    actor.role !== Role.HR &&
    actor.role !== Role.HR_MANAGER
  ) {
    throw new AppError("You do not have permission to view PIP management", 403);
  }

  const cycle = await prisma.appraisalCycle.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { startDate: "desc" },
  });
  if (!cycle) throw new AppError("No active appraisal cycle is available", 400);

  const pips = await prisma.personalDevelopmentPlan.findMany({
    where: { cycleId: cycle.id, planType: PlanType.PIP },
    include: {
      employee: {
        select: {
          id: true,
          employeeId: true,
          name: true,
          department: { select: { name: true } },
          team: { select: { name: true, supervisor: { select: { id: true, name: true } } } },
        },
      },
      supervisor: { select: { id: true, name: true, employeeId: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  const pipByEmployee = new Map(pips.map((pip) => [pip.employeeId, pip]));

  const pdps = await prisma.personalDevelopmentPlan.findMany({
    where: { cycleId: cycle.id, planType: PlanType.PDP },
    select: { employeeId: true, status: true, title: true },
  });
  const pdpByEmployee = new Map(pdps.map((pdp) => [pdp.employeeId, pdp]));

  const candidatePool = await prisma.employee.findMany({
    where: { role: Role.EMPLOYEE, deactivatedAt: null },
    select: {
      id: true,
      employeeId: true,
      name: true,
      department: { select: { name: true } },
      team: { select: { name: true, supervisor: { select: { id: true, name: true } } } },
    },
  });
  const scores = await scoreMany(
    cycle.id,
    candidatePool.map((employee) => employee.id)
  );

  const lowScore = candidatePool
    .map((employee) => {
      const detail = scores.get(employee.id);
      return {
        employee,
        detail,
        finalScore: detail?.scores.total ?? 0,
        band: detail?.scores.band ?? "Needs Improvement",
      };
    })
    .filter((row) => row.finalScore > 0 && row.finalScore < 70)
    .sort((a, b) => a.finalScore - b.finalScore);

  const selectedIds = new Set<string>([
    ...pips.map((pip) => pip.employeeId),
    ...lowScore.slice(0, 10).map((row) => row.employee.id),
  ]);

  const rows = candidatePool
    .filter((employee) => selectedIds.has(employee.id))
    .map((employee) => {
      const pip = pipByEmployee.get(employee.id) ?? null;
      const pdp = pdpByEmployee.get(employee.id) ?? null;
      const detail = scores.get(employee.id);
      return {
        employee: {
          id: employee.id,
          employeeId: employee.employeeId,
          name: employee.name,
          department: employee.department?.name ?? "Unassigned",
          team: employee.team?.name ?? "—",
          supervisor: employee.team?.supervisor?.name ?? pip?.supervisor?.name ?? "—",
        },
        finalScore: detail?.scores.total ?? 0,
        performanceBand: detail?.scores.band ?? "Needs Improvement",
        currentPdp: pdp?.title ?? (pdp ? "Current PDP" : "No current PDP"),
        currentPdpStatus: pdp?.status ?? "NOT_STARTED",
        appraisalStatus: appraisalFinished(detail?.finalStatus ?? "NOT_STARTED", detail?.supervisorDecision ?? "PENDING"),
        pipId: pip?.id ?? null,
        pipStatus: pipLabel(pip?.status ?? null),
        pipRawStatus: pip?.status ?? null,
        createdAt: pip?.createdAt.toISOString() ?? null,
      };
    })
    .sort((a, b) => a.finalScore - b.finalScore || a.employee.name.localeCompare(b.employee.name));

  return {
    cycle: { id: cycle.id, name: cycle.name },
    items: rows,
  };
}
