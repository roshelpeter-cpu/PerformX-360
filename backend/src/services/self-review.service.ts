import fs from "node:fs";
import {
  NotificationType,
  Role,
  type Prisma,
} from "../../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { evidenceFilePath } from "../lib/uploads.js";
import { createNotification } from "./notification.service.js";
import { AppError } from "../utils/errors.js";
import {
  SELF_REVIEW_QUESTIONS,
  type SelfReviewQuestionDef,
} from "../constants/self-review-questions.js";
import { scoreForRating, summarizeSelfReview } from "../utils/self-review-scoring.js";

type Actor = { id: string; role: Role };

const questionByKey = new Map(SELF_REVIEW_QUESTIONS.map((question) => [question.key, question]));

type EvidenceFile = {
  fileName: string;
  storedName: string;
  mimeType?: string | null;
  size?: number | null;
  uploadedAt?: string | null;
};

function periodLabel(start: Date, end: Date) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  return `${fmt.format(start)} – ${fmt.format(end)}`;
}

function parseEvidence(value: unknown): EvidenceFile[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({
      fileName: String(item.fileName ?? "evidence"),
      storedName: String(item.storedName ?? ""),
      mimeType: item.mimeType ? String(item.mimeType) : null,
      size: typeof item.size === "number" ? item.size : null,
      uploadedAt: item.uploadedAt ? String(item.uploadedAt) : null,
    }))
    .filter((item) => item.storedName);
}

async function loadCycleContext(employeeId: string) {
  const cycle = await prisma.appraisalCycle.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { startDate: "desc" },
  });
  if (!cycle) throw new AppError("No active appraisal cycle is available", 400);

  const pdp = await prisma.personalDevelopmentPlan.findFirst({
    where: { employeeId, cycleId: cycle.id },
    select: { id: true, selfReviewOpensAt: true, supervisorId: true },
  });

  const opensAt = pdp?.selfReviewOpensAt ?? cycle.endDate;
  const available = Date.now() >= opensAt.getTime();

  return { cycle, pdp, opensAt, available };
}

function unavailableMessage() {
  return "Your current PDP period has not yet finished. Self Review will become available once the appraisal period is completed.";
}

async function assertCanRead(actor: Actor, employeeId: string) {
  if (actor.role === Role.EMPLOYEE) {
    if (actor.id !== employeeId) throw new AppError("You can only view your own self review", 403);
    return;
  }
  if (actor.role === Role.HR_MANAGER || actor.role === Role.LEADERSHIP) return;
  if (actor.role === Role.SUPERVISOR) {
    const team = await prisma.team.findFirst({
      where: { supervisorId: actor.id, employees: { some: { id: employeeId, deactivatedAt: null } } },
      select: { id: true },
    });
    if (!team) throw new AppError("You can only view self reviews for your team", 403);
    return;
  }
  if (actor.role === Role.HR) {
    const assignment = await prisma.hrTeamAssignment.findFirst({
      where: {
        hrEmployeeId: actor.id,
        team: { employees: { some: { id: employeeId, deactivatedAt: null } } },
      },
      select: { id: true },
    });
    if (!assignment) throw new AppError("You can only view self reviews in your HR scope", 403);
    return;
  }
  throw new AppError("You do not have permission to view this self review", 403);
}

function serializeResponse(response: {
  questionKey: string;
  question: string;
  sortOrder: number;
  evidenceRequired: boolean;
  rating: number | null;
  score: number;
  reason: string;
  evidenceFiles: Prisma.JsonValue | null;
}) {
  return {
    questionKey: response.questionKey,
    question: response.question,
    sortOrder: response.sortOrder,
    evidenceRequired: response.evidenceRequired,
    rating: response.rating,
    score: response.score,
    reason: response.reason,
    evidenceFiles: parseEvidence(response.evidenceFiles),
  };
}

function blankResponses() {
  return SELF_REVIEW_QUESTIONS.map((question) => ({
    questionKey: question.key,
    question: question.text,
    sortOrder: question.sortOrder,
    evidenceRequired: question.evidenceRequired,
    rating: null,
    score: 0,
    reason: "",
    evidenceFiles: [] as EvidenceFile[],
  }));
}

async function loadReview(employeeId: string, cycleId: string) {
  return prisma.selfReview.findUnique({
    where: { employeeId_cycleId: { employeeId, cycleId } },
    include: { responses: { orderBy: { sortOrder: "asc" } } },
  });
}

function presentReview(
  review: NonNullable<Awaited<ReturnType<typeof loadReview>>> | null,
  questions: SelfReviewQuestionDef[]
) {
  if (!review) {
    return {
      id: null,
      status: "NOT_STARTED" as const,
      totalScore: 0,
      percentage: 0,
      submittedAt: null,
      responses: questions.map((question) => ({
        questionKey: question.key,
        question: question.text,
        sortOrder: question.sortOrder,
        evidenceRequired: question.evidenceRequired,
        rating: null,
        score: 0,
        reason: "",
        evidenceFiles: [] as EvidenceFile[],
      })),
    };
  }

  const byKey = new Map(review.responses.map((response) => [response.questionKey, response]));
  return {
    id: review.id,
    status: review.status,
    totalScore: review.totalScore,
    percentage: review.percentage,
    submittedAt: review.submittedAt?.toISOString() ?? null,
    responses: questions.map((question) => {
      const existing = byKey.get(question.key);
      if (!existing) {
        return {
          questionKey: question.key,
          question: question.text,
          sortOrder: question.sortOrder,
          evidenceRequired: question.evidenceRequired,
          rating: null,
          score: 0,
          reason: "",
          evidenceFiles: [] as EvidenceFile[],
        };
      }
      return serializeResponse(existing);
    }),
  };
}

