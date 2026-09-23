import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
import PDFDocument from "pdfkit";
import { PlanType, Role } from "../../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/errors.js";
import { scoreMany } from "./evaluation-board.service.js";
import type { LeadershipReportQuery } from "../validations/leadership.validation.js";

type Actor = { id: string; role: Role };

const BAND_ORDER = [
  "Outstanding",
  "Exceeds Expectations",
  "Meets Expectations",
  "Needs Improvement",
  "Below Expectations",
] as const;

function assertLeadership(actor: Actor) {
  if (actor.role !== Role.LEADERSHIP) {
    throw new AppError("Only leadership can access organisation reports", 403);
  }
}

function displayBand(band: string) {
  if (band === "Performance Improvement Required") return "Below Expectations";
  return band;
}

function pct(part: number, total: number) {
  return total ? Math.round((part / total) * 100) : 0;
}

async function resolveCycle(cycleId?: string) {
  if (cycleId) {
    const cycle = await prisma.appraisalCycle.findUnique({
      where: { id: cycleId },
      include: { stages: { orderBy: { sortOrder: "asc" } } },
    });
    if (!cycle) throw new AppError("Appraisal cycle not found", 404);
    return cycle;
  }
  const active = await prisma.appraisalCycle.findFirst({
    where: { status: "ACTIVE" },
    include: { stages: { orderBy: { sortOrder: "asc" } } },
    orderBy: { startDate: "desc" },
  });
  if (active) return active;
  const fallback = await prisma.appraisalCycle.findFirst({
    include: { stages: { orderBy: { sortOrder: "asc" } } },
    orderBy: { startDate: "desc" },
  });
  if (!fallback) throw new AppError("No appraisal cycle is available", 400);
  return fallback;
}

function cycleDates(cycle: {
  startDate: Date;
  endDate: Date;
  stages: Array<{ key: string; title: string; startDate: Date; endDate: Date }>;
}) {
  const selfReview = cycle.stages.find((stage) => stage.key === "SELF_REVIEW");
  const managerReview = cycle.stages.find((stage) => stage.key === "SUPERVISOR_REVIEW");
  const hrEvaluation = cycle.stages.find((stage) => stage.key === "HR_EVALUATION");
  return [
    { label: "Self Review Deadline", date: (selfReview?.endDate ?? cycle.endDate).toISOString() },
    { label: "Manager Review Period", date: (managerReview?.startDate ?? cycle.startDate).toISOString() },
    { label: "Promotion Review", date: (hrEvaluation?.startDate ?? managerReview?.endDate ?? cycle.endDate).toISOString() },
    { label: "Final Evaluation", date: (hrEvaluation?.endDate ?? cycle.endDate).toISOString() },
    { label: "Cycle End", date: cycle.endDate.toISOString() },
  ];
}

