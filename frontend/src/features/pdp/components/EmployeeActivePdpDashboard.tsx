import { useEffect, useMemo, useState, type ReactNode } from "react";
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
  Plus,
  Target,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { formatDateTime, formatShortDate } from "@/features/hr/utils/dates";
import { cn } from "@/lib/utils";
import {
  useAddPdpGoal,
  useAddPdpSubGoal,
  useApproveSubGoal,
  useRequestSubGoalChanges,
  useUpdateSubGoal,
} from "../hooks/usePdp";
import type { PdpDetail, PdpGoal, PdpSubGoal, PdpSubGoalStatus } from "../services/pdp.api";
import { computePdpScoring, formatPdpPoints } from "../utils/pdpScoring";

const GOAL_ICONS = [Laptop, Users, Target, MessageSquare, Heart] as const;

type DashboardMode = "employee" | "supervisor";

type SelectedSub = {
  goal: PdpGoal;
  sub: PdpSubGoal;
};

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

function normalizeStatus(sub: PdpSubGoal): PdpSubGoalStatus {
  const status = sub.status;
  if (
    status === "COMPLETED" ||
    status === "IN_PROGRESS" ||
    status === "NOT_STARTED" ||
    status === "PENDING_APPROVAL" ||
    status === "CHANGES_REQUESTED"
  ) {
    return status;
  }
  return "NOT_STARTED";
}

function statusLabel(status: PdpSubGoalStatus) {
  if (status === "COMPLETED") return "Completed";
  if (status === "IN_PROGRESS") return "In Progress";
  if (status === "PENDING_APPROVAL") return "Pending Approval";
  if (status === "CHANGES_REQUESTED") return "Changes Requested";
  return "Not Started";
}

