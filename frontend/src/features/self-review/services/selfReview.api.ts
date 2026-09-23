import { apiRequest } from "@/services/api/client";

export interface SelfReviewEvidence {
  fileName: string;
  storedName: string;
  mimeType?: string | null;
  size?: number | null;
  uploadedAt?: string | null;
}

export interface SelfReviewResponse {
  questionKey: string;
  question: string;
  sortOrder: number;
  evidenceRequired: boolean;
  rating: number | null;
  score: number;
  reason: string;
  evidenceFiles: SelfReviewEvidence[];
}

export interface SelfReviewPayload {
  available: boolean;
  unavailableReason: string | null;
  cycle: { id: string; name: string; startDate: string; endDate: string };
  periodLabel: string;
  answered: number;
  questionCount: number;
  previewScore: number;
  previewPercentage: number;
  review: {
    id: string | null;
    status: "NOT_STARTED" | "DRAFT" | "SUBMITTED";
    totalScore: number;
    percentage: number;
    submittedAt: string | null;
    responses: SelfReviewResponse[];
  } | null;
}

const RATING_TO_MARK = (rating: number) => rating / 5;

export function liveSelfReviewScore(responses: Array<{ rating: number | null }>) {
  const total = responses.reduce((sum, response) => sum + (response.rating ? RATING_TO_MARK(response.rating) : 0), 0);
  const totalScore = Number(total.toFixed(2));
  const percentage = Math.round((totalScore / 20) * 100);
  return { totalScore, percentage };
}

export const RATING_OPTIONS = [
  { value: 1, label: "1 — Needs Significant Improvement" },
  { value: 2, label: "2 — Needs Improvement" },
  { value: 3, label: "3 — Meets Expectations" },
  { value: 4, label: "4 — Exceeds Expectations" },
  { value: 5, label: "5 — Outstanding" },
];

export const selfReviewApi = {
  getMine() {
    return apiRequest<{ success: true; selfReview: SelfReviewPayload }>(`/self-reviews/mine`);
  },
  save(responses: Array<{ questionKey: string; rating: number | null; reason: string }>) {
    return apiRequest<{ success: true; selfReview: SelfReviewPayload }>(`/self-reviews/mine`, {
      method: "PUT",
      body: { responses },
    });
  },
  uploadEvidence(questionKey: string, file: File) {
    const body = new FormData();
    body.append("evidence", file);
    return apiRequest<{ success: true; selfReview: SelfReviewPayload }>(
      `/self-reviews/mine/responses/${questionKey}/evidence`,
      { method: "POST", body }
    );
  },
  submit() {
    return apiRequest<{ success: true; selfReview: SelfReviewPayload }>(`/self-reviews/mine/submit`, {
      method: "POST",
    });
  },
};
