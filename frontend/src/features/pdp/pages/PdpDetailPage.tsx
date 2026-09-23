import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  CheckCircle2,
  Circle,
  MessageSquare,
} from "lucide-react";
import DashboardLayout from "@/app/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  DashboardError,
  DashboardLoading,
} from "@/features/dashboard/components/DashboardUi";
import { formatDateTime, formatShortDate } from "@/features/hr/utils/dates";
import { useAuthStore } from "@/store/authStore";
import { getPdpPathForRole, getPipPathForRole } from "@/constants/roles";
import type { UserRole } from "@/features/auth/types";
import {
  useAssignPdp,
  useHrApprovePdp,
  useHrPdpDecision,
  useHrRequestPdpChanges,
  usePdp,
  useSendPdpForApproval,
  useSupervisorCannotChange,
  useUpdatePdp,
} from "../hooks/usePdp";
import { ApprovalBadge, PdpStatusBadge, formatPdpStatus } from "../components/PdpStatusBadge";
import type { GoalInput, PdpDetail } from "../services/pdp.api";
import { GoalEditor } from "../components/GoalEditor";
import { EmployeeActivePdpDashboard } from "../components/EmployeeActivePdpDashboard";
import { goalsFromApi } from "../utils/goalDefaults";
import { cn } from "@/lib/utils";
import { isHrStaffRole } from "@/constants/roles";

type TabKey = "details" | "review" | "changes" | "versions";

