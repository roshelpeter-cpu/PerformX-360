import { useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Circle,
  HelpCircle,
  Hourglass,
  Target,
  Users,
} from "lucide-react";
import DashboardLayout from "@/app/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  DashboardError,
  DashboardLoading,
} from "@/features/dashboard/components/DashboardUi";
import { formatDateTime, formatShortDate } from "@/features/hr/utils/dates";
import { useAuthStore } from "@/store/authStore";
import {
  useEmployeeApprovePdp,
  useEmployeeRequestPdpChanges,
  useActivatePdp,
  useMyPdp,
} from "../hooks/usePdp";
import { ApprovalBadge, PdpStatusBadge } from "../components/PdpStatusBadge";
import { EmployeeActivePdpDashboard } from "../components/EmployeeActivePdpDashboard";
import { AssignedPdpGate } from "../components/AssignedPdpGate";
import type { PdpDetail, PdpGoal } from "../services/pdp.api";
import {
  hasViewedAssignedPdp904,
  isActiveDashboardAccount,
  isAssignedGateAccount,
  isFrozenMyPdpAccount,
  markAssignedPdp904Viewed,
} from "../utils/demoPdpAccounts";
import { cn } from "@/lib/utils";

type TabKey = "overview" | "goals" | "feedback" | "versions" | "documents";