export async function getLeadershipOverview(actor: Actor, cycleId?: string) {
  assertLeadership(actor);
  const cycle = await resolveCycle(cycleId);
  const employees = await prisma.employee.findMany({
    where: { role: Role.EMPLOYEE, deactivatedAt: null },
    select: {
      id: true,
      employeeId: true,
      name: true,
      department: { select: { id: true, name: true } },
    },
  });
  const scores = await scoreMany(
    cycle.id,
    employees.map((employee) => employee.id)
  );
  const [pdpCount, pipCount, awards, promotions, bonuses, cycles, followUpCount] = await Promise.all([
    prisma.personalDevelopmentPlan.count({ where: { cycleId: cycle.id, planType: PlanType.PDP } }),
    prisma.personalDevelopmentPlan.count({
      where: { cycleId: cycle.id, planType: PlanType.PIP, status: { in: ["ACTIVE", "ASSIGNED"] } },
    }),
    prisma.recognitionAward.findMany({
      where: { cycleId: cycle.id },
      select: { category: true, status: true, title: true },
    }),
    prisma.promotionRecommendation.findMany({
      where: { cycleId: cycle.id },
      select: { status: true },
    }),
    prisma.bonusCalculation.findMany({
      where: { cycleId: cycle.id },
      include: { employee: { select: { department: { select: { name: true } } } } },
    }),
    prisma.appraisalCycle.findMany({
      select: { id: true, name: true, status: true, startDate: true, endDate: true },
      orderBy: { startDate: "desc" },
    }),
    prisma.meeting.count({ where: { cycleId: cycle.id, type: "FOLLOW_UP" } }),
  ]);

  const people = employees.map((employee) => {
    const detail = scores.get(employee.id);
    return {
      id: employee.id,
      name: employee.name,
      employeeId: employee.employeeId,
      department: employee.department?.name ?? "Unassigned",
      departmentId: employee.department?.id ?? null,
      finalScore: detail?.scores.total ?? 0,
      band: displayBand(detail?.scores.band ?? "Needs Improvement"),
      pdpProgress: detail?.pdp?.progress ?? 0,
      selfStatus: detail?.selfStatus ?? "NOT_STARTED",
      supervisorDecision: detail?.supervisorDecision ?? "PENDING",
      finalStatus: detail?.finalStatus ?? "NOT_STARTED",
    };
  });

  const completedAppraisals = people.filter(
    (row) => row.finalStatus === "FINAL_APPROVED" || row.supervisorDecision === "APPROVED"
  ).length;
  const completed = people.filter((row) => row.pdpProgress >= 80 || row.finalStatus === "FINAL_APPROVED").length;
  const inProgress = people.filter((row) => row.pdpProgress > 0 && row.pdpProgress < 80).length;
  const notStarted = people.length - completed - inProgress;
  const overallProgress = people.length
    ? Math.round(people.reduce((sum, row) => sum + row.pdpProgress, 0) / people.length)
    : 0;

  const departmentsMap = new Map<string, { name: string; employees: number; progress: number }>();
  for (const person of people) {
    const current = departmentsMap.get(person.department) ?? { name: person.department, employees: 0, progress: 0 };
    current.employees += 1;
    current.progress += person.pdpProgress;
    departmentsMap.set(person.department, current);
  }
  const departments = [...departmentsMap.values()]
    .map((row) => ({
      name: row.name,
      employees: row.employees,
      completion: row.employees ? Math.round(row.progress / row.employees) : 0,
    }))
    .sort((a, b) => b.completion - a.completion)
    .slice(0, 8);

  const bandCounts = BAND_ORDER.map((name) => {
    const value = people.filter((row) => row.band === name).length;
    return { name, value, percent: pct(value, people.length) };
  });

  const bonusByDepartmentMap = new Map<string, number>();
  for (const row of bonuses) {
    const name = row.employee.department?.name ?? "Unassigned";
    bonusByDepartmentMap.set(name, (bonusByDepartmentMap.get(name) ?? 0) + row.amount);
  }
  const bonusByDepartment = [...bonusByDepartmentMap.entries()]
    .map(([name, amount]) => ({ name, amount: Number(amount.toFixed(2)) }))
    .sort((a, b) => b.amount - a.amount);

  const awardCategories = [
    { key: "EMPLOYEE_OF_THE_YEAR", name: "Employee of the Year" },
    { key: "OUTSTANDING_PERFORMER", name: "Outstanding Performer" },
    { key: "EMPLOYEE_OF_THE_MONTH", name: "Employee of the Month" },
  ] as const;
  const awardsOverview = {
    total: awards.length,
    categories: awardCategories.map((item) => ({
      name: item.name,
      value: awards.filter((row) => row.category === item.key).length,
    })),
  };

  const promotionPipeline = {
    recommended: promotions.length,
    underReview: promotions.filter((row) => row.status === "PENDING").length,
    approved: promotions.filter((row) => row.status === "SHORTLISTED").length,
    notApproved: promotions.filter((row) => row.status === "REJECTED").length,
  };

  const cycleProgress = {
    goalSetting: pct(people.filter((row) => row.pdpProgress > 0 || Boolean(scores.get(row.id)?.pdp)).length, people.length),
    selfReviews: pct(people.filter((row) => row.selfStatus === "SUBMITTED").length, people.length),
    managerReviews: pct(people.filter((row) => row.supervisorDecision === "APPROVED").length, people.length),
    finalEvaluation: pct(people.filter((row) => row.finalStatus === "FINAL_APPROVED").length, people.length),
    overall: pct(completedAppraisals, people.length) || overallProgress,
  };

  const developmentAreas = await prisma.pdpGoal.groupBy({
    by: ["developmentArea"],
    where: {
      pdp: { cycleId: cycle.id, planType: PlanType.PDP },
      developmentArea: { not: null },
    },
    _count: { developmentArea: true },
    orderBy: { _count: { developmentArea: "desc" } },
    take: 6,
  });

  const milestones = await prisma.meeting.findMany({
    where: {
      cycleId: cycle.id,
      scheduledAt: { gte: new Date() },
      status: { not: "CANCELLED" },
    },
    include: { employee: { select: { name: true } } },
    orderBy: { scheduledAt: "asc" },
    take: 6,
  });

  const activity = await prisma.appraisalCycleActivity.findMany({
    orderBy: { createdAt: "desc" },
    take: 6,
    include: { actor: { select: { name: true } } },
  });

  const totalBonusesAllocated = Number(bonuses.reduce((sum, row) => sum + row.amount, 0).toFixed(2));

  return {
    cycle: {
      id: cycle.id,
      name: cycle.name,
      startDate: cycle.startDate.toISOString(),
      endDate: cycle.endDate.toISOString(),
    },
    cycles,
    kpis: {
      employees: people.length,
      pdpCompletion: overallProgress,
      activePips: pipCount,
      awards: awards.length,
      pdps: pdpCount,
      promotions: promotions.length,
      followUps: followUpCount,
      completedAppraisals,
      awardsGiven: awards.filter((row) => row.status === "APPROVED").length || awards.length,
      totalBonusesAllocated,
      promotionRecommendations: promotions.length,
    },
    progress: {
      overall: cycleProgress.overall,
      completed,
      inProgress,
      notStarted,
    },
    departments,
    bands: bandCounts,
    bandDistribution: bandCounts,
    bonusByDepartment,
    awardsOverview,
    promotionPipeline,
    cycleProgress,
    keyDates: cycleDates(cycle),
    statuses: [
      { label: "PDPs in cycle", value: pdpCount },
      { label: "Self reviews submitted", value: people.filter((row) => row.selfStatus === "SUBMITTED").length },
      { label: "Supervisor reviews approved", value: people.filter((row) => row.supervisorDecision === "APPROVED").length },
      { label: "Final evaluations approved", value: people.filter((row) => row.finalStatus === "FINAL_APPROVED").length },
      { label: "Active PIPs", value: pipCount },
    ],
    developmentAreas: developmentAreas.map((row) => ({
      name: row.developmentArea || "General",
      count: row._count.developmentArea,
    })),
    milestones: milestones.map((row) => ({
      id: row.id,
      title: row.title,
      employee: row.employee.name,
      date: row.scheduledAt.toISOString(),
      status: row.status,
    })),
    activity: activity.map((row) => ({
      id: row.id,
      title: row.action.replaceAll("_", " "),
      detail: row.details,
      actor: row.actor.name,
      date: row.createdAt.toISOString(),
    })),
  };
}

