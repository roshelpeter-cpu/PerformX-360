import {
  NotificationType,
  PeerReviewSubmissionStatus,
  PeerSelectionStatus,
  Role,
} from "../../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/errors.js";
import { createNotification } from "./notification.service.js";
import {
  PEER_REVIEW_QUESTIONS,
  scoreForPeerRating,
} from "../constants/peer-review-questions.js";

type Actor = { id: string; role: Role };

const personSelect = {
  id: true,
  employeeId: true,
  name: true,
  jobTitle: true,
  department: { select: { name: true } },
  team: { select: { name: true } },
} as const;

function staff(actor: Actor) {
  return actor.role === Role.HR || actor.role === Role.HR_MANAGER;
}

async function activeCycle() {
  const cycle = await prisma.appraisalCycle.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { startDate: "desc" },
  });
  if (!cycle) throw new AppError("No active appraisal cycle is available", 400);
  return cycle;
}

function presentPerson(person: {
  id: string;
  employeeId: string;
  name: string;
  jobTitle: string | null;
  department: { name: string } | null;
  team: { name: string } | null;
}) {
  return {
    id: person.id,
    employeeId: person.employeeId,
    name: person.name,
    jobTitle: person.jobTitle,
    department: person.department?.name ?? "Unassigned",
    team: person.team?.name ?? "—",
  };
}

async function recommendPool(subjectId: string, departmentId: string | null, teamId: string | null) {
  const people = await prisma.employee.findMany({
    where: { role: Role.EMPLOYEE, deactivatedAt: null, id: { not: subjectId } },
    select: { ...personSelect, departmentId: true, teamId: true },
    orderBy: { name: "asc" },
    take: 80,
  });
  const sameTeam = people.filter((person) => teamId && person.teamId === teamId);
  const sameDepartment = people.filter(
    (person) => departmentId && person.departmentId === departmentId && person.teamId !== teamId
  );
  const rest = people.filter(
    (person) => person.departmentId !== departmentId && person.teamId !== teamId
  );
  return [...sameTeam, ...sameDepartment, ...rest].slice(0, 5);
}

