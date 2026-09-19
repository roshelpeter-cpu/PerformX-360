import { Link } from "react-router-dom";
import { CalendarRange } from "lucide-react";
import { StatusBadge, cycleStatusLabel } from "@/features/hr/components/StatusBadge";
import { formatDate } from "@/features/hr/utils/dates";

export interface AppraisalCycleBannerData {
  id: string;
  name: string;
  status: string;
  startDate: string;
  endDate: string;
}

interface Props {
  cycle: AppraisalCycleBannerData | null | undefined;
  detailsHref?: string | null;
  emptyMessage?: string;
}

export default function CurrentAppraisalCycleBanner({
  cycle,
  detailsHref,
  emptyMessage = "There is no active appraisal cycle at this time.",
}: Props) {
  return (
    <section className="overflow-hidden rounded-3xl border border-amber-200/80 bg-gradient-to-br from-amber-50 via-white to-white p-6 shadow-[0_16px_40px_rgba(28,25,23,0.06)] dark:border-amber-900/40 dark:from-amber-950/30 dark:via-stone-950 dark:to-stone-950">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <CalendarRange className="h-4 w-4 text-amber-700 dark:text-amber-300" />
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-800 dark:text-amber-300">
              Current Appraisal Cycle
            </p>
          </div>

          {cycle ? (
            <>
              <h2 className="mt-3 text-2xl font-semibold text-stone-900 dark:text-white">
                {cycle.name}
              </h2>
              <dl className="mt-4 grid gap-4 sm:grid-cols-3">
                <div>
                  <dt className="text-xs uppercase tracking-wider text-stone-500">
                    Start date
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-stone-800 dark:text-stone-100">
                    {formatDate(cycle.startDate)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-stone-500">
                    End date
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-stone-800 dark:text-stone-100">
                    {formatDate(cycle.endDate)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-stone-500">
                    Status
                  </dt>
                  <dd className="mt-1">
                    <StatusBadge status={cycle.status} />
                    <span className="sr-only">{cycleStatusLabel(cycle.status)}</span>
                  </dd>
                </div>
              </dl>
            </>
          ) : (
            <p className="mt-3 text-sm text-stone-600 dark:text-stone-400">
              {emptyMessage}
            </p>
          )}
        </div>

        {cycle && detailsHref ? (
          <Link
            to={detailsHref}
            className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-stone-900 px-5 text-sm font-medium text-white hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-950 dark:hover:bg-white"
          >
            View Cycle Details
          </Link>
        ) : null}
      </div>
    </section>
  );
}
