import {
  NotificationStatus,
  NotificationType,
  PeerReviewSubmissionStatus,
  PeerSelectionStatus,
  PrismaClient,
  SupervisorReviewDecision,
} from "../generated/prisma/client.js";
import { PEER_REVIEW_QUESTIONS, scoreForPeerRating } from "../src/constants/peer-review-questions.js";

type Person = {
  id: string;
  employeeId: string;
  name: string;
  departmentId: string | null;
  teamId: string | null;
};

function responsesFor(rating: number, name: string) {
  return PEER_REVIEW_QUESTIONS.map((question) => ({
    questionKey: question.key,
    question: question.text,
    sortOrder: question.sortOrder,
    rating,
    score: scoreForPeerRating(rating),
    reason: `${name} rated this ${rating} out of 5. ${question.text} This is based on work we shared during the appraisal period.`,
  }));
}

function totalFor(rating: number) {
  return Number((scoreForPeerRating(rating) * PEER_REVIEW_QUESTIONS.length).toFixed(2));
}

export async function seedReviewWorkflow(prisma: PrismaClient) {
  const cycle = await prisma.appraisalCycle.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { startDate: "desc" },
  });
  if (!cycle) return;

  await prisma.peerReviewResponse.deleteMany({ where: { peerReview: { cycleId: cycle.id } } });
  await prisma.peerReview.deleteMany({ where: { cycleId: cycle.id } });
  await prisma.peerRecommendation.deleteMany({ where: { selection: { cycleId: cycle.id } } });
  await prisma.peerSelection.deleteMany({ where: { cycleId: cycle.id } });
  await prisma.supervisorReview.deleteMany({ where: { cycleId: cycle.id } });
  await prisma.finalEvaluation.deleteMany({ where: { cycleId: cycle.id } });

  const demos = await prisma.employee.findMany({
    where: { employeeId: { in: ["EMP000001", "EMP000901", "EMP000902", "EMP000903", "EMP000904"] } },
  });
  const byCode = new Map(demos.map((employee) => [employee.employeeId, employee]));
  const nethmi = byCode.get("EMP000901");
  const kevin = byCode.get("EMP000902");
  const alex = byCode.get("EMP000001");
  const amaya = byCode.get("EMP000903");
  const ryan = byCode.get("EMP000904");
  if (!nethmi || !kevin || !alex || !amaya || !ryan) {
    console.log("  Review workflow seed skipped: demo employees missing");
    return;
  }

  const pool = await prisma.employee.findMany({
    where: {
      role: "EMPLOYEE",
      deactivatedAt: null,
      departmentId: nethmi.departmentId,
      id: { notIn: demos.map((employee) => employee.id) },
    },
    orderBy: { name: "asc" },
    take: 20,
  });
  if (pool.length < 12) {
    console.log("  Review workflow seed skipped: not enough colleagues");
    return;
  }

  const [a, b, c, d, e, f, g, h, i, j, k, l] = pool as Person[];
  if (!a || !b || !c || !d || !e || !f || !g || !h || !i || !j || !k || !l) return;

  async function selection(
    subject: Person,
    peers: Array<{ person: Person; selected: boolean }>,
    status: PeerSelectionStatus
  ) {
    const row = await prisma.peerSelection.create({
      data: {
        cycleId: cycle!.id,
        subjectEmployeeId: subject.id,
        status,
        recommendations: {
          create: peers.map((peer, index) => ({
            peerEmployeeId: peer.person.id,
            selected: peer.selected,
            sortOrder: index + 1,
          })),
        },
      },
    });
    return row;
  }

  async function review(
    subject: Person,
    reviewer: Person,
    status: PeerReviewSubmissionStatus,
    rating: number
  ) {
    const submitted = status === PeerReviewSubmissionStatus.SUBMITTED;
    await prisma.peerReview.create({
      data: {
        cycleId: cycle!.id,
        subjectEmployeeId: subject.id,
        reviewerEmployeeId: reviewer.id,
        status,
        totalScore: submitted ? totalFor(rating) : 0,
        comment: submitted
          ? `${reviewer.name} completed a confidential peer review of ${subject.name}.`
          : "",
        submittedAt: submitted ? new Date(Date.UTC(2026, 8, 18, 9, 0, 0)) : null,
        responses: {
          create: submitted ? responsesFor(rating, reviewer.name) : responsesFor(rating, reviewer.name).map((item) => ({
            ...item,
            rating: status === PeerReviewSubmissionStatus.DRAFT && reviewer.employeeId === "EMP000901" ? item.rating : null,
            score: status === PeerReviewSubmissionStatus.DRAFT && reviewer.employeeId === "EMP000901" ? item.score : 0,
            reason: status === PeerReviewSubmissionStatus.DRAFT && reviewer.employeeId === "EMP000901" ? item.reason : "",
          })),
        },
      },
    });
  }

  await selection(nethmi, [
    { person: kevin, selected: true },
    { person: a, selected: true },
    { person: b, selected: false },
    { person: c, selected: false },
    { person: d, selected: false },
  ], PeerSelectionStatus.SELECTED);
  await review(nethmi, kevin, PeerReviewSubmissionStatus.SUBMITTED, 4);
  await review(nethmi, a, PeerReviewSubmissionStatus.SUBMITTED, 4);

  await selection(kevin, [
    { person: b, selected: true },
    { person: c, selected: true },
    { person: d, selected: false },
    { person: e, selected: false },
    { person: f, selected: false },
  ], PeerSelectionStatus.SELECTED);
  await review(kevin, b, PeerReviewSubmissionStatus.SUBMITTED, 5);
  await review(kevin, c, PeerReviewSubmissionStatus.SUBMITTED, 4);

  await selection(d, [
    { person: nethmi, selected: true },
    { person: e, selected: true },
    { person: f, selected: false },
    { person: g, selected: false },
    { person: h, selected: false },
  ], PeerSelectionStatus.SELECTED);
  await review(d, nethmi, PeerReviewSubmissionStatus.DRAFT, 4);
  await review(d, e, PeerReviewSubmissionStatus.DRAFT, 3);

  await selection(g, [
    { person: alex, selected: true },
    { person: h, selected: true },
    { person: i, selected: false },
    { person: j, selected: false },
    { person: k, selected: false },
  ], PeerSelectionStatus.SELECTED);
  await review(g, alex, PeerReviewSubmissionStatus.DRAFT, 3);
  await review(g, h, PeerReviewSubmissionStatus.DRAFT, 3);

  await selection(i, [
    { person: amaya, selected: true },
    { person: j, selected: true },
    { person: k, selected: false },
    { person: a, selected: false },
    { person: b, selected: false },
  ], PeerSelectionStatus.SELECTED);
  await review(i, amaya, PeerReviewSubmissionStatus.DRAFT, 3);

  await selection(j, [
    { person: ryan, selected: true },
    { person: k, selected: true },
    { person: l, selected: false },
    { person: a, selected: false },
    { person: c, selected: false },
  ], PeerSelectionStatus.SELECTED);
  await review(j, ryan, PeerReviewSubmissionStatus.DRAFT, 3);

  await selection(
    f,
    [a, b, c, e, h].map((person) => ({ person, selected: false })),
    PeerSelectionStatus.IN_PROGRESS
  );

  for (const reviewer of [nethmi, alex, amaya, ryan]) {
    await prisma.notification.create({
      data: {
        type: NotificationType.PEER_REVIEW_ASSIGNED,
        title: "Peer review assigned",
        message: "You have been selected to complete a peer review for a colleague.",
        recipientId: reviewer.id,
        subjectEmployeeId: reviewer.id,
        status: NotificationStatus.UNREAD,
        metadata: { cycleId: cycle.id },
      },
    });
  }

  for (const employee of [nethmi, kevin]) {
    const pdp = await prisma.personalDevelopmentPlan.findFirst({
      where: { employeeId: employee.id, cycleId: cycle.id },
      select: { supervisorId: true },
    });
    if (!pdp?.supervisorId) continue;
    await prisma.supervisorReview.create({
      data: {
        cycleId: cycle.id,
        employeeId: employee.id,
        supervisorId: pdp.supervisorId,
        decision: SupervisorReviewDecision.APPROVED,
        comment:
          "The PDP shows consistent delivery. Approved sub-goals are supported by evidence, and the remaining items are correctly waiting for supervisor approval before they affect the score.",
        decidedAt: new Date(Date.UTC(2026, 8, 21, 11, 0, 0)),
      },
    });
    await prisma.notification.create({
      data: {
        type: NotificationType.SUPERVISOR_REVIEW_DECIDED,
        title: "Supervisor review recorded",
        message: "Your supervisor approved the supervisor review for this appraisal cycle.",
        recipientId: employee.id,
        subjectEmployeeId: employee.id,
        status: NotificationStatus.UNREAD,
        metadata: { cycleId: cycle.id, decision: "APPROVED" },
      },
    });
  }

  console.log("  Peer and supervisor reviews seeded for the demo accounts");
}