function Stepper({ pdp }: { pdp: PdpDetail }) {
  const bothApproved =
    pdp.employeeApproval?.status === "APPROVED" && pdp.hrApproval?.status === "APPROVED";
  const isDraft = pdp.status === "DRAFT";
  const createdDone = !isDraft;
  const steps = [
    {
      label: "PDP Created",
      done: createdDone,
      pending: isDraft,
      active: isDraft,
      meta: formatShortDate(pdp.createdAt),
    },
    {
      label: "Under Review",
      done: bothApproved || pdp.status === "ACTIVE" || pdp.status === "ASSIGNED" || pdp.status === "APPROVED",
      pending: false,
      active:
        pdp.status === "PENDING_EMPLOYEE_REVIEW" ||
        pdp.status === "PENDING_HR_REVIEW" ||
        pdp.status === "PENDING_REAPPROVAL",
      meta: "Employee & HR",
    },
    {
      label: "Revisions (if any)",
      done: bothApproved || pdp.status === "ACTIVE" || pdp.status === "ASSIGNED",
      pending: false,
      active:
        pdp.status.includes("CHANGES") ||
        pdp.status.includes("SUPERVISOR") ||
        pdp.status.includes("HR_DECISION") ||
        pdp.status.includes("INTERVENTION"),
      meta: "",
    },
    {
      label: "Both Approve",
      done: bothApproved || pdp.status === "ACTIVE" || pdp.status === "ASSIGNED",
      pending: false,
      active: bothApproved && pdp.status === "APPROVED",
      meta: "",
    },
    {
      label: "Assign to Employee",
      done: pdp.status === "ACTIVE" || pdp.status === "ASSIGNED",
      pending: false,
      active: pdp.status === "APPROVED",
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
                : step.pending || step.active
                  ? "bg-amber-500 text-white"
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

export default function PdpDetailPage() {
  const { pdpId } = useParams<{ pdpId: string }>();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const role = user?.role as UserRole;
  const query = usePdp(pdpId ?? null);
  const updatePdp = useUpdatePdp();
  const sendForApproval = useSendPdpForApproval();
  const assignPdp = useAssignPdp();
  const hrApprove = useHrApprovePdp();
  const hrRequest = useHrRequestPdpChanges();
  const cannotChange = useSupervisorCannotChange();
  const hrDecision = useHrPdpDecision();

  const pdp = query.data;
  const [tab, setTab] = useState<TabKey>("details");
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [goals, setGoals] = useState<GoalInput[]>([]);
  const [changeReason, setChangeReason] = useState("");
  const [escalateReason, setEscalateReason] = useState("");
  const [hrNote, setHrNote] = useState("");
  const [selectedChangeId, setSelectedChangeId] = useState<string | null>(null);

  useEffect(() => {
    if (!pdp) return;
    setTitle(pdp.title);
    setSummary(pdp.summary ?? "");
    setGoals(goalsFromApi(pdp.currentVersion?.goals ?? []));
    if (pdp.permissions.canEdit && pdp.status === "DRAFT") setEditing(true);
  }, [pdp]);

  const openChange = useMemo(
    () =>
      pdp?.changeRequests.find(
        (item) =>
          item.status === "OPEN" ||
          item.status === "SUPERVISOR_CANNOT_CHANGE" ||
          item.status === "HR_REQUIRES_CHANGE"
      ) ?? null,
    [pdp]
  );

  if (query.isLoading) {
    return (
      <DashboardLayout>
        <DashboardLoading />
      </DashboardLayout>
    );
  }
  if (query.isError || !pdp) {
    return (
      <DashboardLayout>
        <DashboardError message="Unable to load this PDP." />
      </DashboardLayout>
    );
  }

  const isPipRoute = location.pathname.includes("/pip");
  const basePath = isPipRoute ? getPipPathForRole(role) : getPdpPathForRole(role);
  const isLiveEvaluationStatus = pdp.status === "ACTIVE" || pdp.status === "ASSIGNED";
  const showHrLiveView = isHrStaffRole(role) && isLiveEvaluationStatus;

  if (showHrLiveView) {
    return (
      <DashboardLayout>
        <div className="mb-4 space-y-2">
          <p className="text-xs text-stone-400">
            <Link to={basePath} className="hover:underline">
              {isPipRoute ? "PIP Management" : "PDP Management"}
            </Link>{" "}
            / {pdp.employee.name}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-stone-300 bg-stone-50 px-3 py-1 text-xs font-semibold text-stone-700">
              HR Review — View Only
            </span>
            <PdpStatusBadge status={pdp.status} />
          </div>
        </div>
        <EmployeeActivePdpDashboard pdp={pdp} mode="hr" />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs text-stone-400">
              <Link to={basePath} className="hover:underline">
                {isPipRoute ? "PIP Management" : "PDP Management"}
              </Link>{" "}
              / {pdp.employee.name}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight">
                {isPipRoute ? "PIP" : "PDP"} — {pdp.employee.name}
              </h1>
              <PdpStatusBadge status={pdp.status} />
            </div>
            <p className="mt-2 text-sm text-stone-500">
              {pdp.employee.employeeId} · {pdp.employee.department?.name ?? "—"} · Supervisor:{" "}
              {pdp.supervisor?.name ?? "—"} · HR: {pdp.hr?.name ?? "—"}
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
              ["details", "PDP Details"],
              ["review", "Review & Approval"],
              ["changes", "Change Requests"],
              ["versions", "Version History"],
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
          <div className="ml-auto flex flex-wrap gap-2">
            {pdp.permissions.canEdit ? (
              <Button type="button" variant="outline" onClick={() => setEditing((value) => !value)}>
                {editing ? "Stop editing" : "Edit PDP"}
              </Button>
            ) : null}
            {pdp.permissions.canSendForApproval ? (
              <Button
                type="button"
                disabled={sendForApproval.isPending}
                onClick={() => void sendForApproval.mutateAsync(pdp.id)}
              >
                Send for Approval
              </Button>
            ) : null}
            {pdp.permissions.canAssign ? (
              <Button
                type="button"
                disabled={assignPdp.isPending}
                onClick={() => void assignPdp.mutateAsync(pdp.id)}
              >
                Assign PDP
              </Button>
            ) : null}
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-5">
            {tab === "details" ? (
              <>
                <section className="rounded-2xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-950">
                  <h2 className="font-semibold">PDP Information</h2>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm">
                      PDP Title
                      <input
                        className="mt-1 h-10 w-full rounded-xl border border-stone-300 px-3 dark:border-stone-700 dark:bg-stone-900"
                        value={title}
                        disabled={!editing}
                        onChange={(event) => setTitle(event.target.value)}
                      />
                    </label>
                    <Info label="Created Date" value={formatShortDate(pdp.createdAt)} />
                    <Info label="Last Updated" value={formatShortDate(pdp.updatedAt)} />
                    <Info label="Created By" value={`${pdp.createdBy.name} (Supervisor)`} />
                  </div>
                  <label className="mt-4 block text-sm">
                    Development Summary
                    <textarea
                      className="mt-1 min-h-28 w-full rounded-xl border border-stone-300 px-3 py-2 dark:border-stone-700 dark:bg-stone-900"
                      value={summary}
                      disabled={!editing}
                      onChange={(event) => setSummary(event.target.value)}
                    />
                  </label>
                </section>

                <section className="rounded-2xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-950">
                  <h2 className="mb-4 font-semibold">PDP Goals</h2>
                  <GoalEditor goals={goals} onChange={setGoals} editable={editing} />
                  {editing ? (
                    <div className="mt-4 flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={updatePdp.isPending}
                        onClick={() =>
                          void updatePdp.mutateAsync({
                            pdpId: pdp.id,
                            body: { title, summary, goals },
                          })
                        }
                      >
                        Save as Draft
                      </Button>
                      {pdp.permissions.canSendForApproval ? (
                        <Button
                          type="button"
                          disabled={updatePdp.isPending || sendForApproval.isPending}
                          onClick={() =>
                            void updatePdp
                              .mutateAsync({ pdpId: pdp.id, body: { title, summary, goals } })
                              .then(() => sendForApproval.mutateAsync(pdp.id))
                          }
                        >
                          Send for Approval
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </section>
              </>
            ) : null}

            {tab === "review" ? (
              <section className="rounded-2xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-950">
                <h2 className="font-semibold">Review Feedback</h2>
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="text-xs uppercase text-stone-400">
                      <tr>
                        <th className="px-2 py-2">Reviewer</th>
                        <th className="px-2 py-2">Response</th>
                        <th className="px-2 py-2">Comment</th>
                        <th className="px-2 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[pdp.employeeApproval, pdp.hrApproval].filter(Boolean).map((approval) => (
                        <tr key={approval!.id} className="border-t border-stone-100 dark:border-stone-800">
                          <td className="px-2 py-3">
                            {approval!.reviewerRole === "EMPLOYEE" ? "Employee" : "HR"} —{" "}
                            {approval!.reviewer.name}
                          </td>
                          <td className="px-2 py-3">
                            <ApprovalBadge status={approval!.status} />
                          </td>
                          <td className="px-2 py-3 text-stone-600">{approval!.comment || "—"}</td>
                          <td className="px-2 py-3">
                            {approval!.status === "CHANGES_REQUESTED"
                              ? "Action Required"
                              : formatPdpStatus(approval!.status)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {(pdp.permissions.canApproveAsHr || pdp.permissions.canRequestChangesAsHr) && (
                  <div className="mt-5 space-y-3 rounded-xl border border-stone-100 p-4 dark:border-stone-800">
                    <h3 className="font-medium">HR Response</h3>
                    <textarea
                      className="min-h-24 w-full rounded-xl border border-stone-300 px-3 py-2 dark:border-stone-700 dark:bg-stone-900"
                      placeholder="Required when requesting changes"
                      value={changeReason}
                      onChange={(event) => setChangeReason(event.target.value)}
                    />
                    <div className="flex flex-wrap gap-2">
                      {pdp.permissions.canApproveAsHr ? (
                        <Button
                          type="button"
                          disabled={hrApprove.isPending}
                          onClick={() => void hrApprove.mutateAsync(pdp.id)}
                        >
                          Approve
                        </Button>
                      ) : null}
                      {pdp.permissions.canRequestChangesAsHr ? (
                        <Button
                          type="button"
                          variant="outline"
                          disabled={!changeReason.trim() || hrRequest.isPending}
                          onClick={() =>
                            void hrRequest.mutateAsync({ pdpId: pdp.id, reason: changeReason.trim() })
                          }
                        >
                          Request Changes
                        </Button>
                      ) : null}
                    </div>
                  </div>
                )}
              </section>
            ) : null}

            {tab === "changes" ? (
              <section className="space-y-4 rounded-2xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-950">
                <h2 className="font-semibold">Change Requests</h2>
                {pdp.changeRequests.length === 0 ? (
                  <p className="text-sm text-stone-500">No change requests yet.</p>
                ) : (
                  pdp.changeRequests.map((request) => (
                    <div
                      key={request.id}
                      className="rounded-xl border border-stone-100 p-4 dark:border-stone-800"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium">
                          {request.requesterRole} — {request.requestedBy.name}
                        </p>
                        <PdpStatusBadge status={request.status} />
                      </div>
                      <p className="mt-2 text-sm text-stone-600">{request.message}</p>
                      {request.supervisorResponse ? (
                        <p className="mt-2 text-sm">
                          <span className="font-medium">Supervisor:</span> {request.supervisorResponse}
                        </p>
                      ) : null}
                      {request.hrDecisionNote ? (
                        <p className="mt-1 text-sm">
                          <span className="font-medium">HR decision:</span> {request.hrDecisionNote}
                        </p>
                      ) : null}

                      {pdp.permissions.canEscalate &&
                      (request.status === "OPEN" || request.status === "HR_REQUIRES_CHANGE") ? (
                        <div className="mt-3 space-y-2">
                          <textarea
                            className="min-h-20 w-full rounded-xl border border-stone-300 px-3 py-2 dark:border-stone-700 dark:bg-stone-900"
                            placeholder="Reason why this change cannot be made (required)"
                            value={selectedChangeId === request.id ? escalateReason : ""}
                            onFocus={() => setSelectedChangeId(request.id)}
                            onChange={(event) => {
                              setSelectedChangeId(request.id);
                              setEscalateReason(event.target.value);
                            }}
                          />
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                setEditing(true);
                                setTab("details");
                              }}
                            >
                              Make the Change
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              disabled={
                                selectedChangeId !== request.id ||
                                !escalateReason.trim() ||
                                cannotChange.isPending
                              }
                              onClick={() =>
                                void cannotChange.mutateAsync({
                                  pdpId: pdp.id,
                                  changeRequestId: request.id,
                                  reason: escalateReason.trim(),
                                })
                              }
                            >
                              Cannot Make Requested Change
                            </Button>
                          </div>
                        </div>
                      ) : null}

                      {pdp.permissions.canDecideAsHr &&
                      request.status === "SUPERVISOR_CANNOT_CHANGE" ? (
                        <div className="mt-3 space-y-2">
                          <textarea
                            className="min-h-20 w-full rounded-xl border border-stone-300 px-3 py-2 dark:border-stone-700 dark:bg-stone-900"
                            placeholder="HR decision note (required for Change Not Required)"
                            value={selectedChangeId === request.id ? hrNote : ""}
                            onFocus={() => setSelectedChangeId(request.id)}
                            onChange={(event) => {
                              setSelectedChangeId(request.id);
                              setHrNote(event.target.value);
                            }}
                          />
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              disabled={hrDecision.isPending}
                              onClick={() =>
                                void hrDecision.mutateAsync({
                                  pdpId: pdp.id,
                                  changeRequestId: request.id,
                                  decision: "CHANGE_MUST_HAPPEN",
                                  note: hrNote.trim() || "Change must be made as requested.",
                                })
                              }
                            >
                              Change Must Happen
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              disabled={!hrNote.trim() || hrDecision.isPending}
                              onClick={() =>
                                void hrDecision.mutateAsync({
                                  pdpId: pdp.id,
                                  changeRequestId: request.id,
                                  decision: "CHANGE_NOT_REQUIRED",
                                  note: hrNote.trim(),
                                })
                              }
                            >
                              Change Not Required
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ))
                )}
              </section>
            ) : null}

            {tab === "versions" ? (
              <section className="rounded-2xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-950">
                <h2 className="font-semibold">Version History</h2>
                <div className="mt-4 space-y-3">
                  {pdp.versions.map((version) => (
                    <div
                      key={version.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-stone-100 px-4 py-3 dark:border-stone-800"
                    >
                      <div>
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
                      <PdpStatusBadge status={version.isCurrent ? pdp.status : "COMPLETED"} />
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </div>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-950">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Approval Status</h3>
                <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-800">
                  {openChange ? "Action required" : "Awaiting Responses"}
                </span>
              </div>
              <div className="mt-3 space-y-3">
                <ApprovalRow
                  name={pdp.employee.name}
                  role="Employee"
                  status={pdp.employeeApproval?.status}
                  comment={pdp.employeeApproval?.comment}
                />
                <ApprovalRow
                  name={pdp.hr?.name ?? "HR"}
                  role="HR in Charge"
                  status={pdp.hrApproval?.status}
                  comment={pdp.hrApproval?.comment}
                />
              </div>
            </section>

            <section className="rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-950">
              <h3 className="font-semibold">Recent Activity</h3>
              <ul className="mt-3 space-y-3">
                {pdp.activities.slice(0, 8).map((activity) => (
                  <li key={activity.id} className="flex gap-2 text-sm">
                    <Circle className="mt-1 h-2.5 w-2.5 fill-stone-400 text-stone-400" />
                    <div>
                      <p>{activity.message}</p>
                      <p className="text-xs text-stone-400">
                        {activity.actor.name} · {formatDateTime(activity.createdAt)}
                      </p>
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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-stone-400">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}

function ApprovalRow({
  name,
  role,
  status,
  comment,
}: {
  name: string;
  role: string;
  status?: string | null;
  comment?: string | null;
}) {
  return (
    <div className="rounded-xl border border-stone-100 p-3 dark:border-stone-800">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{name}</p>
          <p className="text-xs text-stone-400">{role}</p>
        </div>
        <ApprovalBadge status={status} />
      </div>
      {comment ? (
        <p className="mt-2 flex gap-1 text-xs text-stone-500">
          <MessageSquare className="h-3.5 w-3.5 shrink-0" />
          {comment}
        </p>
      ) : null}
    </div>
  );
}
