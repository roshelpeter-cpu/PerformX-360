import { cn } from "@/lib/utils";
import type { AppraisalCycleStatus } from "@/features/hr/types";

const cycleStyles: Record<string, string> = {
  DRAFT: "bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-200",
  UPCOMING: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-200",
  ACTIVE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200",
  COMPLETED:
    "border border-emerald-300 bg-transparent text-emerald-800 dark:border-emerald-700 dark:text-emerald-200",
  CURRENT: "bg-amber-100 text-amber-900 dark:bg-amber-400/20 dark:text-amber-200",
  IN_PROGRESS: "text-amber-700 dark:text-amber-300",
  OVERDUE: "text-red-700 dark:text-red-300",
  NOT_STARTED: "text-stone-500",
};

const labels: Record<string, string> = {
  DRAFT: "Draft",
  UPCOMING: "Upcoming",
  ACTIVE: "Active",
  COMPLETED: "Completed",
  CURRENT: "Current",
  IN_PROGRESS: "In Progress",
  OVERDUE: "Overdue",
  NOT_STARTED: "Not Started",
};

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wide",
        cycleStyles[status] ??
          "bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-200",
        className
      )}
    >
      {labels[status] ?? status.replaceAll("_", " ")}
    </span>
  );
}

export function cycleStatusLabel(status: AppraisalCycleStatus | string) {
  return labels[status] ?? status;
}
