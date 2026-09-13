// Appraisal Cycle / Meeting date helpers
// Shared calendar and display formatting. Follow-up scheduling uses
// addCalendarMonths so monthly dates are calculated, not string-built.
export function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatCompactMonthYear(value: string | Date | null | undefined) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });
}

export function formatShortDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatShortDateRange(start: string, end: string) {
  return `${formatShortDate(start)} – ${formatShortDate(end)}`;
}

export function formatCompactDateRange(start: string, end: string) {
  return formatShortDateRange(start, end);
}

export function formatDateRange(start: string, end: string) {
  return `${formatDate(start)} — ${formatDate(end)}`;
}

export function formatBatchPeriodLabel(
  start: string | Date,
  end: string | Date,
  fallbackName?: string
) {
  const startDate = typeof start === "string" ? new Date(start) : start;
  const endDate = typeof end === "string" ? new Date(end) : end;
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return fallbackName ?? "Batch";
  }
  const startMonth = startDate.toLocaleDateString("en-US", { month: "long" });
  const endMonth = endDate.toLocaleDateString("en-US", { month: "long" });
  return `${startMonth} – ${endMonth}`;
}

export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function addCalendarMonths(date: Date, months: number) {
  const result = new Date(date.getTime());
  const day = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(day, lastDay));
  return result;
}

export function addOneYearIso(startDate: string) {
  const date = new Date(startDate);
  if (Number.isNaN(date.getTime())) return "";
  date.setFullYear(date.getFullYear() + 1);
  return date.toISOString().slice(0, 10);
}

export function addMonthsIso(startDate: string, months: number) {
  const date = new Date(startDate);
  if (Number.isNaN(date.getTime())) return "";
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
}

/** @deprecated Use formatBatchPeriodLabel instead */
export function batchNameFromDate(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "Batch";
  const month = date.toLocaleDateString("en-US", { month: "long" });
  return `${month} Batch`;
}

export function toDateInputValue(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function defaultBatchStartDates(cycleStartDate: string) {
  return [
    cycleStartDate,
    addMonthsIso(cycleStartDate, 2),
    addMonthsIso(cycleStartDate, 5),
  ];
}

export function getBatchDisplayName(batch: {
  name: string;
  batchNumber?: number;
  startDate?: string;
  endDate?: string;
}) {
  if (batch.batchNumber) return `Batch ${batch.batchNumber}`;
  if (batch.startDate && batch.endDate) {
    return formatBatchPeriodLabel(batch.startDate, batch.endDate, batch.name);
  }
  return batch.name;
}

export function getBatchStatusLabel(status: string) {
  if (status === "ONGOING") return "Ongoing";
  if (status === "FINISHED") return "Finished";
  return "Upcoming";
}

export function hasBatchStarted(startDate: string, now = new Date()) {
  const start = new Date(startDate);
  return !Number.isNaN(start.getTime()) && now >= start;
}
