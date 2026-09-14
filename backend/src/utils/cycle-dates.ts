import { AppraisalBatchStatus } from "../../generated/prisma/client.js";

// ============================================================
// APPRAISAL CYCLE DATE HELPERS
// Cycle duration is always exactly one year. Each batch also lasts one
// year from its own start date, so the three batches may overlap.
// ============================================================

export function addOneYear(date: Date): Date {
  const result = new Date(date);
  result.setFullYear(result.getFullYear() + 1);
  return result;
}

export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

export function parseDate(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date");
  }
  return date;
}

export function defaultBatchStartDates(cycleStart: Date): [Date, Date, Date] {
  return [cycleStart, addMonths(cycleStart, 2), addMonths(cycleStart, 5)];
}

export function batchPeriodName(start: Date, end: Date): string {
  const startMonth = start.toLocaleDateString("en-US", { month: "long" });
  const endMonth = end.toLocaleDateString("en-US", { month: "long" });
  return `${startMonth} – ${endMonth}`;
}

// ============================================================
// BATCH DISPLAY STATUS
// Derived from configured dates so the UI never confuses batch progress
// with the appraisal cycle lifecycle (Draft / Upcoming / Active / Completed).
// ============================================================
export function deriveBatchStatus(
  startDate: Date,
  endDate: Date,
  now = new Date()
): AppraisalBatchStatus {
  if (now < startDate) return AppraisalBatchStatus.UPCOMING;
  if (now >= endDate) return AppraisalBatchStatus.FINISHED;
  return AppraisalBatchStatus.ONGOING;
}

export function hasBatchStarted(startDate: Date, now = new Date()): boolean {
  return now >= startDate;
}

export function cycleYear(startDate: Date): number {
  return startDate.getUTCFullYear();
}

/** Add calendar days in UTC (used for exclusive start-date bounds). */
export function addUtcDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/** YYYY-MM-DD for date inputs / API payloads. */
export function toIsoDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}
