import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Award,
  CalendarDays,
  Coins,
  Rocket,
  Star,
  TrendingUp,
} from "lucide-react";
import { cycleStatusLabel } from "@/features/hr/components/StatusBadge";
import { formatShortDate, formatShortDateRange } from "@/features/hr/utils/dates";
import { DASHBOARD_HERO_IMAGE } from "@/features/profile/portrait";
import type { DashboardPayload } from "../services/dashboard.api";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function firstName(name: string) {
  return name.split(" ")[0] ?? name;
}

function formatRs(value: number) {
  if (value >= 1_000_000) return `Rs. ${(value / 1_000_000).toFixed(1)}M`;
  return `Rs. ${Math.round(value).toLocaleString()}`;
}

function Donut({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;
  return (
    <div className="relative mx-auto h-36 w-36">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 128 128">
        <circle cx="64" cy="64" r={radius} fill="none" stroke="#f5f5f4" strokeWidth="12" />
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          stroke="#fbbf24"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-3xl font-semibold text-stone-900">{clamped}%</p>
        <p className="text-[11px] text-stone-400">Overall Score</p>
      </div>
    </div>
  );
}

export function EmployeeHomeDashboard({ data }: { data: DashboardPayload }) {
  const insight = data.insight;
  const performance = data.performance;
  const rewards = data.rewards;
  const career = data.career;
  const pip = data.assignedPip;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-5">
        <section className="relative overflow-hidden rounded-[28px] bg-white shadow-[0_16px_40px_rgba(28,25,23,0.06)]">
          <div className="grid md:grid-cols-[minmax(0,1fr)_280px]">
            <div className="px-6 py-7 sm:px-8">
              <p className="text-lg text-stone-500">{greeting()},</p>
              <h1 className="mt-1 text-4xl font-semibold tracking-tight text-stone-900 dark:text-white">
                {firstName(data.profile.name)}!
              </h1>
              <p className="mt-2 text-sm text-stone-500">
                Here&apos;s an overview of your performance, rewards and growth journey.
              </p>
            </div>
            <div className="relative hidden min-h-[160px] md:block">
              <img src={DASHBOARD_HERO_IMAGE} alt="" className="h-full w-full object-cover" />
              <p className="absolute right-4 top-4 text-right text-[11px] font-semibold uppercase leading-4 tracking-[0.18em] text-white">
                People
                <br />
                perform
                <br />
                together.
                <br />
                <span className="text-amber-300">Altrium</span>
              </p>
            </div>
          </div>
        </section>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi
            icon={<Coins className="h-5 w-5" />}
            value={formatRs(insight?.bonusAmount ?? 0)}
            label="Bonus Earned"
            change={insight?.bonusAuthorized ? "Authorized this cycle" : "From current score"}
          />
          <Kpi
            icon={<TrendingUp className="h-5 w-5" />}
            value={insight?.performanceBand ?? "—"}
            label="Performance Band"
            change={performance?.overall ? `${performance.overall}% overall` : undefined}
          />
          <Kpi
            icon={<Star className="h-5 w-5" />}
            value={insight?.awardsReceived ?? 0}
            label="Awards Received"
            change="This cycle"
          />
          <Kpi
            icon={<Rocket className="h-5 w-5" />}
            value={insight?.promotionStatus ?? "Not recommended"}
            label="Promotion Status"
            change={career?.recommendedTitle ?? undefined}
          />
        </div>

        <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-4">
          <section className="rounded-3xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-950">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Performance Overview</h2>
            </div>
            <Donut value={performance?.overall ?? 0} />
            <ul className="mt-4 space-y-2 text-sm">
              <Metric label="Goals Achievement" value={`${performance?.goals ?? 0}%`} />
              <Metric label="Competencies" value={`${performance?.competencies ?? 0}%`} />
              <Metric label="Peer Review" value={`${performance?.peerReview ?? 0}%`} />
              <Metric label="Self Review" value={`${performance?.selfReview ?? 0}%`} />
            </ul>
          </section>

          <section className="rounded-3xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-950">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Bonus & Rewards</h2>
            </div>
            <p className="text-3xl font-semibold text-stone-900">{formatRs(rewards?.bonusAmount ?? insight?.bonusAmount ?? 0)}</p>
            <p className="mt-1 text-xs text-stone-500">Earned this cycle</p>
            <ul className="mt-4 space-y-2">
              {(rewards?.awards ?? []).length === 0 ? (
                <li className="text-sm text-stone-500">No award nominations yet.</li>
              ) : (
                rewards?.awards.slice(0, 3).map((item) => (
                  <li key={item.id} className="flex items-center gap-2 text-sm">
                    <Award className="h-4 w-4 text-amber-500" />
                    <span>{item.title}</span>
                  </li>
                ))
              )}
            </ul>
          </section>

          <section className="rounded-3xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-950">
            <h2 className="text-sm font-semibold">Career Growth</h2>
            <p className="mt-3 text-lg font-semibold text-stone-900">{career?.promotionStatus ?? "Not recommended"}</p>
            <p className="mt-1 text-sm text-stone-500">
              {career?.recommendedTitle ?? "Based on your overall performance this cycle."}
            </p>
            {career?.reason ? <p className="mt-3 text-xs leading-5 text-stone-500">{career.reason}</p> : null}
          </section>

          <section className="rounded-3xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-950">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Key Dates</h2>
              <span className="text-xs text-stone-400">Timeline</span>
            </div>
            <ul className="space-y-3">
              {(data.keyDates ?? []).map((item) => (
                <li key={item.label} className="flex items-center justify-between border-b border-stone-100 py-1.5 text-sm last:border-0">
                  <span className="text-stone-500">{formatShortDate(item.date)}</span>
                  <span className="font-medium text-stone-800">{item.label}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <section className="rounded-3xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-950">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Recent Activities</h2>
              <span className="text-xs text-stone-400">View All</span>
            </div>
            <ul className="space-y-4">
              {(data.activities ?? []).slice(0, 5).map((item) => (
                <li key={item.id} className="flex gap-3 text-sm">
                  <div className="w-16 shrink-0 text-xs text-stone-400">
                    <p>{item.when}</p>
                    {item.time ? <p>{item.time}</p> : null}
                  </div>
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-400" />
                  <div>
                    <p className="font-medium text-stone-900">{item.title}</p>
                    <p className="mt-0.5 text-xs text-stone-500">{item.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-3xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-950">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Pending Actions</h2>
              <span className="text-xs text-stone-400">View All</span>
            </div>
            <ul className="space-y-3">
              {(data.pendingActions ?? []).map((item) => (
                <li key={item.title} className="flex items-center justify-between rounded-2xl bg-stone-50 px-3 py-3">
                  <div>
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-stone-500">{item.detail}</p>
                  </div>
                  <span className="text-stone-300">→</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <div className="space-y-5">
        <section className="overflow-hidden rounded-[28px] border border-amber-100 bg-[#fff8e8] p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
            Current Appraisal Cycle
          </p>
          {data.cycle ? (
            <>
              <div className="mt-3 flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-400 text-stone-900">
                  <CalendarDays className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-stone-900">{data.cycle.name}</h2>
                  <p className="mt-1 text-xs text-stone-500">
                    {formatShortDateRange(data.cycle.startDate, data.cycle.endDate)}
                  </p>
                  <p className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-emerald-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    {cycleStatusLabel(data.cycle.status)}
                  </p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-stone-600">
                {data.cycle.description ||
                  "Your performance, contributions and development are making a real impact. Keep up the great work."}
              </p>
              <p className="mt-4 text-right text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">
                Same people.
                <br />
                Bigger possibilities.
              </p>
            </>
          ) : (
            <p className="mt-4 text-sm text-stone-500">There is no active appraisal cycle at this time.</p>
          )}
        </section>

        {pip ? (
          <section className="overflow-hidden rounded-[28px] border border-amber-200 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-800">
              PIP / Personal Improvement Plan
            </p>
            <h2 className="mt-2 text-xl font-semibold text-stone-900">{pip.title}</h2>
            <div className="mt-3 grid gap-2 text-sm">
              <p>
                <span className="text-stone-400">Status:</span> {pip.status}
              </p>
              <p>
                <span className="text-stone-400">PIP Progress:</span> {pip.progress ?? 0}%
              </p>
              <p>
                <span className="text-stone-400">PIP Period:</span> {pip.reviewPeriod ?? data.cycle?.name ?? "—"}
              </p>
            </div>
            <ul className="mt-3 space-y-2">
              {(pip.goals ?? []).slice(0, 3).map((goal) => (
                <li key={goal.title} className="rounded-xl bg-amber-50 px-3 py-2 text-sm">
                  <p className="font-medium text-stone-800">{goal.title}</p>
                  <p className="text-xs text-stone-500">
                    {goal.progress}% · {(goal.actions ?? []).map((action) => action.title).slice(0, 2).join(" · ")}
                  </p>
                </li>
              ))}
            </ul>
            {pip.pendingAction ? <p className="mt-3 text-sm text-stone-600">{pip.pendingAction}</p> : null}
            <Link
              to="/employee/pip"
              className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl bg-amber-400 px-4 text-sm font-medium text-stone-900 hover:bg-amber-300"
            >
              View My PIP
            </Link>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function Kpi({
  icon,
  value,
  label,
  change,
}: {
  icon: ReactNode;
  value: string | number;
  label: string;
  change?: string;
}) {
  return (
    <div className="rounded-3xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-950">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-amber-600">
        {icon}
      </div>
      <p className="mt-4 text-2xl font-semibold text-stone-900">{value}</p>
      <p className="mt-1 text-sm text-stone-500">{label}</p>
      {change ? <p className="mt-2 text-xs font-medium text-emerald-600">{change}</p> : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-center justify-between">
      <span className="text-stone-500">{label}</span>
      <span className="font-medium text-stone-800">{value}</span>
    </li>
  );
}
