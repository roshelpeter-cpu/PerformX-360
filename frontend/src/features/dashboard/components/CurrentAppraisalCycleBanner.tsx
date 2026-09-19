import { Link } from "react-router-dom";
import { CalendarDays } from "lucide-react";
import { cycleStatusLabel } from "@/features/hr/components/StatusBadge";
import { formatShortDateRange } from "@/features/hr/utils/dates";

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
  const banner = (
    <section className="relative isolate overflow-hidden rounded-[28px] bg-white shadow-[0_18px_50px_rgba(28,25,23,0.10)] dark:bg-stone-950 dark:shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
      <div className="grid lg:grid-cols-[minmax(0,1.12fr)_minmax(0,1fr)]">
        <div className="bg-[#fff4cc] px-5 py-5 sm:px-7 sm:py-[22px] dark:bg-amber-950/45">
          <div className="flex items-center gap-4 sm:gap-5">
            <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full bg-[#f0c000] shadow-[0_10px_22px_rgba(240,192,0,0.38)] sm:h-20 sm:w-20">
              <CalendarDays
                className="h-9 w-9 text-white sm:h-10 sm:w-10"
                strokeWidth={1.7}
              />
            </div>

            <div className="min-w-0">
              <p className="text-[13px] font-medium leading-none text-stone-500 dark:text-stone-400">
                Current Appraisal Cycle
              </p>
              {cycle ? (
                <>
                  <h2 className="mt-1.5 truncate text-[26px] font-bold leading-[1.15] tracking-tight text-stone-900 sm:text-[30px] dark:text-stone-50">
                    {cycle.name}
                  </h2>
                  <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
                    <span className="inline-flex items-center gap-1.5 text-[13px] text-stone-500 dark:text-stone-400">
                      <CalendarDays className="h-3.5 w-3.5" strokeWidth={2} />
                      {formatShortDateRange(cycle.startDate, cycle.endDate)}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-[#e8b000] px-3 py-[3px] text-[12px] font-semibold text-white">
                      {cycleStatusLabel(cycle.status)}
                    </span>
                  </div>
                </>
              ) : (
                <p className="mt-1.5 max-w-md text-sm text-stone-600">
                  {emptyMessage}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="relative min-h-[112px] overflow-hidden border-t border-stone-100 bg-white dark:border-stone-800 dark:bg-stone-950 lg:border-l lg:border-t-0 lg:border-stone-200/70 dark:lg:border-stone-800">
          <BannerGeometry />
          <div className="relative z-[1] flex h-full min-h-[112px] items-center px-5 py-5 pr-28 sm:px-7 sm:pr-36">
            <div>
              <p className="max-w-[260px] text-[15px] leading-[1.55] text-stone-600 dark:text-stone-300">
                A year to reflect, grow and achieve more.
                <br />
                Keep working towards your goals.
              </p>
              {cycle && detailsHref ? (
                <p className="mt-2.5 text-[13px] font-medium text-stone-800 dark:text-stone-100">
                  View Cycle Details →
                </p>
              ) : null}
            </div>
          </div>
          <p className="pointer-events-none absolute right-5 top-1/2 z-[2] hidden -translate-y-1/2 text-right text-[11px] font-semibold uppercase leading-[1.4] tracking-[0.2em] text-stone-700 dark:text-stone-200 sm:block">
            Your
            <br />
            growth
            <br />
            our
            <br />
            priority.
          </p>
        </div>
      </div>
    </section>
  );

  if (cycle && detailsHref) {
    return (
      <Link
        to={detailsHref}
        className="block rounded-[28px] outline-none ring-offset-2 transition hover:brightness-[0.99] focus-visible:ring-2 focus-visible:ring-amber-400"
        aria-label={`View cycle details for ${cycle.name}`}
      >
        {banner}
      </Link>
    );
  }

  return banner;
}

function BannerGeometry() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 480 200"
      preserveAspectRatio="xMaxYMid slice"
      className="pointer-events-none absolute inset-y-0 right-0 h-full w-[70%] min-w-[240px]"
    >
      <polygon points="80,200 230,-30 480,-30 480,200" fill="#f7ebc0" />
      <polygon points="170,200 310,-40 480,-40 480,200" fill="#f3d56a" />
      <polygon points="250,200 380,-20 480,-20 480,200" fill="#e8c44a" />
      <polygon points="300,200 420,-10 480,-10 480,200" fill="#d4a017" opacity="0.55" />
      <polygon points="220,0 330,100 220,200 110,100" fill="#fff8dc" opacity="0.45" />
      <polygon points="320,10 450,90 380,200 250,110" fill="#f6e08a" opacity="0.65" />
    </svg>
  );
}