function StatusIcon({ status }: { status: PdpSubGoalStatus }) {
  if (status === "COMPLETED") {
    return <CheckCircle2 className="h-4 w-4 text-amber-500" />;
  }
  if (status === "PENDING_APPROVAL") {
    return <Circle className="h-4 w-4 text-sky-500" strokeWidth={2.5} />;
  }
  if (status === "CHANGES_REQUESTED") {
    return <Circle className="h-4 w-4 text-rose-500" strokeWidth={2.5} />;
  }
  if (status === "IN_PROGRESS") {
    return <Circle className="h-4 w-4 text-amber-400" strokeWidth={2.5} />;
  }
  return <Circle className="h-4 w-4 text-stone-300" strokeWidth={2.5} />;
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

function canUpdateStatus(status: PdpSubGoalStatus) {
  return (
    status === "NOT_STARTED" ||
    status === "IN_PROGRESS" ||
    status === "CHANGES_REQUESTED" ||
    status === "PENDING_APPROVAL"
  );
}

function canViewDetails(status: PdpSubGoalStatus, mode: DashboardMode) {
  if (status === "COMPLETED") return true;
  if (status === "PENDING_APPROVAL" && mode === "supervisor") return true;
  return false;
}

export function EmployeeActivePdpDashboard({
  pdp,
  mode = "employee",
  onPdpChange,
}: {
  pdp: PdpDetail;
  mode?: DashboardMode;
  onPdpChange?: (pdp: PdpDetail) => void;
}) {
  const goals = pdp.currentVersion?.goals ?? [];
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    goals[0] ? { [goals[0].id]: true } : {}
  );
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [viewTarget, setViewTarget] = useState<SelectedSub | null>(null);
  const [updateTarget, setUpdateTarget] = useState<SelectedSub | null>(null);
  const [approveTarget, setApproveTarget] = useState<SelectedSub | null>(null);
  const [changesTarget, setChangesTarget] = useState<SelectedSub | null>(null);
  const [addGoalOpen, setAddGoalOpen] = useState(false);
  const [addSubGoalTarget, setAddSubGoalTarget] = useState<PdpGoal | null>(null);

  const updateSubGoal = useUpdateSubGoal();
  const approveSubGoal = useApproveSubGoal();
  const requestChanges = useRequestSubGoalChanges();
  const addGoal = useAddPdpGoal();
  const addSubGoal = useAddPdpSubGoal();

  const scoringBreakdown = useMemo(
    () =>
      computePdpScoring(
        goals.map((goal) => ({
          id: goal.id,
          subGoals: (goal.subGoals ?? []).map((sub) => ({
            id: sub.id,
            status: normalizeStatus(sub),
          })),
        }))
      ),
    [goals]
  );

  const scoring = useMemo(() => {
    if (pdp.scoring) {
      return {
        ...scoringBreakdown,
        totalWeight: pdp.scoring.totalWeight,
        earnedPoints: pdp.scoring.earnedPoints,
        progressPercent: pdp.scoring.progressPercent,
        mainGoalCount: pdp.scoring.mainGoalCount,
      };
    }
    return scoringBreakdown;
  }, [pdp.scoring, scoringBreakdown]);

  const goalScoreById = useMemo(() => {
    const map = new Map(scoringBreakdown.goals.map((goal) => [goal.id, goal]));
    return map;
  }, [scoringBreakdown]);

  const stats = useMemo(() => {
    const allSubs = goals.flatMap((goal) => goal.subGoals ?? []);
    const completedSubs = allSubs.filter((sub) => normalizeStatus(sub) === "COMPLETED").length;
    const now = Date.now();
    const soonMs = 1000 * 60 * 60 * 24 * 45;
    const dueSoon = allSubs.filter((sub) => {
      if (!sub.dueDate || normalizeStatus(sub) === "COMPLETED") return false;
      const due = new Date(sub.dueDate).getTime();
      return due >= now && due - now <= soonMs;
    }).length;

    const completedMainGoals = goals.filter((goal) => {
      const scored = goalScoreById.get(goal.id);
      return scored ? scored.progressPercent >= 100 : false;
    }).length;

    const upcoming = allSubs
      .filter((sub) => sub.dueDate && normalizeStatus(sub) !== "COMPLETED")
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
      .slice(0, 3);

    return {
      mainGoals: goals.length,
      subGoals: allSubs.length,
      overall: scoring.progressPercent,
      earnedPoints: scoring.earnedPoints,
      completedSubs,
      dueSoon,
      completedMainGoals,
      upcoming,
    };
  }, [goals, goalScoreById, scoring.earnedPoints, scoring.progressPercent]);

  const allExpanded = goals.length > 0 && goals.every((goal) => expanded[goal.id]);

  const applyPdp = (next: PdpDetail) => {
    onPdpChange?.(next);
  };

  const title =
    mode === "supervisor"
      ? `${pdp.employee.name}'s Personal Development Plan`
      : "My Personal Development Plan";

  return (
    <div className="pdp-force-light space-y-5 text-stone-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-stone-900">{title}</h1>
          <p className="mt-1 text-sm text-stone-500">
            {mode === "supervisor"
              ? "Review progress, approve completed sub-goals, and support development follow-ups."
              : "Track your goals, complete sub-goals, and grow your career with Altrium."}
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
          label="Points Earned"
          value={`${formatPdpPoints(stats.earnedPoints)} / 100`}
          icon={<Award className="h-4 w-4 text-violet-700" />}
          tone="bg-violet-50"
        />
        <KpiCard
          label="Sub Goals Due Soon"
          value={String(stats.dueSoon)}
          icon={<CalendarDays className="h-4 w-4 text-rose-700" />}
          tone="bg-rose-50"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-stone-900">Goals and Sub-goals</h2>
            <div className="flex flex-wrap items-center gap-2">
              {mode === "supervisor" ? (
                <Button
                  type="button"
                  size="sm"
                  className="h-8 rounded-lg bg-amber-400 px-3 text-stone-900 hover:bg-amber-300"
                  onClick={() => setAddGoalOpen(true)}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add Goal
                </Button>
              ) : null}
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
          </div>

          <div className="space-y-3">
            {goals.map((goal, index) => {
              const goalScore = goalScoreById.get(goal.id);
              const weight = goal.scoreWeight ?? goalScore?.weight ?? 0;
              const earned = goal.scoreEarned ?? goalScore?.earned ?? 0;
              const approved =
                goal.approvedSubGoalCount ?? goalScore?.approvedCount ?? 0;
              const progress =
                goal.progressPercent ?? goalScore?.progressPercent ?? 0;
              const total = goal.subGoals?.length ?? 0;
              const Icon = GOAL_ICONS[index % GOAL_ICONS.length]!;

              return (
                <div
                  key={goal.id}
                  className="overflow-hidden rounded-2xl border border-stone-200 bg-white"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExpanded((prev) => ({ ...prev, [goal.id]: !prev[goal.id] }))
                    }
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
                          <p className="mt-1 text-xs font-medium text-amber-800">
                            Weight: {formatPdpPoints(weight)} pts · Approved: {approved} / {total} ·
                            Score: {formatPdpPoints(earned)} / {formatPdpPoints(weight)}
                          </p>
                        </div>
                        <ChevronDown
                          className={cn(
                            "mt-1 h-4 w-4 shrink-0 text-stone-400 transition-transform",
                            expanded[goal.id] && "rotate-180"
                          )}
                        />
                      </div>
                      <div className="mt-3 flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <ProgressBar value={progress} />
                        </div>
                        <p className="shrink-0 text-xs font-medium text-stone-500">
                          {progress}% · {approved} / {total} approved
                        </p>
                      </div>
                    </div>
                  </button>

                  {expanded[goal.id] ? (
                    <div className="border-t border-stone-100 px-4 pb-4">
                      {mode === "supervisor" ? (
                        <div className="mt-3 flex justify-end">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 rounded-lg"
                            onClick={() => setAddSubGoalTarget(goal)}
                          >
                            <Plus className="mr-1 h-3.5 w-3.5" />
                            Add Sub-goal
                          </Button>
                        </div>
                      ) : null}
                      <div className="overflow-x-auto">
                        <table className="mt-3 w-full min-w-[780px] text-left text-sm">
                          <thead>
                            <tr className="text-xs uppercase tracking-wide text-stone-400">
                              <th className="pb-2 pr-2 font-medium">#</th>
                              <th className="pb-2 pr-2 font-medium">Sub-goal</th>
                              <th className="pb-2 pr-2 font-medium">Weight</th>
                              <th className="pb-2 pr-2 font-medium">Status</th>
                              <th className="pb-2 pr-2 font-medium">Due Date</th>
                              <th className="pb-2 pr-2 font-medium">Evidence</th>
                              <th className="pb-2 pr-2 font-medium">Comments</th>
                              <th className="pb-2 font-medium">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(goal.subGoals ?? []).map((sub, subIndex) => {
                              const status = normalizeStatus(sub);
                              const evidence = sub.evidenceCount ?? sub.evidenceFiles?.length ?? 0;
                              const subScore = goalScore?.subGoals.find((item) => item.id === sub.id);
                              const subWeight = sub.scoreWeight ?? subScore?.weight ?? 0;
                              return (
                                <tr key={sub.id} className="border-t border-stone-50 align-top">
                                  <td className="py-3 pr-2 text-stone-400">
                                    {index + 1}.{subIndex + 1}
                                  </td>
                                  <td className="py-3 pr-2 font-medium text-stone-800">{sub.title}</td>
                                  <td className="py-3 pr-2 text-stone-600">
                                    {formatPdpPoints(subWeight)} pts
                                  </td>
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
                                  <td className="py-3 pr-2 text-stone-600">
                                    {sub.comment?.trim() || "—"}
                                  </td>
                                  <td className="py-3">
                                    <div className="flex flex-wrap gap-1.5">
                                      {canViewDetails(status, mode) ? (
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          className="h-8 rounded-lg px-3"
                                          onClick={() => setViewTarget({ goal, sub })}
                                        >
                                          View
                                        </Button>
                                      ) : null}
                                      {mode === "employee" && canUpdateStatus(status) ? (
                                        <Button
                                          type="button"
                                          size="sm"
                                          className="h-8 rounded-lg bg-amber-400 px-3 text-stone-900 hover:bg-amber-300"
                                          onClick={() => setUpdateTarget({ goal, sub })}
                                        >
                                          Update
                                        </Button>
                                      ) : null}
                                      {mode === "supervisor" && status === "PENDING_APPROVAL" ? (
                                        <>
                                          <Button
                                            type="button"
                                            size="sm"
                                            className="h-8 rounded-lg bg-emerald-600 px-3 text-white hover:bg-emerald-500"
                                            onClick={() => setApproveTarget({ goal, sub })}
                                          >
                                            Approve
                                          </Button>
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            className="h-8 rounded-lg border-rose-200 text-rose-700 hover:bg-rose-50"
                                            onClick={() => setChangesTarget({ goal, sub })}
                                          >
                                            Request Changes
                                          </Button>
                                        </>
                                      ) : null}
                                    </div>
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
            })}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-stone-200 bg-white p-4">
            <h3 className="font-semibold text-stone-900">Overall Progress</h3>
            <div className="mt-3">
              <Donut value={stats.overall} />
            </div>
            <p className="mt-2 text-center text-sm text-stone-500">
              {formatPdpPoints(stats.earnedPoints)} / 100 pts · {stats.completedSubs} /{" "}
              {stats.subGoals} approved
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
                  <span className="text-stone-400">Employee:</span> {pdp.employee.name}
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
                        normalizeStatus(sub) === "IN_PROGRESS"
                          ? "bg-amber-400"
                          : normalizeStatus(sub) === "NOT_STARTED"
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

      <ViewSubGoalDialog
        open={Boolean(viewTarget)}
        pdp={pdp}
        target={viewTarget}
        onClose={() => setViewTarget(null)}
      />

      <UpdateSubGoalDialog
        open={Boolean(updateTarget)}
        pdpId={pdp.id}
        target={updateTarget}
        pending={updateSubGoal.isPending}
        onClose={() => setUpdateTarget(null)}
        onSubmit={async (payload) => {
          const next = await updateSubGoal.mutateAsync(payload);
          applyPdp(next);
          setUpdateTarget(null);
        }}
      />

      <ApproveSubGoalDialog
        open={Boolean(approveTarget)}
        target={approveTarget}
        pending={approveSubGoal.isPending}
        onClose={() => setApproveTarget(null)}
        onSubmit={async (comment) => {
          if (!approveTarget) return;
          const next = await approveSubGoal.mutateAsync({
            pdpId: pdp.id,
            subGoalId: approveTarget.sub.id,
            comment,
          });
          applyPdp(next);
          setApproveTarget(null);
        }}
      />

      <RequestChangesDialog
        open={Boolean(changesTarget)}
        target={changesTarget}
        pending={requestChanges.isPending}
        onClose={() => setChangesTarget(null)}
        onSubmit={async (reason) => {
          if (!changesTarget) return;
          const next = await requestChanges.mutateAsync({
            pdpId: pdp.id,
            subGoalId: changesTarget.sub.id,
            reason,
          });
          applyPdp(next);
          setChangesTarget(null);
        }}
      />

      <AddGoalDialog
        open={addGoalOpen}
        pending={addGoal.isPending}
        onClose={() => setAddGoalOpen(false)}
        onSubmit={async (body) => {
          const next = await addGoal.mutateAsync({ pdpId: pdp.id, ...body });
          applyPdp(next);
          setAddGoalOpen(false);
        }}
      />

      <AddSubGoalDialog
        open={Boolean(addSubGoalTarget)}
        goal={addSubGoalTarget}
        pending={addSubGoal.isPending}
        onClose={() => setAddSubGoalTarget(null)}
        onSubmit={async (body) => {
          if (!addSubGoalTarget) return;
          const next = await addSubGoal.mutateAsync({
            pdpId: pdp.id,
            goalId: addSubGoalTarget.id,
            ...body,
          });
          applyPdp(next);
          setAddSubGoalTarget(null);
        }}
      />
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

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[140px_minmax(0,1fr)]">
      <p className="text-xs uppercase tracking-wide text-stone-400">{label}</p>
      <div className="text-sm text-stone-800">{value}</div>
    </div>
  );
}

function ViewSubGoalDialog({
  open,
  pdp,
  target,
  onClose,
}: {
  open: boolean;
  pdp: PdpDetail;
  target: SelectedSub | null;
  onClose: () => void;
}) {
  if (!target) return null;
  const status = normalizeStatus(target.sub);
  const weight = target.sub.scoreWeight ?? 0;
  const earned = target.sub.scoreEarned ?? (status === "COMPLETED" ? weight : 0);
  const files = target.sub.evidenceFiles ?? [];
  const related = pdp.activities.filter((activity) => {
    const message = activity.message.toLowerCase();
    return (
      message.includes(target.sub.title.toLowerCase()) ||
      message.includes(target.goal.title.toLowerCase())
    );
  });

  return (
    <Dialog
      open={open}
      title="Sub-goal Details"
      description="Review completion details, evidence, and related activity."
      onClose={onClose}
      className="max-w-2xl"
    >
      <div className="space-y-3">
        <DetailRow label="Main goal" value={target.goal.title} />
        <DetailRow label="Sub-goal" value={target.sub.title} />
        <DetailRow label="Description" value={target.sub.description || "—"} />
        <DetailRow label="Status" value={statusLabel(status)} />
        <DetailRow
          label="Due date"
          value={target.sub.dueDate ? formatShortDate(target.sub.dueDate) : "—"}
        />
        <DetailRow
          label="Completed at"
          value={target.sub.completedAt ? formatDateTime(target.sub.completedAt) : "—"}
        />
        <DetailRow
          label="Approved at"
          value={target.sub.approvedAt ? formatDateTime(target.sub.approvedAt) : "—"}
        />
        <DetailRow
          label="Score"
          value={`${formatPdpPoints(earned)} / ${formatPdpPoints(weight)} pts`}
        />
        <DetailRow label="Employee comment" value={target.sub.comment?.trim() || "—"} />
        <DetailRow
          label="Supervisor comment"
          value={target.sub.supervisorComment?.trim() || "—"}
        />
        <div>
          <p className="text-xs uppercase tracking-wide text-stone-400">Evidence files</p>
          {files.length === 0 ? (
            <p className="mt-1 text-sm text-stone-600">No evidence uploaded.</p>
          ) : (
            <ul className="mt-1 space-y-1 text-sm text-stone-700">
              {files.map((file) => (
                <li key={file.storedName} className="rounded-lg border border-stone-100 bg-stone-50 px-3 py-2">
                  <p className="font-medium">{file.fileName}</p>
                  <p className="text-xs text-stone-400">
                    {file.uploadedAt ? formatDateTime(file.uploadedAt) : "—"}
                    {file.size != null ? ` · ${Math.round(file.size / 1024)} KB` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-stone-400">Related activities</p>
          {related.length === 0 ? (
            <p className="mt-1 text-sm text-stone-600">No related activity found.</p>
          ) : (
            <ul className="mt-1 space-y-2">
              {related.slice(0, 8).map((activity) => (
                <li key={activity.id} className="rounded-lg border border-stone-100 bg-stone-50 px-3 py-2 text-sm">
                  <p className="text-stone-700">{activity.message}</p>
                  <p className="text-xs text-stone-400">{formatDateTime(activity.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Dialog>
  );
}

function UpdateSubGoalDialog({
  open,
  pdpId,
  target,
  pending,
  onClose,
  onSubmit,
}: {
  open: boolean;
  pdpId: string;
  target: SelectedSub | null;
  pending: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    pdpId: string;
    subGoalId: string;
    status?: string;
    comment?: string | null;
    markComplete?: boolean;
    file?: File | null;
  }) => Promise<void>;
}) {
  const [status, setStatus] = useState("IN_PROGRESS");
  const [comment, setComment] = useState("");
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (!target) return;
    const currentStatus = normalizeStatus(target.sub);
    setStatus(
      currentStatus === "PENDING_APPROVAL" ||
        currentStatus === "CHANGES_REQUESTED" ||
        currentStatus === "NOT_STARTED"
        ? "IN_PROGRESS"
        : currentStatus
    );
    setComment(target.sub.comment ?? "");
    setFile(null);
  }, [target]);

  if (!target) return null;

  const markComplete = status === "COMPLETED";

  return (
    <Dialog
      open={open}
      title="Update Sub-goal"
      description={`${target.goal.title} → ${target.sub.title}`}
      onClose={onClose}
    >
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit({
            pdpId,
            subGoalId: target.sub.id,
            status: markComplete ? undefined : status,
            comment: comment.trim() || null,
            markComplete: markComplete || undefined,
            file,
          });
        }}
      >
        <div>
          <label className="text-xs font-medium uppercase tracking-wide text-stone-400">
            Status
          </label>
          <select
            className="mt-1 h-10 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-800"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="NOT_STARTED">Not Started</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed (submit for approval)</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium uppercase tracking-wide text-stone-400">
            Comment
          </label>
          <textarea
            className="mt-1 min-h-24 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Describe progress or attach context for your supervisor..."
          />
        </div>
        <div>
          <label className="text-xs font-medium uppercase tracking-wide text-stone-400">
            Evidence file
          </label>
          <input
            type="file"
            className="mt-1 block w-full text-sm text-stone-600"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </div>
        {markComplete ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Completing this sub-goal will send it for supervisor approval. Points are only awarded
            after approval.
          </p>
        ) : null}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={pending}
            className="bg-amber-400 text-stone-900 hover:bg-amber-300"
          >
            {markComplete ? "Submit for Approval" : pending ? "Saving..." : "Save Update"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function ApproveSubGoalDialog({
  open,
  target,
  pending,
  onClose,
  onSubmit,
}: {
  open: boolean;
  target: SelectedSub | null;
  pending: boolean;
  onClose: () => void;
  onSubmit: (comment: string | null) => Promise<void>;
}) {
  const [comment, setComment] = useState("");

  useEffect(() => {
    setComment("");
  }, [target?.sub.id]);

  if (!target) return null;

  return (
    <Dialog
      open={open}
      title="Approve Sub-goal"
      description={`${target.goal.title} → ${target.sub.title}`}
      onClose={onClose}
    >
      <div className="space-y-3">
        <p className="text-sm text-stone-600">
          Approving marks this sub-goal as completed and awards its score weight.
        </p>
        <textarea
          className="min-h-20 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="Optional supervisor comment..."
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={pending}
            className="bg-emerald-600 text-white hover:bg-emerald-500"
            onClick={() => void onSubmit(comment.trim() || null)}
          >
            {pending ? "Approving..." : "Approve"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function RequestChangesDialog({
  open,
  target,
  pending,
  onClose,
  onSubmit,
}: {
  open: boolean;
  target: SelectedSub | null;
  pending: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    setReason("");
  }, [target?.sub.id]);

  if (!target) return null;

  return (
    <Dialog
      open={open}
      title="Request Changes"
      description={`${target.goal.title} → ${target.sub.title}`}
      onClose={onClose}
    >
      <div className="space-y-3">
        <textarea
          className="min-h-24 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Explain what the employee should revise..."
          required
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!reason.trim() || pending}
            className="bg-rose-600 text-white hover:bg-rose-500"
            onClick={() => void onSubmit(reason.trim())}
          >
            {pending ? "Sending..." : "Request Changes"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function AddGoalDialog({
  open,
  pending,
  onClose,
  onSubmit,
}: {
  open: boolean;
  pending: boolean;
  onClose: () => void;
  onSubmit: (body: { title: string; objective?: string; category?: string }) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [objective, setObjective] = useState("");
  const [category, setCategory] = useState("");

  return (
    <Dialog open={open} title="Add Development Goal" onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit({
            title: title.trim(),
            objective: objective.trim() || undefined,
            category: category.trim() || undefined,
          }).then(() => {
            setTitle("");
            setObjective("");
            setCategory("");
          });
        }}
      >
        <input
          className="h-10 w-full rounded-xl border border-stone-200 px-3 text-sm"
          placeholder="Goal title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
        />
        <textarea
          className="min-h-20 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
          placeholder="Objective (optional)"
          value={objective}
          onChange={(event) => setObjective(event.target.value)}
        />
        <input
          className="h-10 w-full rounded-xl border border-stone-200 px-3 text-sm"
          placeholder="Category (optional)"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!title.trim() || pending}
            className="bg-amber-400 text-stone-900 hover:bg-amber-300"
          >
            {pending ? "Adding..." : "Add Goal"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function AddSubGoalDialog({
  open,
  goal,
  pending,
  onClose,
  onSubmit,
}: {
  open: boolean;
  goal: PdpGoal | null;
  pending: boolean;
  onClose: () => void;
  onSubmit: (body: {
    title: string;
    description?: string;
    dueDate?: string | null;
  }) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  if (!goal) return null;

  return (
    <Dialog
      open={open}
      title="Add Sub-goal"
      description={`Under: ${goal.title}`}
      onClose={onClose}
    >
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit({
            title: title.trim(),
            description: description.trim() || undefined,
            dueDate: dueDate || null,
          }).then(() => {
            setTitle("");
            setDescription("");
            setDueDate("");
          });
        }}
      >
        <input
          className="h-10 w-full rounded-xl border border-stone-200 px-3 text-sm"
          placeholder="Sub-goal title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
        />
        <textarea
          className="min-h-20 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
          placeholder="Description (optional)"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        <input
          type="date"
          className="h-10 w-full rounded-xl border border-stone-200 px-3 text-sm"
          value={dueDate}
          onChange={(event) => setDueDate(event.target.value)}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!title.trim() || pending}
            className="bg-amber-400 text-stone-900 hover:bg-amber-300"
          >
            {pending ? "Adding..." : "Add Sub-goal"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
