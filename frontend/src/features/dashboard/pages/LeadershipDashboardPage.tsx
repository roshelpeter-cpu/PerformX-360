import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Award,
  CalendarDays,
  Coins,
  Rocket,
  Target,
  Users,
} from "lucide-react";
import DashboardLayout from "@/app/layouts/DashboardLayout";
import { DashboardError, DashboardLoading } from "@/features/dashboard/components/DashboardUi";
import { formatShortDate, formatShortDateRange } from "@/features/hr/utils/dates";
import { DASHBOARD_HERO_IMAGE } from "@/features/profile/portrait";
import { useAuthStore } from "@/store/authStore";
import { leadershipApi } from "../services/leadership.api";

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

function BandDonut({
  total,
  slices,
}: {
  total: number;
  slices: Array<{ name: string; value: number; percent: number }>;
}) {
  const colors = ["#d97706", "#f59e0b", "#fbbf24", "#fde68a", "#e7e5e4"];
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <div className="flex flex-col items-center gap-4 lg:flex-row">
      <div className="relative h-40 w-40 shrink-0">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 140 140">
          <circle cx="70" cy="70" r={radius} fill="none" stroke="#f5f5f4" strokeWidth="14" />
          {slices.map((slice, index) => {
            const length = (slice.percent / 100) * circumference;
            const dashOffset = circumference - offset;
            offset += length;
            return (
              <circle
                key={slice.name}
                cx="70"
                cy="70"
                r={radius}
                fill="none"
                stroke={colors[index] ?? "#e7e5e4"}
                strokeWidth="14"
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={dashOffset}
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-3xl font-semibold text-stone-900">{total}</p>
          <p className="text-[11px] text-stone-400">Employees</p>
        </div>
      </div>
      <ul className="w-full space-y-2 text-sm">
        {slices.map((slice, index) => (
          <li key={slice.name} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-stone-600">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: colors[index] }} />
              {slice.name}
            </span>
            <span className="font-medium text-stone-800">
              {slice.percent}% ({slice.value})
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function LeadershipDashboardPage() {
  const user = useAuthStore((state) => state.user);
  const [cycleId, setCycleId] = useState<string>("");
  const query = useQuery({
    queryKey: ["leadership", "overview", cycleId],
    queryFn: async () => (await leadershipApi.overview(cycleId || undefined)).overview,
  });
  const data = query.data;
  const bands = data?.bandDistribution ?? data?.bands.map((row) => ({ ...row, percent: row.percent ?? 0 })) ?? [];

  return (
    <DashboardLayout>
      {query.isLoading ? <DashboardLoading /> : null}
      {query.isError ? (
        <DashboardError message="Unable to load leadership insights. Please try again." />
      ) : null}
      {data ? (
        <div className="space-y-5">
          <section className="relative overflow-hidden rounded-[28px] bg-white shadow-[0_16px_40px_rgba(28,25,23,0.06)]">
            <div className="grid md:grid-cols-[minmax(0,1fr)_280px]">
              <div className="px-6 py-7 sm:px-8">
                <p className="text-lg text-stone-500">{greeting()},</p>
                <h1 className="mt-1 text-4xl font-semibold tracking-tight text-stone-900">
                  {firstName(user?.name ?? "Leadership")}
                </h1>
                <p className="mt-2 text-2xl font-semibold text-stone-900">Leadership Dashboard</p>
                <p className="mt-2 max-w-2xl text-sm text-stone-500">
                  A comprehensive view of people, performance, rewards and growth across Altrium.
                </p>
              </div>
              <div className="relative hidden min-h-[160px] md:block">
                <img src={DASHBOARD_HERO_IMAGE} alt="" className="h-full w-full object-cover" />
                <div className="absolute right-4 top-4 rounded-2xl bg-white/90 px-3 py-2 text-xs">
                  <p className="font-semibold text-stone-800">Current Appraisal Cycle</p>
                  <select
                    className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-2 py-1 text-stone-700"
                    value={cycleId || data.cycle.id}
                    onChange={(event) => setCycleId(event.target.value)}
                  >
                    {(data.cycles ?? [data.cycle]).map((cycle) => (
                      <option key={cycle.id} value={cycle.id}>
                        {cycle.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-stone-400">
                    {formatShortDateRange(data.cycle.startDate, data.cycle.endDate)}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <SummaryCard icon={<Users className="h-5 w-5" />} value={data.kpis.employees} label="Total Employees" />
            <SummaryCard
              icon={<Target className="h-5 w-5" />}
              value={data.kpis.completedAppraisals ?? data.progress.completed}
              label="Completed Appraisals"
              hint={`${data.progress.overall}% completion rate`}
            />
            <SummaryCard icon={<Award className="h-5 w-5" />} value={data.kpis.awardsGiven ?? data.kpis.awards} label="Awards Given" />
            <SummaryCard
              icon={<Coins className="h-5 w-5" />}
              value={formatRs(data.kpis.totalBonusesAllocated ?? 0)}
              label="Total Bonuses Allocated"
            />
            <SummaryCard
              icon={<Rocket className="h-5 w-5" />}
              value={data.kpis.promotionRecommendations ?? data.kpis.promotions}
              label="Promotion Recommendations"
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-3">
            <section className="rounded-3xl border border-stone-200 bg-white p-5">
              <h2 className="text-sm font-semibold">Performance Band Distribution</h2>
              <div className="mt-4">
                <BandDonut total={data.kpis.employees} slices={bands} />
              </div>
            </section>
            <section className="rounded-3xl border border-stone-200 bg-white p-5">
              <h2 className="text-sm font-semibold">Bonus Allocation by Department</h2>
              <ul className="mt-4 space-y-3">
                {(data.bonusByDepartment ?? []).length === 0 ? (
                  <li className="text-sm text-stone-500">No bonus allocations recorded yet.</li>
                ) : (
                  (data.bonusByDepartment ?? []).slice(0, 6).map((row) => {
                    const max = Math.max(...(data.bonusByDepartment ?? []).map((item) => item.amount), 1);
                    return (
                      <li key={row.name}>
                        <div className="mb-1 flex justify-between text-sm">
                          <span>{row.name}</span>
                          <span className="font-medium">{formatRs(row.amount)}</span>
                        </div>
                        <div className="h-2 rounded-full bg-stone-100">
                          <div className="h-2 rounded-full bg-amber-400" style={{ width: `${(row.amount / max) * 100}%` }} />
                        </div>
                      </li>
                    );
                  })
                )}
              </ul>
            </section>
            <section className="rounded-3xl border border-stone-200 bg-white p-5">
              <h2 className="text-sm font-semibold">Awards Overview</h2>
              <p className="mt-3 text-3xl font-semibold">{data.awardsOverview?.total ?? data.kpis.awards}</p>
              <p className="text-xs text-stone-500">Awards given in this cycle</p>
              <ul className="mt-4 space-y-2 text-sm">
                {(data.awardsOverview?.categories ?? []).map((item) => (
                  <li key={item.name} className="flex items-center justify-between">
                    <span className="text-stone-600">{item.name}</span>
                    <span className="font-medium">{item.value}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <div className="grid gap-5 xl:grid-cols-3">
            <section className="rounded-3xl border border-stone-200 bg-white p-5">
              <h2 className="text-sm font-semibold">Promotion Pipeline</h2>
              <div className="mt-4 grid grid-cols-2 gap-3 text-center">
                <Pipe label="Recommended" value={data.promotionPipeline?.recommended ?? 0} />
                <Pipe label="Under Review" value={data.promotionPipeline?.underReview ?? 0} />
                <Pipe label="Approved" value={data.promotionPipeline?.approved ?? 0} />
                <Pipe label="Not Approved" value={data.promotionPipeline?.notApproved ?? 0} />
              </div>
            </section>
            <section className="rounded-3xl border border-stone-200 bg-white p-5">
              <h2 className="text-sm font-semibold">Appraisal Cycle Progress</h2>
              <div className="mt-3 flex items-center gap-4">
                <div className="relative flex h-28 w-28 items-center justify-center rounded-full border-[10px] border-amber-300">
                  <div className="text-center">
                    <p className="text-2xl font-semibold">{data.cycleProgress?.overall ?? data.progress.overall}%</p>
                    <p className="text-[10px] text-stone-400">Cycle Progress</p>
                  </div>
                </div>
                <ul className="flex-1 space-y-2 text-sm">
                  <Metric label="Goal Setting" value={`${data.cycleProgress?.goalSetting ?? 0}%`} />
                  <Metric label="Self Reviews" value={`${data.cycleProgress?.selfReviews ?? 0}%`} />
                  <Metric label="Manager Reviews" value={`${data.cycleProgress?.managerReviews ?? 0}%`} />
                  <Metric label="Final Evaluation" value={`${data.cycleProgress?.finalEvaluation ?? 0}%`} />
                </ul>
              </div>
            </section>
            <section className="rounded-3xl border border-stone-200 bg-white p-5">
              <h2 className="text-sm font-semibold">Upcoming Key Dates</h2>
              <ul className="mt-4 space-y-3">
                {(data.keyDates ?? []).map((item) => (
                  <li key={item.label} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-stone-500">
                      <CalendarDays className="h-3.5 w-3.5 text-amber-500" />
                      {formatShortDate(item.date)}
                    </span>
                    <span className="font-medium">{item.label}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      ) : null}
    </DashboardLayout>
  );
}

function SummaryCard({
  icon,
  value,
  label,
  hint,
}: {
  icon: ReactNode;
  value: string | number;
  label: string;
  hint?: string;
}) {
  return (
    <div className="rounded-3xl border border-stone-200 bg-white p-5">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-amber-600">{icon}</div>
      <p className="mt-4 text-2xl font-semibold text-stone-900">{value}</p>
      <p className="mt-1 text-sm text-stone-500">{label}</p>
      {hint ? <p className="mt-1 text-xs text-emerald-600">{hint}</p> : null}
    </div>
  );
}

function Pipe({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-stone-50 px-3 py-4">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-stone-500">{label}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-center justify-between">
      <span className="text-stone-500">{label}</span>
      <span className="font-medium">{value}</span>
    </li>
  );
}