type ReportRow = {
  employee: { id: string; employeeId: string; name: string; department: string; team: string };
  finalScore: number;
  band: string;
  pdpProgress: number;
  pdpStatus: string;
  completedGoals: number;
  pendingGoals: number;
  selfReview: string;
  peerReviews: number;
  supervisorReview: string;
  finalEvaluation: string;
  pipStatus: string;
  award: string;
  awardStatus: string | null;
  promotion: string;
  promotionReason: string | null;
  hrDecision: string | null;
  bonusAmount: number | null;
  bonusCalculation: string | null;
  updatedAt: Date | null;
};

export async function getLeadershipReport(actor: Actor, query: LeadershipReportQuery) {
  assertLeadership(actor);
  const cycle = await resolveCycle(query.cycleId);
  const employeeWhere = {
    role: Role.EMPLOYEE,
    deactivatedAt: null,
    ...(query.departmentId ? { departmentId: query.departmentId } : {}),
    ...(query.teamId ? { teamId: query.teamId } : {}),
    ...(query.employeeId ? { id: query.employeeId } : {}),
  };
  const employees = await prisma.employee.findMany({
    where: employeeWhere,
    select: {
      id: true,
      employeeId: true,
      name: true,
      role: true,
      department: { select: { id: true, name: true } },
      team: { select: { id: true, name: true } },
    },
    orderBy: { name: "asc" },
  });
  const ids = employees.map((employee) => employee.id);
  const scores = await scoreMany(cycle.id, ids);
  const [pips, awards, promotions, bonuses, pdps, generated] = await Promise.all([
    prisma.personalDevelopmentPlan.findMany({
      where: { cycleId: cycle.id, planType: PlanType.PIP, employeeId: { in: ids } },
      select: { employeeId: true, status: true },
    }),
    prisma.recognitionAward.findMany({
      where: { cycleId: cycle.id, employeeId: { in: ids } },
      select: { employeeId: true, title: true, status: true, category: true },
    }),
    prisma.promotionRecommendation.findMany({
      where: { cycleId: cycle.id, employeeId: { in: ids } },
      include: { supervisor: { select: { name: true } } },
    }),
    prisma.bonusCalculation.findMany({
      where: { cycleId: cycle.id, employeeId: { in: ids } },
    }),
    prisma.personalDevelopmentPlan.findMany({
      where: { cycleId: cycle.id, planType: PlanType.PDP, employeeId: { in: ids } },
      select: {
        employeeId: true,
        status: true,
        goals: { select: { subGoals: { select: { status: true } } } },
      },
    }),
    prisma.appraisalCycleActivity.findMany({
      where: { cycleId: cycle.id, action: "REPORT_GENERATED" },
      include: { actor: { select: { name: true, employeeId: true } } },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
  ]);
  const pipBy = new Map(pips.map((row) => [row.employeeId, row.status]));
  const awardBy = new Map(awards.map((row) => [row.employeeId, row]));
  const promoBy = new Map(promotions.map((row) => [row.employeeId, row]));
  const bonusBy = new Map(bonuses.map((row) => [row.employeeId, row]));
  const pdpBy = new Map(pdps.map((row) => [row.employeeId, row]));

  const from = query.from ? new Date(query.from) : null;
  const to = query.to ? new Date(query.to) : null;

  const rows: ReportRow[] = employees
    .map((employee) => {
      const detail = scores.get(employee.id);
      const pdp = pdpBy.get(employee.id);
      const subs = pdp?.goals.flatMap((goal) => goal.subGoals) ?? [];
      const promo = promoBy.get(employee.id);
      const bonus = bonusBy.get(employee.id);
      return {
        employee: {
          id: employee.id,
          employeeId: employee.employeeId,
          name: employee.name,
          department: employee.department?.name ?? "Unassigned",
          team: employee.team?.name ?? "—",
        },
        finalScore: detail?.scores.total ?? 0,
        band: displayBand(detail?.scores.band ?? "Needs Improvement"),
        pdpProgress: detail?.pdp?.progress ?? 0,
        pdpStatus: detail?.pdp?.status ?? "NOT_STARTED",
        completedGoals: subs.filter((sub) => sub.status === "COMPLETED").length,
        pendingGoals: subs.filter((sub) => sub.status !== "COMPLETED").length,
        selfReview: detail?.selfStatus ?? "NOT_STARTED",
        peerReviews: detail?.peerCount ?? 0,
        supervisorReview: detail?.supervisorDecision ?? "PENDING",
        finalEvaluation: detail?.finalStatus ?? "NOT_STARTED",
        pipStatus: pipBy.get(employee.id) ?? "None",
        award: awardBy.get(employee.id)?.title ?? "None",
        awardStatus: awardBy.get(employee.id)?.status ?? null,
        promotion: promo?.status ?? "None",
        promotionReason: promo?.reason ?? null,
        hrDecision: promo?.hrReason ?? promo?.status ?? null,
        bonusAmount: bonus?.amount ?? null,
        bonusCalculation: bonus?.calculation ?? null,
        updatedAt: detail?.pdp?.updatedAt ? new Date(detail.pdp.updatedAt) : null,
      };
    })
    .filter((row) => {
      if (query.band && row.band !== query.band && displayBand(query.band) !== row.band) return false;
      if (query.status && row.pdpStatus !== query.status && row.finalEvaluation !== query.status) return false;
      if (query.employeeType && query.employeeType !== "ALL" && query.employeeType !== "Permanent") return false;
      if (from && row.updatedAt && row.updatedAt < from) return false;
      if (to && row.updatedAt && row.updatedAt > to) return false;
      return true;
    });

  const filters = await prisma.department.findMany({
    select: {
      id: true,
      name: true,
      teams: { select: { id: true, name: true } },
    },
    orderBy: { name: "asc" },
  });

  const bandDistribution = BAND_ORDER.map((name) => {
    const value = rows.filter((row) => row.band === name).length;
    return { name, value, percent: pct(value, rows.length) };
  });
  const bonusByDepartmentMap = new Map<string, number>();
  for (const row of rows) {
    if (row.bonusAmount) {
      bonusByDepartmentMap.set(row.employee.department, (bonusByDepartmentMap.get(row.employee.department) ?? 0) + row.bonusAmount);
    }
  }
  const bonusByDepartment = [...bonusByDepartmentMap.entries()]
    .map(([name, amount]) => ({ name, amount: Number(amount.toFixed(2)) }))
    .sort((a, b) => b.amount - a.amount);
  const awardsByCategory = [
    { name: "Employee of the Year", value: awards.filter((row) => row.category === "EMPLOYEE_OF_THE_YEAR").length },
    { name: "Outstanding Performer", value: awards.filter((row) => row.category === "OUTSTANDING_PERFORMER").length },
    { name: "Employee of the Month", value: awards.filter((row) => row.category === "EMPLOYEE_OF_THE_MONTH").length },
  ];

  const deptMap = new Map<
    string,
    { department: string; employees: number; performance: number; pdpCompletion: number; completedAppraisals: number }
  >();
  for (const row of rows) {
    const current = deptMap.get(row.employee.department) ?? {
      department: row.employee.department,
      employees: 0,
      performance: 0,
      pdpCompletion: 0,
      completedAppraisals: 0,
    };
    current.employees += 1;
    current.performance += row.finalScore;
    current.pdpCompletion += row.pdpProgress;
    if (row.finalEvaluation === "FINAL_APPROVED" || row.supervisorReview === "APPROVED") {
      current.completedAppraisals += 1;
    }
    deptMap.set(row.employee.department, current);
  }
  const departmentComparison = [...deptMap.values()].map((row) => ({
    department: row.department,
    employees: row.employees,
    performance: row.employees ? Number((row.performance / row.employees).toFixed(1)) : 0,
    pdpCompletion: row.employees ? Math.round(row.pdpCompletion / row.employees) : 0,
    completedAppraisals: row.completedAppraisals,
  }));

  const recentReports = generated.length
    ? generated.map((row) => {
        let meta: { reportType?: string; name?: string } = {};
        try {
          meta = JSON.parse(row.details) as { reportType?: string; name?: string };
        } catch {
          meta = {};
        }
        return {
          id: row.id,
          name: meta.name ?? "Leadership report",
          type: meta.reportType ?? "PERFORMANCE_SUMMARY",
          generatedOn: row.createdAt.toISOString(),
          generatedBy: row.actor.name,
          status: "Completed",
        };
      })
    : defaultRecentReports(cycle.name, actor);

  return {
    cycle: { id: cycle.id, name: cycle.name, startDate: cycle.startDate.toISOString(), endDate: cycle.endDate.toISOString() },
    cycles: await prisma.appraisalCycle.findMany({
      select: { id: true, name: true, status: true, startDate: true, endDate: true },
      orderBy: { startDate: "desc" },
    }),
    filters: {
      departments: filters.map((department) => ({
        id: department.id,
        name: department.name,
        teams: department.teams,
      })),
      employees: employees.map((employee) => ({
        id: employee.id,
        name: employee.name,
        employeeId: employee.employeeId,
      })),
      bands: [...new Set(rows.map((row) => row.band))],
      employeeTypes: ["ALL", "Permanent"],
      reportTypes: [
        { value: "PERFORMANCE_SUMMARY", label: "Performance Summary" },
        { value: "PDP_PROGRESS", label: "PDP Progress Report" },
        { value: "AWARDS", label: "Awards & Recognition Report" },
        { value: "BONUS", label: "Bonus Allocation Report" },
        { value: "PROMOTION", label: "Promotion Recommendations" },
        { value: "DEPARTMENT_COMPARISON", label: "Department Comparison" },
      ],
    },
    summary: {
      employees: rows.length,
      completedAppraisals: rows.filter((row) => row.finalEvaluation === "FINAL_APPROVED" || row.supervisorReview === "APPROVED").length,
      averageScore: rows.length
        ? Number((rows.reduce((sum, row) => sum + row.finalScore, 0) / rows.length).toFixed(1))
        : 0,
      averagePdp: rows.length ? Math.round(rows.reduce((sum, row) => sum + row.pdpProgress, 0) / rows.length) : 0,
      pips: rows.filter((row) => row.pipStatus !== "None").length,
      awards: rows.filter((row) => row.award !== "None").length,
      awardsGiven: awards.length,
      totalBonusesAllocated: Number(bonuses.reduce((sum, row) => sum + row.amount, 0).toFixed(2)),
    },
    preview: {
      bandDistribution,
      bonusByDepartment,
      awardsByCategory,
    },
    departmentComparison,
    recentReports,
    rows,
  };
}

function defaultRecentReports(cycleName: string, actor: Actor) {
  const now = new Date();
  return [
    {
      id: "performance",
      name: `Annual Performance Summary ${now.getUTCFullYear()}`,
      type: "PERFORMANCE_SUMMARY",
      generatedOn: now.toISOString(),
      generatedBy: "Leadership",
      status: "Completed",
    },
    {
      id: "bonus",
      name: "Bonus Allocation Report",
      type: "BONUS",
      generatedOn: new Date(now.getTime() - 2 * 86400000).toISOString(),
      generatedBy: "Leadership",
      status: "Completed",
    },
    {
      id: "awards",
      name: "Awards & Recognition Report",
      type: "AWARDS",
      generatedOn: new Date(now.getTime() - 5 * 86400000).toISOString(),
      generatedBy: "Leadership",
      status: "Completed",
    },
    {
      id: "promotion",
      name: "Promotion Recommendations",
      type: "PROMOTION",
      generatedOn: new Date(now.getTime() - 8 * 86400000).toISOString(),
      generatedBy: "Leadership",
      status: "Completed",
    },
  ].map((row) => ({ ...row, generatedBy: actor.role === Role.LEADERSHIP ? row.generatedBy : row.generatedBy, cycleName }));
}

export async function recordLeadershipReport(actor: Actor, query: LeadershipReportQuery) {
  assertLeadership(actor);
  const cycle = await resolveCycle(query.cycleId);
  const labels: Record<string, string> = {
    PERFORMANCE_SUMMARY: "Performance Summary",
    PDP_PROGRESS: "PDP Progress Report",
    AWARDS: "Awards & Recognition Report",
    BONUS: "Bonus Allocation Report",
    PROMOTION: "Promotion Recommendations",
    DEPARTMENT_COMPARISON: "Department Comparison",
  };
  const reportType = query.reportType ?? "PERFORMANCE_SUMMARY";
  await prisma.appraisalCycleActivity.create({
    data: {
      cycleId: cycle.id,
      actorId: actor.id,
      action: "REPORT_GENERATED",
      details: JSON.stringify({
        reportType,
        name: `${labels[reportType] ?? "Leadership report"} — ${cycle.name}`,
        filters: query,
      }),
    },
  });
  return getLeadershipReport(actor, query);
}

function reportTitle(query: LeadershipReportQuery) {
  const labels: Record<string, string> = {
    PERFORMANCE_SUMMARY: "Performance Summary",
    PDP_PROGRESS: "PDP Progress Report",
    AWARDS: "Awards & Recognition Report",
    BONUS: "Bonus Allocation Report",
    PROMOTION: "Promotion Recommendations",
    DEPARTMENT_COMPARISON: "Department Comparison",
  };
  return labels[query.reportType ?? "PERFORMANCE_SUMMARY"] ?? "Leadership Report";
}

function reportLines(report: Awaited<ReturnType<typeof getLeadershipReport>>, query: LeadershipReportQuery) {
  const type = query.reportType ?? "PERFORMANCE_SUMMARY";
  if (type === "PDP_PROGRESS") {
    return report.rows.map(
      (row) =>
        `${row.employee.name} (${row.employee.employeeId}) — ${row.employee.department}. PDP ${row.pdpProgress}% (${row.pdpStatus}). Completed goals ${row.completedGoals}, pending ${row.pendingGoals}.`
    );
  }
  if (type === "AWARDS") {
    return report.rows
      .filter((row) => row.award !== "None")
      .map(
        (row) =>
          `${row.employee.name} (${row.employee.employeeId}) — ${row.employee.department}. Award: ${row.award}. Status: ${row.awardStatus ?? "Pending"}.`
      );
  }
  if (type === "BONUS") {
    return report.rows
      .filter((row) => row.bonusAmount != null)
      .map(
        (row) =>
          `${row.employee.name} (${row.employee.employeeId}) — score ${row.finalScore.toFixed(1)} (${row.band}). ${row.bonusCalculation ?? `Amount ${row.bonusAmount}`}.`
      );
  }
  if (type === "PROMOTION") {
    return report.rows
      .filter((row) => row.promotion !== "None")
      .map(
        (row) =>
          `${row.employee.name} (${row.employee.employeeId}) — score ${row.finalScore.toFixed(1)}. Supervisor recommendation: ${row.promotion}. ${row.promotionReason ?? ""}. HR: ${row.hrDecision ?? "Pending"}.`
      );
  }
  if (type === "DEPARTMENT_COMPARISON") {
    return report.departmentComparison.map(
      (row) =>
        `${row.department}: ${row.employees} employees, average score ${row.performance}, PDP completion ${row.pdpCompletion}%, completed appraisals ${row.completedAppraisals}.`
    );
  }
  return report.rows.map(
    (row) =>
      `${row.employee.name} (${row.employee.employeeId}) — ${row.employee.department}. Score ${row.finalScore.toFixed(1)} (${row.band}).`
  );
}

export async function buildLeadershipPdf(actor: Actor, query: LeadershipReportQuery) {
  const report = await getLeadershipReport(actor, query);
  const lines = reportLines(report, query);
  const doc = new PDFDocument({ margin: 48, size: "A4" });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });
  doc.fillColor("#1c1917").fontSize(18).text(`Altrium PerformX 360° — ${reportTitle(query)}`);
  doc.moveDown(0.3);
  doc.fontSize(11).fillColor("#78716c").text(report.cycle.name);
  doc.moveDown();
  doc.fillColor("#1c1917").fontSize(12).text(
    `Employees ${report.summary.employees} · Completed appraisals ${report.summary.completedAppraisals} · Awards ${report.summary.awardsGiven} · Bonuses Rs. ${report.summary.totalBonusesAllocated.toLocaleString()}`
  );
  doc.moveDown();
  if (lines.length === 0) {
    doc.fontSize(11).text("No records matched the selected filters.");
  }
  lines.slice(0, 80).forEach((line) => {
    doc.fontSize(10).fillColor("#1c1917").text(line);
    doc.moveDown(0.35);
  });
  doc.end();
  return done;
}