export async function getPeerDirectory(actor: Actor) {
  if (!staff(actor)) throw new AppError("Only HR can manage peer review selection", 403);
  const cycle = await activeCycle();
  const employees = await prisma.employee.findMany({
    where: { role: Role.EMPLOYEE, deactivatedAt: null },
    select: personSelect,
    orderBy: { name: "asc" },
  });
  const selections = await prisma.peerSelection.findMany({
    where: { cycleId: cycle.id },
    include: {
      recommendations: {
        where: { selected: true },
        include: { peer: { select: personSelect } },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  const bySubject = new Map(selections.map((selection) => [selection.subjectEmployeeId, selection]));

  const departments = new Map<string, Map<string, Array<Record<string, unknown>>>>();
  for (const employee of employees) {
    const department = employee.department?.name ?? "Unassigned";
    const team = employee.team?.name ?? "Unassigned team";
    const selection = bySubject.get(employee.id);
    const teams = departments.get(department) ?? new Map();
    const rows = teams.get(team) ?? [];
    rows.push({
      ...presentPerson(employee),
      selectionStatus: selection?.status ?? "NOT_STARTED",
      selectedPeers: (selection?.recommendations ?? []).map((item) => presentPerson(item.peer)),
    });
    teams.set(team, rows);
    departments.set(department, teams);
  }

  return {
    cycle: { id: cycle.id, name: cycle.name },
    departments: [...departments.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, teams]) => ({
        name,
        teams: [...teams.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([teamName, people]) => ({ name: teamName, employees: people })),
      })),
  };
}

export async function getPeerSelection(actor: Actor, subjectEmployeeId: string) {
  if (!staff(actor)) throw new AppError("Only HR can manage peer review selection", 403);
  const cycle = await activeCycle();
  const subject = await prisma.employee.findFirst({
    where: { id: subjectEmployeeId, role: Role.EMPLOYEE, deactivatedAt: null },
    select: personSelect,
  });
  if (!subject) throw new AppError("Employee not found", 404);
  const selection = await prisma.peerSelection.findUnique({
    where: { cycleId_subjectEmployeeId: { cycleId: cycle.id, subjectEmployeeId } },
    include: {
      recommendations: { include: { peer: { select: personSelect } }, orderBy: { sortOrder: "asc" } },
    },
  });
  const reviews = await prisma.peerReview.findMany({
    where: { cycleId: cycle.id, subjectEmployeeId },
    include: { reviewer: { select: personSelect }, responses: { orderBy: { sortOrder: "asc" } } },
  });
  return {
    subject: presentPerson(subject),
    status: selection?.status ?? "NOT_STARTED",
    recommendations: (selection?.recommendations ?? []).map((item) => ({
      ...presentPerson(item.peer),
      selected: item.selected,
    })),
    reviews: reviews.map((review) => ({
      id: review.id,
      status: review.status,
      totalScore: review.totalScore,
      comment: review.comment,
      reviewer: presentPerson(review.reviewer),
      responses: review.responses,
    })),
  };
}

export async function generatePeerRecommendations(actor: Actor, subjectEmployeeId: string) {
  if (!staff(actor)) throw new AppError("Only HR can generate peer recommendations", 403);
  const cycle = await activeCycle();
  const subject = await prisma.employee.findFirst({
    where: { id: subjectEmployeeId, role: Role.EMPLOYEE, deactivatedAt: null },
    select: { id: true, departmentId: true, teamId: true },
  });
  if (!subject) throw new AppError("Employee not found", 404);
  const pool = await recommendPool(subject.id, subject.departmentId, subject.teamId);
  if (pool.length < 2) throw new AppError("Not enough colleagues are available to recommend", 400);

  const selection = await prisma.peerSelection.upsert({
    where: { cycleId_subjectEmployeeId: { cycleId: cycle.id, subjectEmployeeId } },
    create: { cycleId: cycle.id, subjectEmployeeId, status: PeerSelectionStatus.IN_PROGRESS },
    update: { status: PeerSelectionStatus.IN_PROGRESS },
  });
  await prisma.peerRecommendation.deleteMany({ where: { selectionId: selection.id } });
  await prisma.peerRecommendation.createMany({
    data: pool.map((peer, index) => ({
      selectionId: selection.id,
      peerEmployeeId: peer.id,
      selected: false,
      sortOrder: index + 1,
    })),
  });
  return getPeerSelection(actor, subjectEmployeeId);
}

export async function selectPeers(actor: Actor, subjectEmployeeId: string, peerIds: string[]) {
  if (!staff(actor)) throw new AppError("Only HR can select peers", 403);
  const unique = [...new Set(peerIds)];
  if (unique.length !== 2) throw new AppError("Select exactly two peers", 400);
  const cycle = await activeCycle();
  const selection = await prisma.peerSelection.findUnique({
    where: { cycleId_subjectEmployeeId: { cycleId: cycle.id, subjectEmployeeId } },
    include: { recommendations: true, subject: { select: { name: true } } },
  });
  if (!selection) throw new AppError("Generate recommendations before selecting peers", 400);
  const allowed = new Set(selection.recommendations.map((item) => item.peerEmployeeId));
  if (unique.some((id) => !allowed.has(id))) {
    throw new AppError("Selected peers must come from the five recommendations", 400);
  }

  await prisma.peerRecommendation.updateMany({
    where: { selectionId: selection.id },
    data: { selected: false },
  });
  await prisma.peerRecommendation.updateMany({
    where: { selectionId: selection.id, peerEmployeeId: { in: unique } },
    data: { selected: true },
  });
  await prisma.peerSelection.update({
    where: { id: selection.id },
    data: { status: PeerSelectionStatus.SELECTED },
  });

  for (const reviewerId of unique) {
    const existing = await prisma.peerReview.findUnique({
      where: {
        cycleId_subjectEmployeeId_reviewerEmployeeId: {
          cycleId: cycle.id,
          subjectEmployeeId,
          reviewerEmployeeId: reviewerId,
        },
      },
    });
    if (!existing) {
      await prisma.peerReview.create({
        data: {
          cycleId: cycle.id,
          subjectEmployeeId,
          reviewerEmployeeId: reviewerId,
          status: PeerReviewSubmissionStatus.DRAFT,
          responses: {
            create: PEER_REVIEW_QUESTIONS.map((question) => ({
              questionKey: question.key,
              question: question.text,
              sortOrder: question.sortOrder,
            })),
          },
        },
      });
      await createNotification({
        type: NotificationType.PEER_REVIEW_ASSIGNED,
        title: "Peer review assigned",
        message: `You have been selected to complete a peer review for ${selection.subject.name}.`,
        recipientId: reviewerId,
        subjectEmployeeId,
        metadata: { cycleId: cycle.id },
      });
    }
  }

  return getPeerSelection(actor, subjectEmployeeId);
}

function blankAnswers() {
  return PEER_REVIEW_QUESTIONS.map((question) => ({
    questionKey: question.key,
    question: question.text,
    sortOrder: question.sortOrder,
    rating: null as number | null,
    score: 0,
    reason: "",
  }));
}

export async function getMyPeerReviews(actor: Actor) {
  if (actor.role !== Role.EMPLOYEE) throw new AppError("Peer review is available to employees", 403);
  const cycle = await activeCycle();
  const received = await prisma.peerReview.findMany({
    where: { cycleId: cycle.id, subjectEmployeeId: actor.id, status: PeerReviewSubmissionStatus.SUBMITTED },
    select: { totalScore: true },
  });
  const receivedScore = Number(received.reduce((sum, review) => sum + review.totalScore, 0).toFixed(2));
  const assignments = await prisma.peerReview.findMany({
    where: { cycleId: cycle.id, reviewerEmployeeId: actor.id },
    include: {
      subject: { select: personSelect },
      responses: { orderBy: { sortOrder: "asc" } },
    },
    orderBy: { createdAt: "asc" },
  });

  return {
    received: {
      status: received.length > 0 ? "SCORED" : "NOT_STARTED",
      score: received.length > 0 ? receivedScore : null,
      maxScore: 20,
      label: received.length > 0 ? null : "Peer Review Not Started",
    },
    assignments: assignments.map((assignment) => ({
      id: assignment.id,
      status: assignment.status,
      totalScore: assignment.totalScore,
      comment: assignment.comment,
      subject: presentPerson(assignment.subject),
      responses:
        assignment.responses.length > 0
          ? assignment.responses.map((response) => ({
              questionKey: response.questionKey,
              question: response.question,
              sortOrder: response.sortOrder,
              rating: response.rating,
              score: response.score,
              reason: response.reason,
            }))
          : blankAnswers(),
    })),
  };
}

export async function savePeerReviewDraft(
  actor: Actor,
  reviewId: string,
  input: { comment?: string | undefined; responses: Array<{ questionKey: string; rating?: number | null | undefined; reason?: string | undefined }> }
) {
  const review = await requireEditableAssignment(actor, reviewId);
  for (const answer of input.responses) {
    const question = PEER_REVIEW_QUESTIONS.find((item) => item.key === answer.questionKey);
    if (!question) throw new AppError("Unknown peer review question", 400);
    const rating = answer.rating ?? null;
    await prisma.peerReviewResponse.upsert({
      where: { peerReviewId_questionKey: { peerReviewId: review.id, questionKey: question.key } },
      create: {
        peerReviewId: review.id,
        questionKey: question.key,
        question: question.text,
        sortOrder: question.sortOrder,
        rating,
        score: rating ? scoreForPeerRating(rating) : 0,
        reason: answer.reason?.trim() ?? "",
      },
      update: {
        rating,
        score: rating ? scoreForPeerRating(rating) : 0,
        reason: answer.reason?.trim() ?? "",
      },
    });
  }
  const saved = await prisma.peerReview.findUnique({
    where: { id: review.id },
    include: { responses: true },
  });
  const totalScore = Number((saved?.responses ?? []).reduce((sum, response) => sum + response.score, 0).toFixed(2));
  await prisma.peerReview.update({
    where: { id: review.id },
    data: { totalScore, comment: input.comment?.trim() ?? review.comment },
  });
  return getMyPeerReviews(actor);
}

async function requireEditableAssignment(actor: Actor, reviewId: string) {
  if (actor.role !== Role.EMPLOYEE) throw new AppError("Only the assigned employee can complete this peer review", 403);
  const review = await prisma.peerReview.findUnique({ where: { id: reviewId } });
  if (!review || review.reviewerEmployeeId !== actor.id) {
    throw new AppError("You can only complete a peer review assigned to you", 403);
  }
  if (review.status === PeerReviewSubmissionStatus.SUBMITTED) {
    throw new AppError("This peer review has already been submitted", 400);
  }
  return review;
}

export async function submitPeerReview(actor: Actor, reviewId: string) {
  const review = await requireEditableAssignment(actor, reviewId);
  const full = await prisma.peerReview.findUnique({
    where: { id: review.id },
    include: { responses: true, subject: { select: { name: true } } },
  });
  if (!full) throw new AppError("Peer review not found", 404);
  for (const question of PEER_REVIEW_QUESTIONS) {
    const response = full.responses.find((item) => item.questionKey === question.key);
    if (!response?.rating) throw new AppError("Please rate every question.", 400);
    if (!response.reason.trim()) throw new AppError("Please provide a reason for this response.", 400);
  }
  const totalScore = Number(
    full.responses.reduce((sum, response) => sum + scoreForPeerRating(response.rating ?? 0), 0).toFixed(2)
  );
  await prisma.$transaction(async (tx) => {
    for (const response of full.responses) {
      await tx.peerReviewResponse.update({
        where: { id: response.id },
        data: { score: scoreForPeerRating(response.rating ?? 0) },
      });
    }
    await tx.peerReview.update({
      where: { id: full.id },
      data: {
        status: PeerReviewSubmissionStatus.SUBMITTED,
        totalScore,
        submittedAt: new Date(),
      },
    });
  });
  return { message: "Peer review submitted successfully.", peerReview: await getMyPeerReviews(actor) };
}

/** EMP000901 can demonstrate submission again after the next login. */
export async function reopenDemoReviewsOnLogin(employeeCode: string, employeeInternalId: string) {
  if (employeeCode !== "EMP000901") return;
  await prisma.selfReview.updateMany({
    where: { employeeId: employeeInternalId, status: "SUBMITTED" },
    data: { status: "DRAFT", submittedAt: null },
  });
  await prisma.peerReview.updateMany({
    where: { reviewerEmployeeId: employeeInternalId, status: PeerReviewSubmissionStatus.SUBMITTED },
    data: { status: PeerReviewSubmissionStatus.DRAFT, submittedAt: null },
  });
}
