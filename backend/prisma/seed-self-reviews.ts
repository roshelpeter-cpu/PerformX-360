import {
  NotificationStatus,
  NotificationType,
  PrismaClient,
  SelfReviewStatus,
} from "../generated/prisma/client.js";
import { SELF_REVIEW_QUESTIONS } from "../src/constants/self-review-questions.js";
import { scoreForRating, summarizeSelfReview } from "../src/utils/self-review-scoring.js";

function reasonFor(name: string, question: string, rating: number) {
  return `${name} rated this ${rating} out of 5. ${question} During this appraisal period I supported the team's delivery, kept my supervisor informed, and can point to specific work that matches this rating.`;
}

function evidenceFor(key: string, title: string) {
  return [
    {
      fileName: `${title}.pdf`,
      storedName: `demo-self-review-${key}.pdf`,
      mimeType: "application/pdf",
      size: 18000,
      uploadedAt: "2026-09-18T09:00:00.000Z",
    },
  ];
}

export async function seedSelfReviews(prisma: PrismaClient) {
  const cycle = await prisma.appraisalCycle.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { startDate: "desc" },
  });
  if (!cycle) return;

  const opensAt = new Date(Date.UTC(2026, 8, 1, 0, 0, 0));
  for (const employeeId of ["EMP000901", "EMP000902"]) {
    await prisma.personalDevelopmentPlan.updateMany({
      where: { cycleId: cycle.id, employee: { employeeId } },
      data: { selfReviewOpensAt: opensAt },
    });
  }

  const employees = await prisma.employee.findMany({
    where: { employeeId: { in: ["EMP000901", "EMP000902"] } },
    select: { id: true, employeeId: true, name: true },
  });

  await prisma.selfReview.deleteMany({
    where: { employeeId: { in: employees.map((employee) => employee.id) }, cycleId: cycle.id },
  });
  await prisma.notification.deleteMany({
    where: {
      subjectEmployeeId: { in: employees.map((employee) => employee.id) },
      type: { in: [NotificationType.SELF_REVIEW_STARTED, NotificationType.SELF_REVIEW_SUBMITTED] },
    },
  });

  for (const employee of employees) {
    const submitted = employee.employeeId === "EMP000902";
    const ratings = SELF_REVIEW_QUESTIONS.map((_, index) => (submitted && index >= 15 ? 5 : 4));
    const scores = ratings.map((rating) => scoreForRating(rating));
    const summary = summarizeSelfReview(scores);
    const submittedAt = submitted ? new Date(Date.UTC(2026, 8, 20, 10, 30, 0)) : null;

    const review = await prisma.selfReview.create({
      data: {
        employeeId: employee.id,
        cycleId: cycle.id,
        status: submitted ? SelfReviewStatus.SUBMITTED : SelfReviewStatus.DRAFT,
        totalScore: summary.totalScore,
        percentage: summary.percentage,
        submittedAt,
        responses: {
          create: SELF_REVIEW_QUESTIONS.map((question, index) => ({
            questionKey: question.key,
            question: question.text,
            sortOrder: question.sortOrder,
            evidenceRequired: question.evidenceRequired,
            rating: ratings[index]!,
            score: scores[index]!,
            reason: reasonFor(employee.name, question.text, ratings[index]!),
            evidenceFiles: question.evidenceRequired
              ? evidenceFor(question.key, question.key === "q18" ? "pdp-progress-notes" : "learning-evidence")
              : [],
          })),
        },
      },
    });

    if (submitted) {
      const pdp = await prisma.personalDevelopmentPlan.findFirst({
        where: { employeeId: employee.id, cycleId: cycle.id },
        select: { supervisorId: true },
      });
      if (pdp?.supervisorId) {
        await prisma.notification.create({
          data: {
            type: NotificationType.SELF_REVIEW_SUBMITTED,
            title: "Employee self review submitted",
            message: `${employee.name} submitted their self review for ${cycle.name}.`,
            recipientId: pdp.supervisorId,
            subjectEmployeeId: employee.id,
            status: NotificationStatus.UNREAD,
            metadata: { cycleId: cycle.id, selfReviewId: review.id },
            createdAt: submittedAt ?? new Date(),
          },
        });
      }
    } else {
      await prisma.notification.create({
        data: {
          type: NotificationType.SELF_REVIEW_STARTED,
          title: "Self Review is now available",
          message: `Your self review for ${cycle.name} is open. Complete and submit it from the Self Review page.`,
          recipientId: employee.id,
          subjectEmployeeId: employee.id,
          status: NotificationStatus.UNREAD,
          metadata: { cycleId: cycle.id },
          createdAt: opensAt,
        },
      });
    }

    console.log(
      `  Self review ${submitted ? "SUBMITTED" : "DRAFT"} → ${employee.employeeId} (${summary.totalScore}/20)`
    );
  }
}