export async function buildLeadershipDocx(actor: Actor, query: LeadershipReportQuery) {
  const report = await getLeadershipReport(actor, query);
  const lines = reportLines(report, query);
  const children = [
    new Paragraph({
      children: [new TextRun({ text: `Altrium PerformX 360° — ${reportTitle(query)}`, bold: true, size: 32 })],
    }),
    new Paragraph({
      children: [new TextRun({ text: report.cycle.name, size: 22, color: "78716C" })],
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Employees ${report.summary.employees} · Completed appraisals ${report.summary.completedAppraisals} · Awards ${report.summary.awardsGiven} · Bonuses Rs. ${report.summary.totalBonusesAllocated.toLocaleString()}`,
        }),
      ],
    }),
    ...(lines.length === 0
      ? [new Paragraph({ children: [new TextRun({ text: "No records matched the selected filters." })] })]
      : lines.slice(0, 80).map(
          (line) =>
            new Paragraph({
              spacing: { after: 120 },
              children: [new TextRun({ text: line })],
            })
        )),
  ];
  const header = new TableRow({
    children: ["Item", "Detail"].map(
      (text) =>
        new TableCell({
          width: { size: 4500, type: WidthType.DXA },
          children: [new Paragraph({ children: [new TextRun({ text, bold: true })] })],
        })
    ),
  });
  const document = new Document({
    sections: [
      {
        children: [
          ...children,
          new Table({
            width: { size: 9000, type: WidthType.DXA },
            rows: [
              header,
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "Report type" })] })],
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: reportTitle(query) })] })],
                  }),
                ],
              }),
            ],
          }),
        ],
      },
    ],
  });
  return Packer.toBuffer(document);
}
