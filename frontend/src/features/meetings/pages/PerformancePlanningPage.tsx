import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Clock3,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import DashboardLayout from "@/app/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/features/hr/components/Pagination";
import {
  DashboardError,
  DashboardLoading,
} from "@/features/dashboard/components/DashboardUi";
import { MetricCard } from "@/features/employee-management/components/MetricCard";
import { useAuthStore } from "@/store/authStore";
import { formatDateTime, formatShortDate } from "@/features/hr/utils/dates";
import {
  useMyPlanningMeetings,
  usePlanningBoard,
  usePlanningMeeting,
  usePlanningOptions,
  useRespondPlanningMeeting,
} from "../hooks/useMeetings";
import { MeetingDetailPanel } from "../components/MeetingDetailPanel";
import { NotScheduledDetailPanel } from "../components/NotScheduledDetailPanel";
import { RespondMeetingDialog } from "../components/RespondMeetingDialog";
import { Badge, formatMeetingSlot, formatMeetingTime, initials } from "../components/meetingBadges";
import type { PlanningBoardRow, PlanningMeeting } from "../services/meetings.api";
import { cn } from "@/lib/utils";

const selectClass =
  "h-10 min-w-[160px] rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-700 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-200";

export default function PerformancePlanningPage() {
  const user = useAuthStore((state) => state.user);
  const role = user?.role;

  return (
    <DashboardLayout>
      {role === "EMPLOYEE" ? (
        <EmployeePlanningView />
      ) : (
        <PlanningBoardView
          role={role === "SUPERVISOR" ? "SUPERVISOR" : role === "HR" ? "HR" : "HR_MANAGER"}
        />
      )}
    </DashboardLayout>
  );
}

