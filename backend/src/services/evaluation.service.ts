import { NotificationType, Role, SupervisorReviewDecision } from "../../generated/prisma/client.js";
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

async function assertCanView(actor: Actor, employeeId: string) {
  if (actor.role === Role.HR || actor.role === Role.HR_MANAGER || actor.role === Role.LEADERSHIP) return;
  if (actor.role === Role.EMPLOYEE && actor.id === employeeId) return;
  if (actor.role === Role.SUPERVISOR) {
    const team = await prisma.team.findFirst({
      where: { supervisorId: actor.id, employees: { some: { id: employeeId, deactivatedAt: null } } },
      select: { id: true },
    });
    if (!team) throw new AppError("You can only review employees on your team", 403);
    return;
  }
  throw new AppError("You do not have permission to view this evaluation", 403);
}

function evaluationStatus(input: {
  finalStatus: string | null;
  supervisorDecision: string | null;
  pendingReviews: number;
  hasPdp: boolean;
}) {
  if (input.finalStatus === "FINAL_APPROVED") return "Final Approved";
  if (input.supervisorDecision === "DECLINED") return "Declined";
  if (input.supervisorDecision === "APPROVED") return "Under Review";
  if (input.pendingReviews > 0) return "Awaiting Supervisor Approval";
  if (input.hasPdp) return "Pending";
  return "Not Started";
}

export async function getEvaluationPackage(actor: Actor, employeeId: string) {
  await assertCanView(actor, employeeId);
  const cycle = await activeCycle();
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, deactivatedAt: null },
    select: {
      id: true,
      employeeId: true,
      name: true,
      jobTitle: true,
      department: { select: { name: true } },
      team: { select: { name: true, supervisor: { select: { id: true, name: true } } } },
    },
  });
  if (!employee) throw new AppError("Employee not found", 404);

  const pdp = await prisma.personalDevelopmentPlan.findFirst({
    where: { employeeId, cycleId: cycle.id, planType: "PDP" },
    select: {
      id: true,
      title: true,
      status: true,
      goals: { select: { id: true, subGoals: { select: { id: true, status: true, evidenceFiles: true } } } },
    },
  });
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
  const evidenceCount =
    pdp?.goals.reduce(
      (sum, goal) =>
        sum +
        goal.subGoals.filter((sub) => Array.isArray(sub.evidenceFiles) && sub.evidenceFiles.length > 0).length,
      0
    ) ?? 0;

  const selfReview = await prisma.selfReview.findUnique({
    where: { employeeId_cycleId: { employeeId, cycleId: cycle.id } },
    select: {
      status: true,
      totalScore: true,
      percentage: true,
      submittedAt: true,
      responses: { orderBy: { sortOrder: "asc" } },
    },
  });
  const selfScore = selfReview?.status === "SUBMITTED" ? selfReview.totalScore : 0;

  const peerReviews = await prisma.peerReview.findMany({
    where: { cycleId: cycle.id, subjectEmployeeId: employeeId },
    include: {
      reviewer: { select: { id: true, employeeId: true, name: true } },
      responses: { orderBy: { sortOrder: "asc" } },
    },
  });
  const submittedPeers = peerReviews.filter((review) => review.status === "SUBMITTED");
  const peerScore = Number(submittedPeers.reduce((sum, review) => sum + review.totalScore, 0).toFixed(2));

  const supervisorReview = await prisma.supervisorReview.findUnique({
    where: { cycleId_employeeId: { cycleId: cycle.id, employeeId } },
    include: { supervisor: { select: { id: true, name: true } } },
  });
  const finalEvaluation = await prisma.finalEvaluation.findUnique({
    where: { cycleId_employeeId: { cycleId: cycle.id, employeeId } },
  });
  const scores = finalPerformanceScore(selfScore, peerScore, scoring?.earnedPoints ?? 0);
  const hideReviewers = actor.role === Role.EMPLOYEE;

  return {
    employee: {
      id: employee.id,
      employeeId: employee.employeeId,
      name: employee.name,
      jobTitle: employee.jobTitle,
      department: employee.department?.name ?? "Unassigned",
      team: employee.team?.name ?? "—",
      supervisor: employee.team?.supervisor?.name ?? "—",
    },
    cycle: { id: cycle.id, name: cycle.name },
    pdp: pdp
      ? {
          id: pdp.id,
          title: pdp.title,
          status: pdp.status,
          progress: scoring?.progressPercent ?? 0,
          earnedPoints: scoring?.earnedPoints ?? 0,
          pendingReviews,
          evidenceCount,
        }
      : null,
    selfReview: {
      status: selfReview?.status ?? "NOT_STARTED",
      score: selfScore,
      maxScore: 20,
      percentage: selfReview?.status === "SUBMITTED" ? selfReview.percentage : 0,
      submittedAt: selfReview?.submittedAt?.toISOString() ?? null,
      responses: (selfReview?.responses ?? []).map((response) => ({
        question: response.question,
        rating: response.rating,
        score: response.score,
        reason: response.reason,
      })),
    },
    peerReview: {
      score: peerScore,
      maxScore: 20,
      status: submittedPeers.length > 0 ? "Submitted" : "Not Started",
      reviewers: hideReviewers
        ? []
        : peerReviews.map((review) => ({
            name: review.reviewer.name,
            employeeId: review.reviewer.employeeId,
            status: review.status,
            score: review.totalScore,
            comment: review.comment,
            responses: review.responses.map((response) => ({
              question: response.question,
              rating: response.rating,
              score: response.score,
              reason: response.reason,
            })),
          })),
    },
    supervisorReview: supervisorReview
      ? {
          decision: supervisorReview.decision,
          comment: supervisorReview.comment,
          supervisor: supervisorReview.supervisor.name,
          decidedAt: supervisorReview.decidedAt?.toISOString() ?? null,
        }
      : { decision: "PENDING", comment: "", supervisor: employee.team?.supervisor?.name ?? "—", decidedAt: null },
    scores,
    status: evaluationStatus({
      finalStatus: finalEvaluation?.status ?? null,
      supervisorDecision: supervisorReview?.decision ?? null,
      pendingReviews,
      hasPdp: Boolean(pdp),
    }),
    finalApproval: {
      status: finalEvaluation?.status ?? "NOT_STARTED",
      approvedAt: finalEvaluation?.approvedAt?.toISOString() ?? null,
    },
  };
}

