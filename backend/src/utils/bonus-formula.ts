import { performanceBand } from "./performance-score.js";

export const FIXED_DAILY_BONUS_AMOUNT = 2500;
export const BONUS_WORKING_DAYS_PER_MONTH = 22;

/** Months of bonus from the confirmed final score (0–100). Below 60 earns no bonus. */
export function bonusMonthsForScore(score: number) {
  if (score >= 90) return 6;
  if (score >= 80) return 5.5;
  if (score >= 70) return 5;
  if (score >= 60) return 4;
  return 0;
}

export function computeBonus(finalScore: number, dailyAmount = FIXED_DAILY_BONUS_AMOUNT) {
  const score = Number(finalScore.toFixed(2));
  const months = bonusMonthsForScore(score);
  const amount = Number((dailyAmount * months * BONUS_WORKING_DAYS_PER_MONTH).toFixed(2));
  const band = performanceBand(score);
  const calculation =
    months === 0
      ? `${dailyAmount.toFixed(2)} daily × 0 months × ${BONUS_WORKING_DAYS_PER_MONTH} working days = 0.00 (below 60: no bonus)`
      : `${dailyAmount.toFixed(2)} daily × ${months} months × ${BONUS_WORKING_DAYS_PER_MONTH} working days = ${amount.toFixed(2)}`;
  return {
    finalScore: score,
    band,
    bonusMonths: months,
    dailyAmount,
    workingDaysPerMonth: BONUS_WORKING_DAYS_PER_MONTH,
    amount,
    calculation,
  };
}