function PlanningBoardView({ role }: { role: "SUPERVISOR" | "HR" | "HR_MANAGER" }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [supervisorId, setSupervisorId] = useState("");
  const [hrEmployeeId, setHrEmployeeId] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [selectedEmployee, setSelectedEmployee] = useState<PlanningBoardRow["employee"] | null>(null);
  const selectedMeetingId = searchParams.get("meetingId");

  const optionsQuery = usePlanningOptions(true);
  const params = useMemo(
    () => ({
      search: search || undefined,
      departmentId: departmentId || undefined,
      supervisorId: supervisorId || undefined,
      hrEmployeeId: role === "HR_MANAGER" ? hrEmployeeId || undefined : undefined,
      status: status || undefined,
      page,
      pageSize: 12,
    }),
    [search, departmentId, supervisorId, hrEmployeeId, status, page, role]
  );

  const boardQuery = usePlanningBoard(params, true);
  const data = boardQuery.data;
  const showSupervisorCol = role === "HR" || role === "HR_MANAGER";

  const setSelectedMeeting = (meetingId: string | null) => {
    setSelectedEmployee(null);
    const next = new URLSearchParams(searchParams);
    if (meetingId) next.set("meetingId", meetingId);
    else next.delete("meetingId");
    setSearchParams(next, { replace: true });
  };

  const openDetails = (row: PlanningBoardRow) => {
    if (row.meeting) setSelectedMeeting(row.meeting.id);
    else {
      setSelectedMeeting(null);
      setSelectedEmployee(row.employee);
    }
  };

  const subtitle =
    role === "SUPERVISOR"
      ? "Manage the initial performance planning meeting for each employee in your team."
      : role === "HR"
        ? "Review performance planning meetings for employees under your HR responsibility."
        : "Organisation-wide overview of performance planning meetings.";

  return (
    <>
      {boardQuery.isLoading ? <DashboardLoading /> : null}
      {boardQuery.isError ? (
        <DashboardError message="Unable to load performance planning meetings." />
      ) : null}
      {data ? (
        <div
          className={cn(
            "grid gap-5",
            selectedMeetingId || selectedEmployee ? "xl:grid-cols-[minmax(0,1fr)_420px]" : ""
          )}
        >
          <div className="space-y-5">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-stone-900 dark:text-white">
                Performance Planning Meetings
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-stone-500">{subtitle}</p>
              {data.cycle ? (
                <p className="mt-1 text-xs text-stone-400">Active cycle: {data.cycle.name}</p>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
              <MetricCard
                icon={<Users className="h-5 w-5" />}
                value={data.kpis.totalEmployees}
                label={role === "SUPERVISOR" ? "Team Members" : "Total Employees"}
                tone="blue"
              />
              <MetricCard
                icon={<CheckCircle2 className="h-5 w-5" />}
                value={data.kpis.completed}
                label="Completed"
                tone="green"
                hint={percent(data.kpis.completed, data.kpis.totalEmployees)}
              />
              <MetricCard
                icon={<CalendarDays className="h-5 w-5" />}
                value={data.kpis.scheduled}
                label="Scheduled"
                tone="amber"
                hint={percent(data.kpis.scheduled, data.kpis.totalEmployees)}
              />
              <MetricCard
                icon={<Clock3 className="h-5 w-5" />}
                value={data.kpis.pendingEmployeeResponse}
                label="Pending Employee Response"
                tone="red"
                hint={percent(data.kpis.pendingEmployeeResponse, data.kpis.totalEmployees)}
              />
              <MetricCard
                icon={<RefreshCw className="h-5 w-5" />}
                value={data.kpis.rescheduleRequested}
                label="Reschedule Requested"
                tone="amber"
                hint={percent(data.kpis.rescheduleRequested, data.kpis.totalEmployees)}
              />
              <MetricCard
                icon={<CalendarClock className="h-5 w-5" />}
                value={data.kpis.notScheduled}
                label="Not Scheduled"
                tone="slate"
                hint={percent(data.kpis.notScheduled, data.kpis.totalEmployees)}
              />
            </div>

            <section className="rounded-[28px] border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-950">
              <div className="mb-4 flex flex-wrap gap-2">
                {[
                  ["", `All (${data.pagination.total})`],
                  ["COMPLETED", "Completed"],
                  ["SCHEDULED", "Scheduled"],
                  ["PENDING_RESPONSE", "Pending Response"],
                  ["RESCHEDULE_REQUESTED", "Reschedule Requested"],
                  ["NOT_SCHEDULED", "Not Scheduled"],
                ].map(([value, label]) => (
                  <button
                    key={value || "all"}
                    type="button"
                    onClick={() => {
                      setStatus(value);
                      setPage(1);
                    }}
                    className={cn(
                      "rounded-full px-3 py-1 text-sm",
                      status === value
                        ? "bg-amber-400 text-stone-950"
                        : "bg-stone-100 text-stone-600 dark:bg-stone-900"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="mb-4 flex flex-wrap gap-3">
                <div className="relative min-w-[220px] flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                  <input
                    className="h-10 w-full rounded-xl border border-stone-200 bg-white pl-9 pr-3 text-sm dark:border-stone-700 dark:bg-stone-950"
                    placeholder="Search employee name or ID..."
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setPage(1);
                    }}
                  />
                </div>
                {role === "HR_MANAGER" ? (
                  <select
                    className={selectClass}
                    value={hrEmployeeId}
                    onChange={(event) => {
                      setHrEmployeeId(event.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="">All HR In Charge</option>
                    {(optionsQuery.data?.hrStaff ?? []).map((hr) => (
                      <option key={hr.id} value={hr.id}>
                        {hr.name}
                      </option>
                    ))}
                  </select>
                ) : null}
                <select
                  className={selectClass}
                  value={departmentId}
                  onChange={(event) => {
                    setDepartmentId(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All Departments</option>
                  {optionsQuery.data?.departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
                {showSupervisorCol ? (
                  <select
                    className={selectClass}
                    value={supervisorId}
                    onChange={(event) => {
                      setSupervisorId(event.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="">All Supervisors</option>
                    {optionsQuery.data?.supervisors.map((supervisor) => (
                      <option key={supervisor.id} value={supervisor.id}>
                        {supervisor.name}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-[0.12em] text-stone-400">
                    <tr>
                      <th className="px-3 py-2">Employee</th>
                      <th className="px-3 py-2">Department</th>
                      {showSupervisorCol ? <th className="px-3 py-2">Supervisor</th> : null}
                      {role === "HR_MANAGER" ? <th className="px-3 py-2">HR In Charge</th> : null}
                      <th className="px-3 py-2">Meeting Date & Time</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Employee Response</th>
                      <th className="px-3 py-2">HR Response</th>
                      <th className="px-3 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((row) => (
                      <tr key={row.employee.id} className="border-t border-stone-100 dark:border-stone-800">
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 text-xs font-semibold text-stone-600">
                              {initials(row.employee.name)}
                            </span>
                            <div>
                              <p className="font-medium">{row.employee.name}</p>
                              <p className="text-xs text-stone-400">{row.employee.employeeId}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-stone-600">
                          {row.employee.department?.name ?? "—"}
                        </td>
                        {showSupervisorCol ? (
                          <td className="px-3 py-3 text-stone-600">
                            {row.employee.supervisor?.name ?? "—"}
                          </td>
                        ) : null}
                        {role === "HR_MANAGER" ? (
                          <td className="px-3 py-3 text-stone-600">
                            {row.employee.hr?.name ?? "—"}
                          </td>
                        ) : null}
                        <td className="px-3 py-3">{formatMeetingSlot(row.meeting?.scheduledAt)}</td>
                        <td className="px-3 py-3">
                          <Badge kind="status" value={row.status} />
                        </td>
                        <td className="px-3 py-3">
                          <Badge
                            kind="response"
                            value={row.meeting?.employeeResponse ?? (row.status === "NOT_SCHEDULED" ? "—" : "PENDING")}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <Badge
                            kind="response"
                            value={row.meeting?.hrResponse ?? (row.status === "NOT_SCHEDULED" ? "—" : "NOT_INVITED")}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <button
                            type="button"
                            className="text-sky-600 hover:underline"
                            onClick={() => openDetails(row)}
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={data.pagination.page}
                totalPages={data.pagination.totalPages}
                total={data.pagination.total}
                pageSize={data.pagination.pageSize}
                itemLabel="employees"
                onPageChange={setPage}
              />
            </section>
          </div>

          {selectedMeetingId ? (
            <MeetingDetailPanel
              meetingId={selectedMeetingId}
              canSchedule={role === "SUPERVISOR"}
              onClose={() => setSelectedMeeting(null)}
            />
          ) : selectedEmployee ? (
            <NotScheduledDetailPanel
              employee={selectedEmployee}
              canSchedule={role === "SUPERVISOR"}
              onClose={() => setSelectedEmployee(null)}
              onScheduled={(meetingId) => setSelectedMeeting(meetingId)}
            />
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function EmployeePlanningView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = useMyPlanningMeetings(true);
  const respond = useRespondPlanningMeeting();
  const upcoming = query.data?.upcoming[0] ?? null;
  const past = query.data?.past ?? [];
  const panelMeetingId = searchParams.get("meetingId");
  const detail = usePlanningMeeting(panelMeetingId || upcoming?.id || null);
  const [mode, setMode] = useState<"ACCEPT" | "RESCHEDULE" | null>(null);
  const meeting = (panelMeetingId ? detail.data?.meeting : null) ?? upcoming;

  if (query.isLoading) return <DashboardLoading />;
  if (query.isError) return <DashboardError message="Unable to load your meetings." />;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-5">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Performance Planning Meeting</h1>
          <p className="mt-1 text-sm text-stone-500">
            View your scheduled performance planning meeting, respond to invitations, and review related information.
          </p>
        </div>

        {meeting ? (
          <section className="rounded-[28px] border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-950">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Performance Planning Meeting</h2>
                <p className="mt-1 text-sm text-stone-500">{meeting.cycle?.name ?? "Current appraisal cycle"}</p>
              </div>
              <Badge kind="status" value={meeting.status} />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <p><span className="text-stone-400">Date:</span> {formatShortDate(meeting.scheduledAt)}</p>
              <p>
                <span className="text-stone-400">Time:</span>{" "}
                {formatMeetingTime(meeting.scheduledAt)} – {formatMeetingTime(meeting.endAt)}
              </p>
              <p><span className="text-stone-400">Location:</span> {meeting.location ?? "—"}</p>
              <p><span className="text-stone-400">Supervisor:</span> {meeting.supervisor?.name ?? "—"}</p>
              <p>
                <span className="text-stone-400">HR:</span>{" "}
                {meeting.hrParticipant?.name ?? "Optional / not invited"}
              </p>
            </div>

            {meeting.canRespondAsEmployee ? (
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
                <p className="text-sm text-amber-900 dark:text-amber-100">
                  Please respond to this meeting invitation. If you need to reschedule, provide a reason for your supervisor.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button type="button" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setMode("ACCEPT")}>
                    Accept Invitation
                  </Button>
                  <Button
                    type="button"
                    className="bg-amber-400 text-stone-950 hover:bg-amber-300"
                    onClick={() => setMode("RESCHEDULE")}
                  >
                    Request Reschedule
                  </Button>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-stone-500">
                Your response is recorded as <Badge kind="response" value={meeting.employeeResponse} />.
              </p>
            )}

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-stone-100 p-4 dark:border-stone-800">
                <p className="text-xs uppercase tracking-[0.14em] text-stone-400">Your response</p>
                <div className="mt-2"><Badge kind="response" value={meeting.employeeResponse} /></div>
                {meeting.employeeReason ? <p className="mt-2 text-sm text-stone-500">{meeting.employeeReason}</p> : null}
              </div>
              <div className="rounded-2xl border border-stone-100 p-4 dark:border-stone-800">
                <p className="text-xs uppercase tracking-[0.14em] text-stone-400">HR response</p>
                <div className="mt-2"><Badge kind="response" value={meeting.hrResponse} /></div>
                {meeting.hrReason ? <p className="mt-2 text-sm text-stone-500">{meeting.hrReason}</p> : null}
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                className="rounded-2xl border border-stone-100 p-4 text-left hover:bg-stone-50 dark:border-stone-800 dark:hover:bg-stone-900"
                onClick={() => setSearchParams({ meetingId: meeting.id, tab: "appraisal" })}
              >
                <p className="font-medium">Last Year&apos;s Appraisal</p>
                <p className="mt-1 text-sm text-stone-500">
                  {detail.data?.previousAppraisal
                    ? `${detail.data.previousAppraisal.cycle.name} · ${detail.data.previousAppraisal.overallResult}`
                    : "View previous appraisal details"}
                </p>
              </button>
              <button
                type="button"
                className="rounded-2xl border border-stone-100 p-4 text-left hover:bg-stone-50 dark:border-stone-800 dark:hover:bg-stone-900"
                onClick={() => setSearchParams({ meetingId: meeting.id, tab: "pdp" })}
              >
                <p className="font-medium">Previous PDP</p>
                <p className="mt-1 text-sm text-stone-500">
                  {detail.data?.previousPdp
                    ? `${detail.data.previousPdp.cycle.name} · ${detail.data.previousPdp.status.replaceAll("_", " ")}`
                    : "View previous PDP details"}
                </p>
              </button>
            </div>
          </section>
        ) : (
          <div className="rounded-[28px] border border-dashed border-stone-300 bg-white p-10 text-center text-sm text-stone-500 dark:border-stone-700 dark:bg-stone-950">
            No upcoming performance planning meeting has been scheduled yet.
          </div>
        )}

        {meeting ? <MeetingProcess meeting={meeting} /> : null}

        <section className="rounded-[28px] border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-950">
          <h2 className="text-lg font-semibold">Past Meetings</h2>
          {past.length === 0 ? (
            <p className="mt-3 text-sm text-stone-500">No previous performance planning meetings.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {past.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between rounded-2xl border border-stone-100 px-4 py-3 dark:border-stone-800"
                >
                  <div>
                    <p className="font-medium">{formatMeetingSlot(item.scheduledAt)}</p>
                    <p className="text-sm text-stone-500">{item.supervisor?.name}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge kind="status" value={item.status} />
                    <button
                      type="button"
                      className="text-sky-600"
                      onClick={() => setSearchParams({ meetingId: item.id })}
                    >
                      View
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="space-y-4">
        {meeting ? (
          <>
            <aside className="rounded-[28px] border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-950">
              <p className="text-xs uppercase tracking-[0.14em] text-stone-400">Your Response</p>
              <div className="mt-3"><Badge kind="response" value={meeting.employeeResponse} /></div>
              {meeting.canRespondAsEmployee ? (
                <p className="mt-3 text-sm text-stone-500">Please respond to the invitation.</p>
              ) : (
                <p className="mt-3 text-sm text-stone-500">Your response has been recorded.</p>
              )}
            </aside>
            <aside className="rounded-[28px] border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-950">
              <p className="text-xs uppercase tracking-[0.14em] text-stone-400">HR Response</p>
              <div className="mt-3"><Badge kind="response" value={meeting.hrResponse} /></div>
              {meeting.hrReason ? (
                <p className="mt-3 text-sm text-stone-500">{meeting.hrReason}</p>
              ) : (
                <p className="mt-3 text-sm text-stone-500">
                  {meeting.hrResponse === "PENDING"
                    ? "You will be notified once HR responds."
                    : "HR attendance is optional."}
                </p>
              )}
            </aside>
            <aside className="rounded-[28px] border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-950">
              <p className="text-xs uppercase tracking-[0.14em] text-stone-400">After the Meeting</p>
              <p className="mt-3 text-sm text-stone-500">
                Your supervisor will use the meeting outcomes to create your new Personal Development Plan. Official meeting notes become available after the meeting is completed.
              </p>
            </aside>
          </>
        ) : null}
      </div>

      {panelMeetingId ? (
        <div className="xl:col-span-2">
          <MeetingDetailPanel
            meetingId={panelMeetingId}
            canSchedule={false}
            onClose={() => setSearchParams({}, { replace: true })}
          />
        </div>
      ) : null}

      <RespondMeetingDialog
        open={Boolean(mode && meeting)}
        title={mode === "ACCEPT" ? "Accept invitation" : "Request reschedule"}
        description={
          mode === "ACCEPT"
            ? "Confirm that you will attend."
            : "Please provide a reason. Your supervisor will choose a new date and time."
        }
        requireReason={mode === "RESCHEDULE"}
        pending={respond.isPending}
        confirmLabel="Submit"
        onClose={() => setMode(null)}
        onSubmit={(reason) =>
          respond.mutateAsync({
            meetingId: meeting!.id,
            decision: mode ?? "ACCEPT",
            reason: reason || undefined,
          }).then(() => setMode(null))
        }
      />
    </div>
  );
}

function MeetingProcess({ meeting }: { meeting: PlanningMeeting }) {
  const steps = [
    {
      label: "Meeting Scheduled",
      done: true,
      detail: formatShortDate(meeting.scheduledAt),
    },
    {
      label: "Employee Response",
      done: meeting.employeeResponse !== "PENDING",
      detail: meeting.employeeResponse.replaceAll("_", " "),
    },
    {
      label: "HR Response",
      done: meeting.hrResponse !== "PENDING" && meeting.hrResponse !== "NOT_INVITED",
      detail:
        meeting.hrResponse === "NOT_INVITED"
          ? "Not invited"
          : meeting.hrResponse.replaceAll("_", " "),
    },
    {
      label: "Meeting Completed",
      done: meeting.status === "COMPLETED",
      detail: meeting.status === "COMPLETED" ? "Completed" : "To be confirmed",
    },
  ];

  return (
    <section className="rounded-[28px] border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-950">
      <h2 className="text-lg font-semibold">Meeting Process</h2>
      <ol className="mt-4 grid gap-3 sm:grid-cols-4">
        {steps.map((step, index) => (
          <li key={step.label} className="rounded-2xl border border-stone-100 p-3 dark:border-stone-800">
            <div
              className={cn(
                "mb-2 flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold",
                step.done ? "bg-emerald-500 text-white" : "bg-stone-200 text-stone-600"
              )}
            >
              {step.done ? "✓" : index + 1}
            </div>
            <p className="text-sm font-medium">{step.label}</p>
            <p className="mt-1 text-xs text-stone-500">{step.detail}</p>
          </li>
        ))}
      </ol>
      {meeting.notes ? (
        <p className="mt-4 text-xs text-stone-400">
          Notes last updated {formatDateTime(meeting.notes.recordedAt)} by {meeting.notes.recordedBy.name}.
        </p>
      ) : null}
    </section>
  );
}

function percent(value: number, total: number) {
  if (!total) return undefined;
  return `${Math.round((value / total) * 100)}%`;
}