function Stepper({ pdp }: { pdp: PdpDetail }) {
  const bothApproved =
    pdp.employeeApproval?.status === "APPROVED" && pdp.hrApproval?.status === "APPROVED";
  const steps = [
    { label: "Created by Supervisor", done: true, active: false, meta: formatShortDate(pdp.createdAt) },
    {
      label: "Under Review",
      done: bothApproved || pdp.status === "ACTIVE",
      active:
        pdp.status === "PENDING_EMPLOYEE_REVIEW" ||
        pdp.status === "PENDING_HR_REVIEW" ||
        pdp.status === "PENDING_REAPPROVAL",
      meta: "Employee & HR",
    },
    {
      label: "Revisions (if any)",
      done: bothApproved || pdp.status === "ACTIVE",
      active: pdp.status.includes("CHANGES") || pdp.status.includes("SUPERVISOR") || pdp.status.includes("HR"),
      meta: "",
    },
    {
      label: "Both Approve",
      done: bothApproved || pdp.status === "ACTIVE",
      active: bothApproved && pdp.status !== "ACTIVE",
      meta: "",
    },
    {
      label: "Assigned to Employee",
      done: pdp.status === "ACTIVE",
      active: false,
      meta: "",
    },
  ];

  return (
    <div className="grid gap-3 rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-950 md:grid-cols-5">
      {steps.map((step, index) => (
        <div key={step.label} className="flex items-start gap-2">
          <span
            className={cn(
              "mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold",
              step.done
                ? "bg-emerald-600 text-white"
                : step.active
                  ? "bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-950"
                  : "bg-stone-100 text-stone-400"
            )}
          >
            {step.done ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
          </span>
          <div>
            <p className="text-sm font-medium">{step.label}</p>
            {step.meta ? <p className="text-xs text-stone-400">{step.meta}</p> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function GoalRow({ goal, index }: { goal: PdpGoal; index: number }) {
  return (
    <div className="rounded-xl border border-stone-100 p-4 dark:border-stone-800">
      <div className="flex gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-sm font-semibold text-amber-900">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Main Goal {index + 1}</p>
          <p className="font-medium">{goal.title}</p>
          <p className="mt-1 text-sm text-stone-600">{goal.objective}</p>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-stone-500">
            {goal.category ? (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-800">{goal.category}</span>
            ) : null}
            {goal.dueDate ? (
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" />
                {formatShortDate(goal.dueDate)}
              </span>
            ) : null}
            {goal.expectedOutcome ? (
              <span className="inline-flex items-center gap-1">
                <Target className="h-3.5 w-3.5" />
                {goal.expectedOutcome}
              </span>
            ) : null}
          </div>
          {goal.successCriteria ? (
            <p className="mt-2 text-xs text-stone-500">Success criteria: {goal.successCriteria}</p>
          ) : null}
        </div>
      </div>
      <div className="mt-3 space-y-2 border-t border-stone-100 pt-3 dark:border-stone-800">
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Sub-goals</p>
        {(goal.subGoals ?? []).map((sub, subIndex) => (
          <div key={sub.id} className="rounded-lg bg-stone-50 px-3 py-2 text-sm dark:bg-stone-900">
            <p className="font-medium">
              {subIndex + 1}. {sub.title}
            </p>
            <p className="text-stone-600">{sub.description || "—"}</p>
            <p className="mt-1 text-xs text-stone-400">
              Due: {sub.dueDate ? formatShortDate(sub.dueDate) : "—"} · Outcome: {sub.expectedOutcome || "—"} ·
              Criteria: {sub.successCriteria || "—"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MyPdpPage() {
  const query = useMyPdp(true);
  const approve = useEmployeeApprovePdp();
  const requestChanges = useEmployeeRequestPdpChanges();
  const activate = useActivatePdp();
  const employeeId = useAuthStore((state) => state.user?.employeeId);
  const [tab, setTab] = useState<TabKey>("overview");
  const [reason, setReason] = useState("");
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [viewedAssigned904, setViewedAssigned904] = useState(() => hasViewedAssignedPdp904());

  if (query.isLoading) {
    return (
      <DashboardLayout>
        <DashboardLoading />
      </DashboardLayout>
    );
  }
  if (query.isError) {
    return (
      <DashboardLayout>
        <DashboardError message="Unable to load your PDP." />
      </DashboardLayout>
    );
  }

  const pdp = query.data;
  if (!pdp) {
    return (
      <DashboardLayout>
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center dark:border-stone-700 dark:bg-stone-950">
          <h1 className="text-2xl font-semibold">My Performance Development Plan</h1>
          <p className="mt-2 text-sm text-stone-500">
            Your supervisor has not created a PDP for the active appraisal cycle yet.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  // Demo dashboards are allowlisted. EMP000001 / EMP000903 always keep the classic My PDP UI.
  const showActiveDashboard =
    !isFrozenMyPdpAccount(employeeId) &&
    isActiveDashboardAccount(employeeId) &&
    (pdp.status === "ACTIVE" || pdp.status === "ASSIGNED");

  const showAssignedGate =
    !isFrozenMyPdpAccount(employeeId) &&
    isAssignedGateAccount(employeeId) &&
    pdp.status === "ASSIGNED" &&
    !viewedAssigned904;

  const showAssignedDashboard =
    !isFrozenMyPdpAccount(employeeId) &&
    isAssignedGateAccount(employeeId) &&
    pdp.status === "ASSIGNED" &&
    viewedAssigned904;

  if (showActiveDashboard || showAssignedDashboard) {
    return (
      <DashboardLayout>
        <EmployeeActivePdpDashboard pdp={pdp} />
      </DashboardLayout>
    );
  }

  if (showAssignedGate) {
    return (
      <DashboardLayout>
        <AssignedPdpGate
          pdp={pdp}
          onViewAssigned={() => {
            markAssignedPdp904Viewed();
            setViewedAssigned904(true);
          }}
        />
      </DashboardLayout>
    );
  }

  const pendingYourApproval =
    pdp.permissions.canApproveAsEmployee || pdp.permissions.canRequestChangesAsEmployee;

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs text-stone-400">Home / My PDP</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">My Performance Development Plan</h1>
            <p className="mt-1 text-sm text-stone-500">
              Review your PDP, provide your feedback, and track its progress.
            </p>
          </div>
          <div className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm dark:border-stone-800 dark:bg-stone-950">
            Appraisal Cycle: {pdp.cycle.name}
          </div>
        </div>

        <Stepper pdp={pdp} />

        <div className="flex flex-wrap gap-2 border-b border-stone-200 pb-2 dark:border-stone-800">
          {(
            [
              ["overview", "PDP Overview"],
              ["goals", "Goals & Development Areas"],
              ["feedback", "Review & Feedback"],
              ["versions", "Version History"],
              ["documents", "Related Documents"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm",
                tab === key
                  ? "bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-950"
                  : "text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-900"
              )}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-5">
            {tab === "overview" || tab === "goals" ? (
              <>
                <section className="rounded-2xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-950">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="font-semibold">PDP Details</h2>
                    <PdpStatusBadge
                      status={
                        pendingYourApproval
                          ? "PENDING_EMPLOYEE_REVIEW"
                          : pdp.status === "ACTIVE"
                            ? "ACTIVE"
                            : pdp.status
                      }
                    />
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <Field label="PDP Title" value={pdp.title} />
                    <Field label="Created Date" value={formatShortDate(pdp.createdAt)} />
                    <Field label="Department" value={pdp.employee.department?.name ?? "—"} />
                    <Field label="Supervisor" value={pdp.supervisor?.name ?? "—"} />
                  </div>
                  <div className="mt-4">
                    <p className="text-xs uppercase tracking-wide text-stone-400">Development Summary</p>
                    <p className="mt-1 text-sm text-stone-700 dark:text-stone-200">
                      {pdp.summary || "No development summary provided yet."}
                    </p>
                  </div>
                </section>

                <section className="rounded-2xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-950">
                  <h2 className="font-semibold">Development Goals</h2>
                  <div className="mt-4 space-y-3">
                    {(pdp.currentVersion?.goals ?? []).length === 0 ? (
                      <p className="text-sm text-stone-500">No goals have been added yet.</p>
                    ) : (
                      (pdp.currentVersion?.goals ?? []).map((goal, index) => (
                        <GoalRow key={goal.id} goal={goal} index={index} />
                      ))
                    )}
                  </div>
                </section>
              </>
            ) : null}

            {tab === "feedback" ? (
              <section className="space-y-4 rounded-2xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-950">
                <h2 className="font-semibold">Review & Feedback</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-stone-100 p-3 dark:border-stone-800">
                    <p className="text-xs text-stone-400">Your approval</p>
                    <div className="mt-1">
                      <ApprovalBadge status={pdp.employeeApproval?.status} />
                    </div>
                    {pdp.employeeApproval?.comment ? (
                      <p className="mt-2 text-sm text-stone-600">{pdp.employeeApproval.comment}</p>
                    ) : null}
                  </div>
                  <div className="rounded-xl border border-stone-100 p-3 dark:border-stone-800">
                    <p className="text-xs text-stone-400">HR approval</p>
                    <div className="mt-1">
                      <ApprovalBadge status={pdp.hrApproval?.status} />
                    </div>
                    {pdp.hrApproval?.comment ? (
                      <p className="mt-2 text-sm text-stone-600">{pdp.hrApproval.comment}</p>
                    ) : null}
                  </div>
                </div>
                {pdp.changeRequests.map((request) => (
                  <div
                    key={request.id}
                    className="rounded-xl border border-stone-100 p-4 text-sm dark:border-stone-800"
                  >
                    <p className="font-medium">
                      {request.requesterRole} change request — {request.status}
                    </p>
                    <p className="mt-1 text-stone-600">{request.message}</p>
                    {request.supervisorResponse ? (
                      <p className="mt-2">
                        <span className="font-medium">Supervisor explanation:</span>{" "}
                        {request.supervisorResponse}
                      </p>
                    ) : null}
                    {request.hrDecisionNote ? (
                      <p className="mt-1">
                        <span className="font-medium">HR decision:</span> {request.hrDecisionNote}
                      </p>
                    ) : null}
                  </div>
                ))}
              </section>
            ) : null}

            {tab === "versions" ? (
              <section className="rounded-2xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-950">
                <h2 className="font-semibold">Version History</h2>
                <div className="mt-4 space-y-3">
                  {pdp.versions.map((version) => (
                    <div
                      key={version.id}
                      className="rounded-xl border border-stone-100 px-4 py-3 dark:border-stone-800"
                    >
                      <p className="font-medium">
                        Version {version.versionNumber}
                        {version.isCurrent ? " (Current)" : ""}
                      </p>
                      <p className="text-xs text-stone-400">
                        {formatDateTime(version.createdAt)} · {version.createdBy.name}
                      </p>
                      {version.revisionReason ? (
                        <p className="mt-1 text-sm text-stone-600">{version.revisionReason}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {tab === "documents" ? (
              <section className="rounded-2xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-950">
                <h2 className="font-semibold">Related Documents</h2>
                <p className="mt-2 text-sm text-stone-500">
                  Related appraisal and previous PDP documents are available from your Performance Planning
                  meeting details.
                </p>
              </section>
            ) : null}
          </div>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-950">
              <div className="flex items-center gap-2">
                <Hourglass className="h-4 w-4 text-amber-600" />
                <h3 className="font-semibold">Your Response</h3>
              </div>
              <div className="mt-2">
                <ApprovalBadge status={pdp.employeeApproval?.status ?? (pendingYourApproval ? "PENDING" : null)} />
              </div>
              {pendingYourApproval ? (
                <div className="mt-4 space-y-2">
                  <Button
                    type="button"
                    className="w-full"
                    disabled={approve.isPending}
                    onClick={() => void approve.mutateAsync(pdp.id)}
                  >
                    Accept PDP
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => setShowRequestForm((value) => !value)}
                  >
                    Request Changes
                  </Button>
                  {showRequestForm ? (
                    <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/30">
                      <p>A reason is required and will be sent to your supervisor.</p>
                      <textarea
                        className="min-h-24 w-full rounded-xl border border-stone-300 px-3 py-2 dark:border-stone-700 dark:bg-stone-900"
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        placeholder="Explain the change you need..."
                      />
                      <Button
                        type="button"
                        className="w-full"
                        disabled={!reason.trim() || requestChanges.isPending}
                        onClick={() =>
                          void requestChanges
                            .mutateAsync({ pdpId: pdp.id, reason: reason.trim() })
                            .then(() => {
                              setReason("");
                              setShowRequestForm(false);
                            })
                        }
                      >
                        Submit Change Request
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-stone-500">
                      Requesting changes requires a reason and sends the PDP back to your supervisor.
                    </p>
                  )}
                </div>
              ) : pdp.permissions.canActivate ? (
                <div className="mt-4 space-y-2">
                  <p className="text-sm text-stone-600">
                    Your supervisor has assigned this PDP. Activate it to make it your official active plan.
                  </p>
                  <Button
                    type="button"
                    className="w-full"
                    disabled={activate.isPending}
                    onClick={() => void activate.mutateAsync(pdp.id)}
                  >
                    Activate / Accept PDP
                  </Button>
                </div>
              ) : pdp.status === "ACTIVE" ? (
                <p className="mt-3 text-sm text-emerald-700">This is your active PDP for the current cycle.</p>
              ) : (
                <p className="mt-3 text-sm text-stone-500">No action required from you right now.</p>
              )}
            </section>

            <section className="rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-950">
              <div className="mb-3 flex items-center gap-2">
                <Users className="h-4 w-4" />
                <h3 className="font-semibold">Participants</h3>
              </div>
              <div className="space-y-2 text-sm">
                <p>
                  <span className="text-stone-400">Supervisor:</span> {pdp.supervisor?.name ?? "—"}
                </p>
                <p>
                  <span className="text-stone-400">HR in Charge:</span> {pdp.hr?.name ?? "—"}
                </p>
              </div>
            </section>

            <section className="rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-950">
              <div className="mb-2 flex items-center gap-2">
                <HelpCircle className="h-4 w-4" />
                <h3 className="font-semibold">Need Help?</h3>
              </div>
              <p className="text-sm text-stone-500">
                Contact your supervisor if you need clarification before approving this PDP.
              </p>
            </section>

            <section className="rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-950">
              <h3 className="font-semibold">Recent Activity</h3>
              <ul className="mt-3 space-y-3">
                {pdp.activities.slice(0, 8).map((activity) => (
                  <li key={activity.id} className="flex gap-2 text-sm">
                    <Circle className="mt-1 h-2.5 w-2.5 fill-stone-400 text-stone-400" />
                    <div>
                      <p>{activity.message}</p>
                      <p className="text-xs text-stone-400">{formatDateTime(activity.createdAt)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </aside>
        </div>
      </div>
    </DashboardLayout>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-stone-400">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}
