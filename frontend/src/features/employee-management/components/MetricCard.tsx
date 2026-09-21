import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function MetricCard({
  icon,
  value,
  label,
  hint,
  tone,
}: {
  icon: ReactNode;
  value: string | number;
  label: string;
  hint?: string;
  tone: "blue" | "amber" | "green" | "red" | "slate";
}) {
  const tones = {
    blue: "bg-sky-50 text-sky-600",
    amber: "bg-amber-50 text-amber-600",
    green: "bg-emerald-50 text-emerald-600",
    red: "bg-rose-50 text-rose-600",
    slate: "bg-stone-100 text-stone-600",
  };
  return (
    <div className="rounded-[24px] border border-stone-200 bg-white px-5 py-4 shadow-[0_10px_30px_rgba(28,25,23,0.04)] dark:border-stone-800 dark:bg-stone-950">
      <div className="flex items-start gap-3">
        <span className={cn("flex h-10 w-10 items-center justify-center rounded-2xl", tones[tone])}>
          {icon}
        </span>
        <div>
          <p className="text-2xl font-semibold tabular-nums text-stone-900 dark:text-white">{value}</p>
          <p className="text-sm text-stone-500">{label}</p>
          {hint ? <p className="mt-1 text-xs text-emerald-600">{hint}</p> : null}
        </div>
      </div>
    </div>
  );
}
