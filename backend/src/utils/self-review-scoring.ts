import { SELF_REVIEW_MAX_SCORE } from "../constants/self-review-questions.js";

/** Rating 1–5 maps to 0.20–1.00. Twenty questions therefore total 20 marks. */
export function scoreForRating(rating: number) {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return 0;
  return rating / 5;
}

export function summarizeSelfReview(scores: number[]) {
  const totalScore = Number(scores.reduce((sum, score) => sum + score, 0).toFixed(2));
  const percentage = Math.round((totalScore / SELF_REVIEW_MAX_SCORE) * 100);
  return { totalScore, percentage, maxScore: SELF_REVIEW_MAX_SCORE };
}
