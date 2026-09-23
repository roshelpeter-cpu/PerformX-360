import { Role } from "../../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/errors.js";
import { computePdpScoring } from "../utils/pdp-scoring.js";
import { finalPerformanceScore } from "../utils/performance-score.js";

type Actor = { id: string; role: Role };

function isOpen(opensAt: Date | null, cycleEnd: Date) {
  return Date.now() >= (opensAt ?? cycleEnd).getTime();
}

export async function buildEvaluationOverview(actor: Actor) {
  if (actor.role !== Role.HR_MANAGER) {
    throw new AppError("Only an HR Manager can view the organisation evaluation overview", 403);
  }

  const cycle = await prisma.appraisalCycle.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { startDate: "desc" },
  });
  if (!cycle) throw new AppError("No active appraisal cycle is available", 400);

  const employees = await prisma.employee.findMany({
    where: { role: Role.EMPLOYEE, deactivatedAt: null },
    select: {
      id: true,
      employeeId: true,
      name: true,
      department: { select: { id: true, name: true } },
      team: { select: { id: true, name: true, supervisor: { select: { id: true, name: true } } } },
    },
    orderBy: { name: "asc" },
  });

  const pdps = await prisma.personalDevelopmentPlan.findMany({
    where: { cycleId: cycle.id, employeeId: { in: employees.map((employee) => employee.id) } },
    select: {
      employeeId: true,
      status: true,
      updatedAt: true,
      selfReviewOpensAt: true,
      goals: { select: { id: true, subGoals: { select: { id: true, status: true } } } },
    },
  });
  const pdpByEmployee = new Map(pdps.map((pdp) => [pdp.employeeId, pdp]));

  const reviews = await prisma.selfReview.findMany({
    where: { cycleId: cycle.id },
    select: { employeeId: true, status: true, totalScore: true, percentage: true },
  });
  const reviewByEmployee = new Map(reviews.map((review) => [review.employeeId, review]));

  const peerRows = await prisma.peerReview.findMany({
    where: { cycleId: cycle.id, status: "SUBMITTED" },
    select: { subjectEmployeeId: true, totalScore: true },
  });
  const peerScoreByEmployee = new Map<string, number>();
  for (const row of peerRows) {
    peerScoreByEmployee.set(
      row.subjectEmployeeId,
      Number(((peerScoreByEmployee.get(row.subjectEmployeeId) ?? 0) + row.totalScore).toFixed(2))
    );
  }
  const supervisorRows = await prisma.supervisorReview.findMany({
    where: { cycleId: cycle.id },
    select: { employeeId: true, decision: true },
  });
  const supervisorByEmployee = new Map(supervisorRows.map((row) => [row.employeeId, row.decision]));
  const finalRows = await prisma.finalEvaluation.findMany({
    where: { cycleId: cycle.id },
    select: { employeeId: true, status: true },
  });
  const finalByEmployee = new Map(finalRows.map((row) => [row.employeeId, row.status]));

  let pendingSupervisorReviews = 0;
  let progressSum = 0;
  let progressCount = 0;
  let completedEvaluations = 0;
  let completedSelfReviews = 0;
  let pendingSelfReviews = 0;
  let requiringAttention = 0;

  const people = employees.map((employee) => {
    const pdp = pdpByEmployee.get(employee.id) ?? null;
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
    const progress = scoring?.progressPercent ?? 0;
    const review = reviewByEmployee.get(employee.id) ?? null;
    const selfReviewOpen = isOpen(pdp?.selfReviewOpensAt ?? null, cycle.endDate);
    const selfReviewStatus = review?.status ?? (selfReviewOpen ? "NOT_STARTED" : "NOT_AVAILABLE");
    const selfScore = review?.status === "SUBMITTED" ? review.totalScore : 0;
    const peerScore = peerScoreByEmployee.get(employee.id) ?? 0;
    const scores = finalPerformanceScore(selfScore, peerScore, scoring?.earnedPoints ?? 0);
    const supervisorDecision = supervisorByEmployee.get(employee.id) ?? "PENDING";
    const finalStatus = finalByEmployee.get(employee.id) ?? "NOT_STARTED";

    if (pdp) {
      progressSum += progress;
      progressCount += 1;
      if (progress >= 100) completedEvaluations += 1;
    }
    pendingSupervisorReviews += pendingReviews;
    if (review?.status === "SUBMITTED") completedSelfReviews += 1;
    if (selfReviewOpen && review?.status !== "SUBMITTED") pendingSelfReviews += 1;

    const needsAttention = !pdp || pendingReviews > 0 || (selfReviewOpen && review?.status !== "SUBMITTED");
    if (needsAttention) requiringAttention += 1;

    return {
      id: employee.id,
      employeeId: employee.employeeId,
      name: employee.name,
      department: employee.department?.name ?? "Unassigned",
      team: employee.team?.name ?? "—",
      supervisor: employee.team?.supervisor?.name ?? "—",
      pdpStatus: pdp?.status ?? "NOT_STARTED",
      progress,
      pendingReviews,
      selfReviewStatus,
      selfReviewScore: selfScore,
      peerScore,
      supervisorDecision,
      supervisorPdpScore: scores.supervisorPdp,
      finalScore: scores.total,
      band: scores.band,
      evaluationStatus: finalStatus === "FINAL_APPROVED" ? "Final Approved" : supervisorDecision,
      updatedAt: pdp?.updatedAt.toISOString() ?? null,
      needsAttention,
    };
  });

  const demoDepartments = [
    "Administration",
    "Customer Success",
    "Cybersecurity",
    "Data & Analytics",
    "DevOps / Cloud",
    "Engineering",
    "Finance",
    "Human Resources",
    "Information Technology",
    "Marketing",
  ];
  const departmentNames = demoDepartments.filter((name) => people.some((person) => person.department === name));

  const departments = departmentNames.map((name) => {
    const members = people.filter((person) => person.department === name);
    const averageProgress = members.length
      ? Math.round(members.reduce((sum, person) => sum + person.progress, 0) / members.length)
      : 0;
    const pendingReviews = members.reduce((sum, person) => sum + person.pendingReviews, 0);
    const selfReviewsSubmitted = members.filter((person) => person.selfReviewStatus === "SUBMITTED").length;
    const status = averageProgress < 50 || pendingReviews > 0 ? "Needs attention" : "On track";
    return {
      name,
      employees: members.length,
      averageProgress,
      selfReviewsSubmitted,
      pendingReviews,
      status,
      people: members,
    };
  });

  const attention = people
    .filter((person) => person.needsAttention)
    .sort((a, b) => b.pendingReviews - a.pendingReviews || a.progress - b.progress)
    .slice(0, 4)
    .map((person) => ({
      ...person,
      issue: !person.pdpStatus || person.pdpStatus === "NOT_STARTED"
        ? "PDP not started"
        : person.pendingReviews > 0
          ? "Pending supervisor reviews"
          : person.selfReviewStatus === "NOT_STARTED" || person.selfReviewStatus === "DRAFT"
            ? "Self review outstanding"
            : "Requires attention",
    }));

  return {
    cycle: {
      id: cycle.id,
      name: cycle.name,
      startDate: cycle.startDate.toISOString(),
      endDate: cycle.endDate.toISOString(),
    },
    kpis: {
      totalEmployees: employees.length,
      employeesWithPdps: progressCount,
      averageProgress: progressCount ? Math.round(progressSum / progressCount) : 0,
      pendingSupervisorReviews,
      completedSelfReviews,
      pendingSelfReviews,
      completedEvaluations,
      requiringAttention,
    },
    departments,
    attention,
  };
}