export async function getMySelfReview(actor: Actor) {
  if (actor.role !== Role.EMPLOYEE) {
    throw new AppError("Self review is available to employees", 403);
  }
  const context = await loadCycleContext(actor.id);
  const review = await loadReview(actor.id, context.cycle.id);
  const live = presentReview(context.available ? review : null, SELF_REVIEW_QUESTIONS);
  const answered = live.responses.filter((response) => response.rating != null && response.reason.trim()).length;
  const preview = summarizeSelfReview(
    live.responses.map((response) => (response.rating ? scoreForRating(response.rating) : 0))
  );

  return {
    available: context.available,
    unavailableReason: context.available ? null : unavailableMessage(),
    cycle: {
      id: context.cycle.id,
      name: context.cycle.name,
      startDate: context.cycle.startDate.toISOString(),
      endDate: context.cycle.endDate.toISOString(),
    },
    periodLabel: periodLabel(context.cycle.startDate, context.cycle.endDate),
    opensAt: context.opensAt.toISOString(),
    answered,
    questionCount: SELF_REVIEW_QUESTIONS.length,
    previewScore: context.available ? preview.totalScore : 0,
    previewPercentage: context.available ? preview.percentage : 0,
    review: context.available ? live : null,
    questions: context.available ? blankResponses() : [],
  };
}

export async function getEmployeeSelfReview(actor: Actor, employeeId: string) {
  await assertCanRead(actor, employeeId);
  const context = await loadCycleContext(employeeId);
  const review = await loadReview(employeeId, context.cycle.id);
  return {
    available: context.available,
    cycle: { id: context.cycle.id, name: context.cycle.name },
    periodLabel: periodLabel(context.cycle.startDate, context.cycle.endDate),
    review: review ? presentReview(review, SELF_REVIEW_QUESTIONS) : null,
  };
}

async function requireEditableDraft(actor: Actor) {
  if (actor.role !== Role.EMPLOYEE) {
    throw new AppError("Only an employee can update their self review", 403);
  }
  const context = await loadCycleContext(actor.id);
  if (!context.available) throw new AppError(unavailableMessage(), 403);
  const existing = await loadReview(actor.id, context.cycle.id);
  if (existing?.status === "SUBMITTED") {
    throw new AppError("This self review has already been submitted", 400);
  }
  return { context, existing };
}

export async function saveSelfReviewDraft(
  actor: Actor,
  input: {
    responses: Array<{ questionKey: string; rating?: number | null | undefined; reason?: string | undefined }>;
  }
) {
  const { context, existing } = await requireEditableDraft(actor);
  const review = existing
    ? existing
    : await prisma.selfReview.create({
        data: {
          employeeId: actor.id,
          cycleId: context.cycle.id,
          status: "DRAFT",
          responses: {
            create: SELF_REVIEW_QUESTIONS.map((question) => ({
              questionKey: question.key,
              question: question.text,
              sortOrder: question.sortOrder,
              evidenceRequired: question.evidenceRequired,
            })),
          },
        },
        include: { responses: true },
      });

  for (const answer of input.responses) {
    const question = questionByKey.get(answer.questionKey);
    if (!question) throw new AppError("Unknown self review question", 400);
    const rating = answer.rating ?? null;
    if (rating != null && (rating < 1 || rating > 5)) {
      throw new AppError("Rating must be between 1 and 5", 400);
    }
    const score = rating ? scoreForRating(rating) : 0;
    await prisma.selfReviewResponse.upsert({
      where: { selfReviewId_questionKey: { selfReviewId: review.id, questionKey: question.key } },
      create: {
        selfReviewId: review.id,
        questionKey: question.key,
        question: question.text,
        sortOrder: question.sortOrder,
        evidenceRequired: question.evidenceRequired,
        rating,
        score,
        reason: answer.reason?.trim() ?? "",
      },
      update: {
        rating,
        score,
        reason: answer.reason?.trim() ?? "",
      },
    });
  }

  const saved = await loadReview(actor.id, context.cycle.id);
  const scores = (saved?.responses ?? []).map((response) => response.score);
  const summary = summarizeSelfReview(scores);
  await prisma.selfReview.update({
    where: { id: review.id },
    data: { totalScore: summary.totalScore, percentage: summary.percentage },
  });

  return getMySelfReview(actor);
}

