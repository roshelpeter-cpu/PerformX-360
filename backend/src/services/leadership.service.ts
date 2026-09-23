import { Document, Packer, Paragraph, TextRun } from "docx";
import PDFDocument from "pdfkit";
import { PlanType, Role } from "../../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/errors.js";
import { scoreMany } from "./evaluation-board.service.js";
import type { LeadershipReportQuery } from "../validations/leadership.validation.js";

type Actor = { id: string; role: Role };

function assertLeadership(actor: Actor) {
  if (actor.role !== Role.LEADERSHIP) {
    throw new AppError("Only leadership can access organisation reports", 403);
  }
}

async function resolveCycle(cycleId?: string) {
  if (cycleId) {
    const cycle = await prisma.appraisalCycle.findUnique({ where: { id: cycleId } });
    if (!cycle) throw new AppError("Appraisal cycle not found", 404);
    return cycle;
  }
  const active = await prisma.appraisalCycle.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { startDate: "desc" },
  });
  if (active) return active;
  const fallback = await prisma.appraisalCycle.findFirst({ orderBy: { startDate: "desc" } });
  if (!fallback) throw new AppError("No appraisal cycle is available", 400);
  return fallback;
}

export async function getLeadershipOverview(actor: Actor) {
  assertLeadership(actor);
  const cycle = await resolveCycle();
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
  const [pdpCount, pipCount, awardCount, promotionCount, followUpCount] = await Promise.all([
    prisma.personalDevelopmentPlan.count({ where: { cycleId: cycle.id, planType: PlanType.PDP } }),
    prisma.personalDevelopmentPlan.count({ where: { cycleId: cycle.id, planType: PlanType.PIP } }),
    prisma.recognitionAward.count({ where: { cycleId: cycle.id } }),
    prisma.promotionRecommendation.count({ where: { cycleId: cycle.id } }),
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
      band: detail?.scores.band ?? "Needs Improvement",
      pdpProgress: detail?.pdp?.progress ?? 0,
      selfStatus: detail?.selfStatus ?? "NOT_STARTED",
      supervisorDecision: detail?.supervisorDecision ?? "PENDING",
      finalStatus: detail?.finalStatus ?? "NOT_STARTED",
    };
  });

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

  const bandCounts = people.reduce<Record<string, number>>((acc, row) => {
    acc[row.band] = (acc[row.band] ?? 0) + 1;
    return acc;
  }, {});

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

  return {
    cycle: { id: cycle.id, name: cycle.name, startDate: cycle.startDate.toISOString(), endDate: cycle.endDate.toISOString() },
    kpis: {
      employees: people.length,
      pdpCompletion: overallProgress,
      activePips: pipCount,
      awards: awardCount,
      pdps: pdpCount,
      promotions: promotionCount,
      followUps: followUpCount,
    },
    progress: {
      overall: overallProgress,
      completed,
      inProgress,
      notStarted,
    },
    departments,
    bands: Object.entries(bandCounts).map(([name, value]) => ({ name, value })),
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
      department: { select: { id: true, name: true } },
      team: { select: { id: true, name: true } },
    },
    orderBy: { name: "asc" },
  });
  const scores = await scoreMany(
    cycle.id,
    employees.map((employee) => employee.id)
  );
  const [pips, awards, promotions] = await Promise.all([
    prisma.personalDevelopmentPlan.findMany({
      where: { cycleId: cycle.id, planType: PlanType.PIP, employeeId: { in: employees.map((row) => row.id) } },
      select: { employeeId: true, status: true },
    }),
    prisma.recognitionAward.findMany({
      where: { cycleId: cycle.id, employeeId: { in: employees.map((row) => row.id) } },
      select: { employeeId: true, title: true, status: true },
    }),
    prisma.promotionRecommendation.findMany({
      where: { cycleId: cycle.id, employeeId: { in: employees.map((row) => row.id) } },
      select: { employeeId: true, status: true },
    }),
  ]);
  const pipBy = new Map(pips.map((row) => [row.employeeId, row.status]));
  const awardBy = new Map(awards.map((row) => [row.employeeId, row]));
  const promoBy = new Map(promotions.map((row) => [row.employeeId, row.status]));

  const from = query.from ? new Date(query.from) : null;
  const to = query.to ? new Date(query.to) : null;

  const rows = employees
    .map((employee) => {
      const detail = scores.get(employee.id);
      return {
        employee: {
          id: employee.id,
          employeeId: employee.employeeId,
          name: employee.name,
          department: employee.department?.name ?? "Unassigned",
          team: employee.team?.name ?? "—",
        },
        finalScore: detail?.scores.total ?? 0,
        band: detail?.scores.band ?? "Needs Improvement",
        pdpProgress: detail?.pdp?.progress ?? 0,
        pdpStatus: detail?.pdp?.status ?? "NOT_STARTED",
        selfReview: detail?.selfStatus ?? "NOT_STARTED",
        peerReviews: detail?.peerCount ?? 0,
        supervisorReview: detail?.supervisorDecision ?? "PENDING",
        finalEvaluation: detail?.finalStatus ?? "NOT_STARTED",
        pipStatus: pipBy.get(employee.id) ?? "None",
        award: awardBy.get(employee.id)?.title ?? "None",
        awardStatus: awardBy.get(employee.id)?.status ?? null,
        promotion: promoBy.get(employee.id) ?? "None",
        updatedAt: detail?.pdp?.updatedAt ?? null,
      };
    })
    .filter((row) => {
      if (query.band && row.band !== query.band) return false;
      if (query.status && row.pdpStatus !== query.status && row.finalEvaluation !== query.status) return false;
      if (from && row.updatedAt && new Date(row.updatedAt) < from) return false;
      if (to && row.updatedAt && new Date(row.updatedAt) > to) return false;
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

  return {
    cycle: { id: cycle.id, name: cycle.name },
    cycles: await prisma.appraisalCycle.findMany({
      select: { id: true, name: true, status: true },
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
    },
    summary: {
      employees: rows.length,
      averageScore: rows.length
        ? Number((rows.reduce((sum, row) => sum + row.finalScore, 0) / rows.length).toFixed(1))
        : 0,
      averagePdp: rows.length
        ? Math.round(rows.reduce((sum, row) => sum + row.pdpProgress, 0) / rows.length)
        : 0,
      pips: rows.filter((row) => row.pipStatus !== "None").length,
      awards: rows.filter((row) => row.award !== "None").length,
    },
    rows,
  };
}

export async function buildLeadershipPdf(actor: Actor, query: LeadershipReportQuery) {
  const report = await getLeadershipReport(actor, query);
  const doc = new PDFDocument({ margin: 48, size: "A4" });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });
  doc.fillColor("#1c1917").fontSize(18).text("Altrium PerformX 360° Leadership Report");
  doc.moveDown(0.3);
  doc.fontSize(11).fillColor("#78716c").text(report.cycle.name);
  doc.moveDown();
  doc.fillColor("#1c1917").fontSize(12).text(
    `Employees ${report.summary.employees} · Average score ${report.summary.averageScore} · PDP progress ${report.summary.averagePdp}% · PIPs ${report.summary.pips} · Awards ${report.summary.awards}`
  );
  doc.moveDown();
  report.rows.slice(0, 40).forEach((row) => {
    doc.fontSize(11).fillColor("#1c1917").text(`${row.employee.name} (${row.employee.employeeId})`);
    doc.fontSize(9).fillColor("#57534e").text(
      `${row.employee.department} · ${row.employee.team} · Score ${row.finalScore.toFixed(1)} · ${row.band} · PDP ${row.pdpProgress}% · Self ${row.selfReview} · Peer ${row.peerReviews} · Supervisor ${row.supervisorReview} · Final ${row.finalEvaluation} · PIP ${row.pipStatus} · Award ${row.award}`
    );
    doc.moveDown(0.4);
  });
  doc.end();
  return done;
}

