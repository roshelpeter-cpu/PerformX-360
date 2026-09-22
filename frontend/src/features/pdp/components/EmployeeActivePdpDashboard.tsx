import { useMemo, useState, type ReactNode } from "react";
import {
  Award,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Circle,
  FileText,
  Heart,
  Laptop,
  ListChecks,
  MessageCircle,
  MessageSquare,
  Target,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatShortDate } from "@/features/hr/utils/dates";
import type { PdpDetail, PdpGoal, PdpSubGoal } from "../services/pdp.api";
import { cn } from "@/lib/utils";

const GOAL_ICONS = [Laptop, Users, Target, MessageSquare, Heart] as const;

function monthYear(value: string | undefined | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

function periodLabel(pdp: PdpDetail) {
  const start = monthYear(pdp.cycle.startDate);
  const end = monthYear(pdp.cycle.endDate);
  if (start && end) return `${start} – ${end}`;
  return pdp.cycle.name;
}

function subStatus(sub: PdpSubGoal): "COMPLETED" | "IN_PROGRESS" | "NOT_STARTED" {
  if (sub.status === "COMPLETED" || sub.status === "IN_PROGRESS" || sub.status === "NOT_STARTED") {
    return sub.status;
  }
  return "NOT_STARTED";
}

function completedCount(goal: PdpGoal) {
  return (goal.subGoals ?? []).filter((sub) => subStatus(sub) === "COMPLETED").length;
}

function goalProgress(goal: PdpGoal) {
  if (typeof goal.progress === "number" && goal.progress >= 0) return goal.progress;
  const subs = goal.subGoals ?? [];
  if (!subs.length) return 0;
  return Math.round((completedCount(goal) / subs.length) * 100);
}

function StatusIcon({ status }: { status: "COMPLETED" | "IN_PROGRESS" | "NOT_STARTED" }) {
  if (status === "COMPLETED") {
    return <CheckCircle2 className="h-4 w-4 text-amber-500" />;
  }
  if (status === "IN_PROGRESS") {
    return <Circle className="h-4 w-4 text-amber-400" strokeWidth={2.5} />;
  }
  return <Circle className="h-4 w-4 text-stone-300" strokeWidth={2.5} />;
}

function statusLabel(status: "COMPLETED" | "IN_PROGRESS" | "NOT_STARTED") {
  if (status === "COMPLETED") return "Completed";
  if (status === "IN_PROGRESS") return "In Progress";
  return "Not Started";
}

function ProgressBar({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-100">
      <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${clamped}%` }} />
    </div>
  );
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
      </div>
    </div>
  );
}

function GoalPanel({
  goal,
  index,
  expanded,
  onToggle,
}: {
  goal: PdpGoal;
  index: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const Icon = GOAL_ICONS[index % GOAL_ICONS.length]!;
  const progress = goalProgress(goal);
  const done = completedCount(goal);
  const total = goal.subGoals?.length ?? 0;

  return (
    <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-3 px-4 py-4 text-left hover:bg-stone-50/80"
      >
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-semibold text-amber-900">
          {index + 1}
        </span>
        <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-700">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-stone-900">{goal.title}</p>
              <p className="mt-0.5 text-sm text-stone-500">{goal.objective}</p>
            </div>
            <ChevronDown
              className={cn(
                "mt-1 h-4 w-4 shrink-0 text-stone-400 transition-transform",
                expanded && "rotate-180"
              )}
            />
          </div>
          <div className="mt-3 flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <ProgressBar value={progress} />
            </div>
            <p className="shrink-0 text-xs font-medium text-stone-500">
              {progress}% · {done} / {total} sub-goals completed
            </p>
          </div>
        </div>
      </button>

      {expanded ? (
        <div className="border-t border-stone-100 px-4 pb-4">
          <div className="overflow-x-auto">
            <table className="mt-3 w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-stone-400">
                  <th className="pb-2 pr-2 font-medium">#</th>
                  <th className="pb-2 pr-2 font-medium">Sub-goal</th>
                  <th className="pb-2 pr-2 font-medium">Status</th>
                  <th className="pb-2 pr-2 font-medium">Due Date</th>
                  <th className="pb-2 pr-2 font-medium">Evidence</th>
                  <th className="pb-2 pr-2 font-medium">Comments</th>
                  <th className="pb-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(goal.subGoals ?? []).map((sub, subIndex) => {
                  const status = subStatus(sub);
                  const evidence = sub.evidenceCount ?? 0;
                  return (
                    <tr key={sub.id} className="border-t border-stone-50 align-top">
                      <td className="py-3 pr-2 text-stone-400">
                        {index + 1}.{subIndex + 1}
                      </td>
                      <td className="py-3 pr-2 font-medium text-stone-800">{sub.title}</td>
                      <td className="py-3 pr-2">
                        <span className="inline-flex items-center gap-1.5 text-stone-700">
                          <StatusIcon status={status} />
                          {statusLabel(status)}
                        </span>
                      </td>
                      <td className="py-3 pr-2 text-stone-600">
                        {sub.dueDate ? formatShortDate(sub.dueDate) : "—"}
                      </td>
                      <td className="py-3 pr-2 text-stone-600">
                        {evidence} {evidence === 1 ? "file" : "files"}
                      </td>
                      <td className="py-3 pr-2 text-stone-600">{sub.comment?.trim() || "—"}</td>
                      <td className="py-3">
                        {status === "COMPLETED" ? (
                          <Button type="button" size="sm" variant="outline" className="h-8 rounded-lg px-3">
                            View
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            className="h-8 rounded-lg bg-amber-400 px-3 text-stone-900 hover:bg-amber-300"
                          >
                            Update
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function EmployeeActivePdpDashboard({ pdp }: { pdp: PdpDetail }) {
  const goals = pdp.currentVersion?.goals ?? [];
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    goals[0] ? { [goals[0].id]: true } : {}
  );
  const [detailsOpen, setDetailsOpen] = useState(false);

  const stats = useMemo(() => {
    const allSubs = goals.flatMap((goal) => goal.subGoals ?? []);
    const completedSubs = allSubs.filter((sub) => subStatus(sub) === "COMPLETED").length;
    const overall =
      goals.length > 0
        ? Math.round(goals.reduce((sum, goal) => sum + goalProgress(goal), 0) / goals.length)
        : 0;

    const now = Date.now();
    const soonMs = 1000 * 60 * 60 * 24 * 45;
    const dueSoon = allSubs.filter((sub) => {
      if (!sub.dueDate || subStatus(sub) === "COMPLETED") return false;
      const due = new Date(sub.dueDate).getTime();
      return due >= now && due - now <= soonMs;
    }).length;

    const completedMainGoals = goals.filter((goal) => goalProgress(goal) >= 100).length;

    const upcoming = allSubs
      .filter((sub) => sub.dueDate && subStatus(sub) !== "COMPLETED")
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
      .slice(0, 3);

    return {
      mainGoals: goals.length,
      subGoals: allSubs.length,
      overall,
      completedSubs,
      dueSoon,
      completedMainGoals,
      upcoming,
    };
  }, [goals]);

  const allExpanded = goals.length > 0 && goals.every((goal) => expanded[goal.id]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-stone-900">
            My Personal Development Plan
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            Track your goals, complete sub-goals, and grow your career with Altrium.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-amber-400 px-3 py-1 text-xs font-semibold text-stone-900">
            {pdp.status === "ASSIGNED" ? "Assigned PDP" : "Active PDP"}
          </span>
          <span className="text-sm text-stone-500">PDP Period: {periodLabel(pdp)}</span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          label="Main Goals"
          value={String(stats.mainGoals)}
          icon={<Target className="h-4 w-4 text-amber-700" />}
          tone="bg-amber-50"
        />
        <KpiCard
          label="Sub Goals"
          value={String(stats.subGoals)}
          icon={<ListChecks className="h-4 w-4 text-sky-700" />}
          tone="bg-sky-50"
        />
        <KpiCard
          label="Overall Progress"
          value={`${stats.overall}%`}
          icon={<Award className="h-4 w-4 text-emerald-700" />}
          tone="bg-emerald-50"
        />
        <KpiCard
          label="Sub Goals Due Soon"
          value={String(stats.dueSoon)}
          icon={<CalendarDays className="h-4 w-4 text-rose-700" />}
          tone="bg-rose-50"
        />
        <KpiCard
          label="Completed Goals"
          value={String(stats.completedMainGoals)}
          icon={<Award className="h-4 w-4 text-violet-700" />}
          tone="bg-violet-50"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-stone-900">Goals and Sub-goals</h2>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-50"
              onClick={() => {
                if (allExpanded) {
                  setExpanded({});
                  return;
                }
                const next: Record<string, boolean> = {};
                goals.forEach((goal) => {
                  next[goal.id] = true;
                });
                setExpanded(next);
              }}
            >
              {allExpanded ? "Collapse All" : "Expand All"}
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {goals.map((goal, index) => (
              <GoalPanel
                key={goal.id}
                goal={goal}
                index={index}
                expanded={Boolean(expanded[goal.id])}
                onToggle={() =>
                  setExpanded((prev) => ({ ...prev, [goal.id]: !prev[goal.id] }))
                }
              />
            ))}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-stone-200 bg-white p-4">
            <h3 className="font-semibold text-stone-900">Overall Progress</h3>
            <div className="mt-3">
              <Donut value={stats.overall} />
            </div>
            <p className="mt-2 text-center text-sm text-stone-500">
              {stats.completedSubs} / {stats.subGoals} sub-goals completed
            </p>
            <Button
              type="button"
              className="mt-4 w-full rounded-xl bg-stone-900 text-white hover:bg-stone-800"
              onClick={() => setDetailsOpen((value) => !value)}
            >
              <FileText className="mr-2 h-4 w-4" />
              View PDP Details
            </Button>
            {detailsOpen ? (
              <div className="mt-3 space-y-2 rounded-xl border border-stone-100 bg-stone-50 p-3 text-sm">
                <p>
                  <span className="text-stone-400">Title:</span> {pdp.title}
                </p>
                <p>
                  <span className="text-stone-400">Supervisor:</span> {pdp.supervisor?.name ?? "—"}
                </p>
                <p>
                  <span className="text-stone-400">Status:</span> {pdp.status}
                </p>
                <p className="text-stone-600">{pdp.summary || "No summary provided."}</p>
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-stone-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-stone-900">Upcoming Deadlines</h3>
              <span className="text-xs font-medium text-amber-700">View All</span>
            </div>
            <ul className="mt-3 space-y-3">
              {stats.upcoming.length === 0 ? (
                <li className="text-sm text-stone-500">No upcoming deadlines.</li>
              ) : (
                stats.upcoming.map((sub) => (
                  <li key={sub.id} className="flex gap-2 text-sm">
                    <span
                      className={cn(
                        "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                        subStatus(sub) === "IN_PROGRESS"
                          ? "bg-amber-400"
                          : subStatus(sub) === "NOT_STARTED"
                            ? "bg-stone-300"
                            : "bg-orange-400"
                      )}
                    />
                    <div>
                      <p className="font-medium text-stone-800">{sub.title}</p>
                      <p className="text-xs text-stone-400">
                        {sub.dueDate ? formatShortDate(sub.dueDate) : "—"}
                      </p>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </section>

          <section className="rounded-2xl border border-stone-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-stone-900">Recent Activity</h3>
              <span className="text-xs font-medium text-amber-700">View All</span>
            </div>
            <ul className="mt-3 space-y-3">
              {pdp.activities.length === 0 ? (
                <li className="text-sm text-stone-500">No recent activity yet.</li>
              ) : (
                pdp.activities.slice(0, 5).map((activity) => (
                  <li key={activity.id} className="flex gap-2 text-sm">
                    <Circle className="mt-1 h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                    <div>
                      <p className="text-stone-700">{activity.message}</p>
                      <p className="text-xs text-stone-400">{formatDateTime(activity.createdAt)}</p>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </section>

          <section className="rounded-2xl border border-stone-200 bg-white p-4">
            <h3 className="font-semibold text-stone-900">Need Help?</h3>
            <p className="mt-2 text-sm text-stone-500">
              Reach out to your Supervisor or HR if you need support with your development plan.
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-3 w-full rounded-xl border-stone-200 bg-white"
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              Message Supervisor
            </Button>
          </section>
        </aside>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-stone-400">{label}</p>
        <span className={cn("flex h-8 w-8 items-center justify-center rounded-xl", tone)}>{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold text-stone-900">{value}</p>
    </div>
  );
}
