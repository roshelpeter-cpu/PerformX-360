import { Link } from "react-router-dom";
import { StatusBadge } from "@/features/hr/components/StatusBadge";
import type { AppraisalCycle } from "@/features/hr/types";
import { formatShortDateRange } from "@/features/hr/utils/dates";

interface Props {
  cycle: AppraisalCycle;
}

export default function ActiveCycleSummaryCard({ cycle }: Props) {
  const progress = cycle.progress;
  const percent = progress.progressPercent;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm dark:border-stone-800 dark:bg-stone-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-stone-900 dark:text-stone-50">
              {cycle.name}
            </h2>
            <StatusBadge status={cycle.status} />
          </div>
          <p className="mt-1 text-sm text-stone-500">
            {formatShortDateRange(cycle.startDate, cycle.endDate)}
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-3 text-sm">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
          Cycle Information
        </h3>
        <dl className="grid gap-2">
          <div className="flex justify-between gap-3">
            <dt className="text-stone-500">Cycle Name</dt>
            <dd className="font-medium text-right">{cycle.name}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-stone-500">Period</dt>
            <dd className="text-right">
              {formatShortDateRange(cycle.startDate, cycle.endDate)}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-stone-500">Status</dt>
            <dd>
              <StatusBadge status={cycle.status} />
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-stone-500">Created By</dt>
            <dd className="text-right">{cycle.createdBy?.name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-stone-500">Description</dt>
            <dd className="mt-1 text-stone-700 dark:text-stone-300">
              {cycle.description || "No description provided."}
            </dd>
          </div>
        </dl>
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Overall Progress</span>
          <span className="font-semibold">{percent}%</span>
        </div>
        <p className="mt-1 text-xs text-stone-500">
          {progress.completed + progress.inProgress} of {progress.totalEmployees}{" "}
          employees
        </p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800">
          <div
            className="h-full rounded-full bg-amber-400"
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-center text-xs">
          <div className="rounded-xl bg-emerald-50 px-2 py-3 dark:bg-emerald-950/30">
            <p className="text-lg font-bold text-emerald-700">{progress.completed}</p>
            <p className="text-stone-500">Completed</p>
          </div>
          <div className="rounded-xl bg-amber-50 px-2 py-3 dark:bg-amber-950/30">
            <p className="text-lg font-bold text-amber-700">{progress.inProgress}</p>
            <p className="text-stone-500">In Progress</p>
          </div>
          <div className="rounded-xl bg-red-50 px-2 py-3 dark:bg-red-950/30">
            <p className="text-lg font-bold text-red-700">{progress.overdue}</p>
            <p className="text-stone-500">Overdue</p>
          </div>
          <div className="rounded-xl bg-stone-50 px-2 py-3 dark:bg-stone-950/50">
            <p className="text-lg font-bold text-stone-800 dark:text-stone-100">
              {progress.totalEmployees}
            </p>
            <p className="text-stone-500">Total</p>
          </div>
        </div>
      </div>

      <Link
        to={`/hr/appraisal-cycles/${cycle.id}`}
        className="mt-5 inline-flex h-10 w-full items-center justify-center rounded-lg bg-amber-400 px-4 text-sm font-semibold text-stone-900 hover:bg-amber-300"
      >
        View Full Cycle Details →
      </Link>
    </div>
  );
}