export async function addSelfReviewEvidence(
  actor: Actor,
  questionKey: string,
  file: Express.Multer.File
) {
  const question = questionByKey.get(questionKey);
  if (!question) throw new AppError("Unknown self review question", 400);
  const { context, existing } = await requireEditableDraft(actor);
  const review =
    existing ??
    (await prisma.selfReview.create({
      data: {
        employeeId: actor.id,
        cycleId: context.cycle.id,
        status: "DRAFT",
        responses: {
          create: SELF_REVIEW_QUESTIONS.map((item) => ({
            questionKey: item.key,
            question: item.text,
            sortOrder: item.sortOrder,
            evidenceRequired: item.evidenceRequired,
          })),
        },
      },
      include: { responses: true },
    }));

  const response = await prisma.selfReviewResponse.upsert({
    where: { selfReviewId_questionKey: { selfReviewId: review.id, questionKey: question.key } },
    create: {
      selfReviewId: review.id,
      questionKey: question.key,
      question: question.text,
      sortOrder: question.sortOrder,
      evidenceRequired: question.evidenceRequired,
    },
    update: {},
  });

  const files = parseEvidence(response.evidenceFiles);
  files.push({
    fileName: file.originalname,
    storedName: file.filename,
    mimeType: file.mimetype,
    size: file.size,
    uploadedAt: new Date().toISOString(),
  });

  await prisma.selfReviewResponse.update({
    where: { id: response.id },
    data: { evidenceFiles: files },
  });

  return getMySelfReview(actor);
}

function validateForSubmit(responses: ReturnType<typeof presentReview>["responses"]) {
  const errors: Array<{ questionKey: string; message: string }> = [];
  for (const question of SELF_REVIEW_QUESTIONS) {
    const response = responses.find((item) => item.questionKey === question.key);
    if (!response?.rating) {
      errors.push({ questionKey: question.key, message: "Please select a rating." });
      continue;
    }
    if (!response.reason.trim()) {
      errors.push({ questionKey: question.key, message: "Please provide a reason for this response." });
    }
    if (question.evidenceRequired && response.evidenceFiles.length === 0) {
      errors.push({ questionKey: question.key, message: "Please upload supporting evidence." });
    }
  }
  return errors;
}

export async function submitSelfReview(actor: Actor) {
  const { context, existing } = await requireEditableDraft(actor);
  if (!existing) throw new AppError("Complete the self review before submitting", 400);

  const presented = presentReview(existing, SELF_REVIEW_QUESTIONS);
  const errors = validateForSubmit(presented.responses);
  if (errors.length > 0) {
    throw new AppError(errors[0]?.message ?? "Self review is incomplete", 400);
  }

  const scores = presented.responses.map((response) => scoreForRating(response.rating ?? 0));
  const summary = summarizeSelfReview(scores);
  const submittedAt = new Date();

  await prisma.$transaction(async (tx) => {
    for (const response of presented.responses) {
      await tx.selfReviewResponse.update({
        where: { selfReviewId_questionKey: { selfReviewId: existing.id, questionKey: response.questionKey } },
        data: {
          rating: response.rating,
          score: scoreForRating(response.rating ?? 0),
          reason: response.reason.trim(),
        },
      });
    }
    await tx.selfReview.update({
      where: { id: existing.id },
      data: {
        status: "SUBMITTED",
        totalScore: summary.totalScore,
        percentage: summary.percentage,
        submittedAt,
      },
    });
  });

  const employee = await prisma.employee.findUnique({
    where: { id: actor.id },
    select: { name: true },
  });

  await createNotification({
    type: NotificationType.SELF_REVIEW_SUBMITTED,
    title: "Self review submitted",
    message: `You submitted your self review for ${context.cycle.name}. Score: ${summary.totalScore.toFixed(2)} / 20.`,
    recipientId: actor.id,
    subjectEmployeeId: actor.id,
    metadata: { cycleId: context.cycle.id, selfReviewId: existing.id },
  });

  if (context.pdp?.supervisorId) {
    await createNotification({
      type: NotificationType.SELF_REVIEW_SUBMITTED,
      title: "Employee self review submitted",
      message: `${employee?.name ?? "An employee"} submitted their self review for ${context.cycle.name}.`,
      recipientId: context.pdp.supervisorId,
      subjectEmployeeId: actor.id,
      metadata: { cycleId: context.cycle.id, selfReviewId: existing.id },
    });
  }

  return getMySelfReview(actor);
}

export async function readSelfReviewEvidence(
  actor: Actor,
  employeeId: string,
  questionKey: string,
  storedName: string
) {
  if (!/^[\w.\-]+$/.test(storedName)) throw new AppError("Invalid evidence filename", 400);
  await assertCanRead(actor, employeeId);
  const context = await loadCycleContext(employeeId);
  const review = await loadReview(employeeId, context.cycle.id);
  const response = review?.responses.find((item) => item.questionKey === questionKey);
  const files = parseEvidence(response?.evidenceFiles);
  const match = files.find((file) => file.storedName === storedName);
  if (!match) throw new AppError("Evidence not found", 404);
  const fullPath = evidenceFilePath(storedName);
  if (!fs.existsSync(fullPath)) throw new AppError("Evidence file is not available", 404);
  return { fullPath, fileName: match.fileName };
}