export async function decideSupervisorReview(
  actor: Actor,
  employeeId: string,
  input: { decision: "APPROVED" | "DECLINED"; comment: string }
) {
  if (actor.role !== Role.SUPERVISOR) throw new AppError("Only the supervisor can record this review", 403);
  await assertCanView(actor, employeeId);
  const comment = input.comment.trim();
  if (comment.length < 8) throw new AppError("A meaningful review comment is required", 400);
  const cycle = await activeCycle();
  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { name: true } });
  const review = await prisma.supervisorReview.upsert({
    where: { cycleId_employeeId: { cycleId: cycle.id, employeeId } },
    create: {
      cycleId: cycle.id,
      employeeId,
      supervisorId: actor.id,
      decision: input.decision as SupervisorReviewDecision,
      comment,
      decidedAt: new Date(),
    },
    update: {
      supervisorId: actor.id,
      decision: input.decision as SupervisorReviewDecision,
      comment,
      decidedAt: new Date(),
    },
  });
  const decisionLabel = input.decision === "APPROVED" ? "approved" : "declined";
  const message = `Your supervisor ${decisionLabel} the supervisor review. ${comment}`;
  await createNotification({
    type: NotificationType.SUPERVISOR_REVIEW_DECIDED,
    title: "Supervisor review recorded",
    message,
    recipientId: employeeId,
    subjectEmployeeId: employeeId,
    metadata: { cycleId: cycle.id, decision: input.decision },
  });
  await notifyAllHrUsers({
    type: NotificationType.SUPERVISOR_REVIEW_DECIDED,
    title: "Supervisor review ready for HR",
    message: `${employee?.name ?? "An employee"}'s supervisor review was ${decisionLabel}. ${comment}`,
    subjectEmployeeId: employeeId,
    metadata: { cycleId: cycle.id, decision: input.decision },
  });
  return { reviewId: review.id, package: await getEvaluationPackage(actor, employeeId) };
}

export async function approveFinalEvaluation(actor: Actor, employeeId: string) {
  if (actor.role !== Role.HR) {
    throw new AppError("Only HR can approve the final evaluation", 403);
  }
  const cycle = await activeCycle();
  const supervisorReview = await prisma.supervisorReview.findUnique({
    where: { cycleId_employeeId: { cycleId: cycle.id, employeeId } },
  });
  if (!supervisorReview || supervisorReview.decision === "PENDING") {
    throw new AppError("The supervisor review must be completed before final approval", 400);
  }
  await prisma.finalEvaluation.upsert({
    where: { cycleId_employeeId: { cycleId: cycle.id, employeeId } },
    create: {
      cycleId: cycle.id,
      employeeId,
      status: "FINAL_APPROVED",
      approvedById: actor.id,
      approvedAt: new Date(),
    },
    update: { status: "FINAL_APPROVED", approvedById: actor.id, approvedAt: new Date() },
  });
  await createNotification({
    type: NotificationType.FINAL_EVALUATION_APPROVED,
    title: "Final evaluation approved",
    message: "HR approved your final performance evaluation.",
    recipientId: employeeId,
    subjectEmployeeId: employeeId,
    metadata: { cycleId: cycle.id },
  });
  return getEvaluationPackage(actor, employeeId);
}