export async function buildLeadershipDocx(actor: Actor, query: LeadershipReportQuery) {
  const report = await getLeadershipReport(actor, query);
  const children = [
    new Paragraph({
      children: [new TextRun({ text: "Altrium PerformX 360° Leadership Report", bold: true, size: 32 })],
    }),
    new Paragraph({
      children: [new TextRun({ text: report.cycle.name, size: 22, color: "78716C" })],
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Employees ${report.summary.employees} · Average score ${report.summary.averageScore} · PDP progress ${report.summary.averagePdp}% · PIPs ${report.summary.pips} · Awards ${report.summary.awards}`,
        }),
      ],
    }),
    ...report.rows.slice(0, 60).map(
      (row) =>
        new Paragraph({
          spacing: { after: 120 },
          children: [
            new TextRun({ text: `${row.employee.name} (${row.employee.employeeId})`, bold: true }),
            new TextRun({
              text: ` — ${row.employee.department}, ${row.employee.team}. Score ${row.finalScore.toFixed(1)} (${row.band}). PDP ${row.pdpProgress}%. Self ${row.selfReview}. Peer ${row.peerReviews}. Supervisor ${row.supervisorReview}. Final ${row.finalEvaluation}. PIP ${row.pipStatus}. Award ${row.award}. Promotion ${row.promotion}.`,
            }),
          ],
        })
    ),
  ];
  const document = new Document({ sections: [{ children }] });
  return Packer.toBuffer(document);
}
