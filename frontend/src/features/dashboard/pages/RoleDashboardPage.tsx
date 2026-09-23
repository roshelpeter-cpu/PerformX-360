import { Link } from "react-router-dom";
import {
  CalendarDays,
  CheckCircle2,
  Target,
  Users,
} from "lucide-react";
import DashboardLayout from "@/app/layouts/DashboardLayout";
import { useMyDashboard } from "@/features/dashboard/hooks/useDashboard";
import {
  DashboardError,
  DashboardLoading,
} from "@/features/dashboard/components/DashboardUi";
import {
  DASHBOARD_HERO_IMAGE,
  DASHBOARD_PROMO_IMAGE,
} from "@/features/profile/portrait";
import { cycleStatusLabel } from "@/features/hr/components/StatusBadge";
import { formatShortDate, formatShortDateRange } from "@/features/hr/utils/dates";
import { isHrStaffRole } from "@/constants/roles";
import { useAuthStore } from "@/store/authStore";
import { EmployeeHomeDashboard } from "@/features/dashboard/components/EmployeeHomeDashboard";
import type { DashboardPayload } from "@/features/dashboard/services/dashboard.api";

const STAT_ICONS = [Users, Target, CheckCircle2, CalendarDays];

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function firstName(name: string) {
  return name.split(" ")[0] ?? name;
}

function subtitleForRole(role: DashboardPayload["role"]) {
  if (role === "EMPLOYEE") {
    return "Here's what's happening with your performance today.";
  }
  if (role === "SUPERVISOR") {
    return "Here's what's happening across your team today.";
  }
  return "Here's what's happening across your people today.";
}

export default function RoleDashboardPage() {
  const user = useAuthStore((state) => state.user);
  const query = useMyDashboard();
  const data = query.data;
  const canViewCycleDetails = user ? isHrStaffRole(user.role) : false;

  return (
    <DashboardLayout>
      {query.isLoading ? <DashboardLoading /> : null}
      {query.isError ? (
        <DashboardError message="Unable to load your dashboard. Please try again." />
      ) : null}
      {data?.role === "EMPLOYEE" ? <EmployeeHomeDashboard data={data} /> : null}
      {data && data.role !== "EMPLOYEE" ? (
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
                    {subtitleForRole(data.role)}
                  </p>
                </div>
                <div className="relative hidden min-h-[160px] md:block">
                  <img
                    src={DASHBOARD_HERO_IMAGE}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-l from-transparent to-white/10" />
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
              {(data.stats ?? []).map((stat, index) => {
                const Icon = STAT_ICONS[index] ?? Users;
                return (
                  <div
                    key={stat.label}
                    className="rounded-3xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-950"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                      <Icon className="h-5 w-5" />
                    </div>
                    <p className="mt-4 text-3xl font-semibold text-stone-900 dark:text-white">
                      {stat.value}
                    </p>
                    <p className="mt-1 text-sm text-stone-500">{stat.label}</p>
                    {stat.change ? (
                      <p className="mt-2 text-xs font-medium text-emerald-600">
                        {stat.change}
                      </p>
                    ) : null}
                  </div>
                );
              })}
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
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-stone-300" />
                      <div>
                        <p className="font-medium text-stone-900 dark:text-white">
                          {item.title}
                        </p>
                        <p className="mt-0.5 text-xs text-stone-500">
                          {item.detail}
                        </p>
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
                    <li
                      key={item.title}
                      className="flex items-start gap-3 rounded-2xl bg-stone-50 px-3 py-3 dark:bg-stone-900"
                    >
                      <span className="flex h-8 min-w-8 items-center justify-center rounded-lg bg-rose-50 text-sm font-semibold text-rose-600">
                        {item.count}
                      </span>
                      <div>
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="text-xs text-stone-500">{item.detail}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <section className="relative overflow-hidden rounded-[28px] bg-stone-950 text-white">
              <img
                src={DASHBOARD_PROMO_IMAGE}
                alt=""
                className="absolute inset-0 h-full w-full object-cover opacity-50"
              />
              <div className="relative grid gap-4 px-6 py-8 sm:grid-cols-2 sm:px-8">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-300">
                    Altrium
                  </p>
                  <h2 className="mt-2 text-3xl font-semibold leading-tight">
                    Empowering
                    <br />
                    People.
                    <br />
                    Enabling Progress.
                  </h2>
                </div>
                <p className="self-end text-right text-sm text-stone-200">
                  Technology
                  <br />
                  People
                  <br />
                  Impact
                </p>
              </div>
            </section>
          </div>

          <div className="space-y-5">
            {data.assignedPip ? (
              <section className="overflow-hidden rounded-[28px] border border-amber-200 bg-[#fff8e8] p-5 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-800">
                  Assigned PIP
                </p>
                <h2 className="mt-2 text-xl font-semibold text-stone-900">PIP has been assigned to you</h2>
                <p className="mt-2 text-sm text-stone-600">
                  {data.assignedPip.title}. Open your improvement plan to review goals, progress, and
                  required actions.
                </p>
                <Link
                  to="/employee/pip"
                  className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl bg-amber-400 px-4 text-sm font-medium text-stone-900 hover:bg-amber-300"
                >
                  View My PIP
                </Link>
              </section>
            ) : null}

            <section className="overflow-hidden rounded-[28px] border border-amber-100 bg-[#fff8e8] p-5 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/20">
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
                      <h2 className="text-xl font-bold text-stone-900 dark:text-white">
                        {data.cycle.name}
                      </h2>
                      <p className="mt-1 text-xs text-stone-500">
                        {formatShortDateRange(
                          data.cycle.startDate,
                          data.cycle.endDate
                        )}
                      </p>
                      <p className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-emerald-600">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        {cycleStatusLabel(data.cycle.status)}
                      </p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-stone-600 dark:text-stone-300">
                    {data.cycle.description ||
                      "Annual performance and development appraisal cycle for all employees across the organization."}
                  </p>
                  {canViewCycleDetails ? (
                    <Link
                      to={`/hr/appraisal-cycles/${data.cycle.id}`}
                      className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-xl bg-stone-900 px-4 text-sm font-medium text-white hover:bg-stone-800"
                    >
                      View Cycle Details →
                    </Link>
                  ) : null}
                  <p className="mt-4 text-right text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">
                    Same people.
                    <br />
                    Bigger possibilities.
                  </p>
                </>
              ) : (
                <p className="mt-4 text-sm text-stone-500">
                  There is no active appraisal cycle at this time.
                </p>
              )}
            </section>

            <section className="rounded-3xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-950">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Key Dates</h2>
                {canViewCycleDetails && data.cycle ? (
                  <Link
                    to={`/hr/appraisal-cycles/${data.cycle.id}?tab=timeline`}
                    className="text-xs text-stone-500 hover:text-stone-800"
                  >
                    View Timeline
                  </Link>
                ) : (
                  <span className="text-xs text-stone-400">Timeline</span>
                )}
              </div>
              <ul className="space-y-3">
                {(data.keyDates ?? []).map((item) => (
                  <li
                    key={item.label}
                    className="flex items-center justify-between border-b border-stone-100 py-2 text-sm last:border-0 dark:border-stone-800"
                  >
                    <span className="text-stone-500">
                      {formatShortDate(item.date)}
                    </span>
                    <span className="font-medium text-stone-800 dark:text-stone-100">
                      {item.label}
                    </span>
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
