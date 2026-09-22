import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Clock3,
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
import { formatDateTime } from "@/features/hr/utils/dates";
import {
  useMyPlanningMeetings,
  usePlanningBoard,
  usePlanningOptions,
  useRespondPlanningMeeting,
  useSchedulePlanningMeeting,
} from "../hooks/useMeetings";
import { ScheduleMeetingPanel } from "../components/ScheduleMeetingDialog";
import { MeetingDetailPanel } from "../components/MeetingDetailPanel";
import { RespondMeetingDialog } from "../components/RespondMeetingDialog";
import { Badge, formatMeetingSlot, initials } from "../components/meetingBadges";
import type { PlanningMeeting } from "../services/meetings.api";
import { cn } from "@/lib/utils";

const selectClass =
  "h-10 min-w-[160px] rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-700 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-200";

export default function PerformancePlanningPage() {
  const user = useAuthStore((state) => state.user);
  const isEmployee = user?.role === "EMPLOYEE";
  const isSupervisor = user?.role === "SUPERVISOR";
  const isHr = user?.role === "HR" || user?.role === "HR_MANAGER";

  return (
    <DashboardLayout>
      {isEmployee ? <EmployeePlanningView /> : <PlanningBoardView canSchedule={isSupervisor} isHr={isHr} />}
    </DashboardLayout>
  );
}

function PlanningBoardView({ canSchedule, isHr }: { canSchedule: boolean; isHr: boolean }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [supervisorId, setSupervisorId] = useState("");
  const [cycleId, setCycleId] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleEmployeeId, setScheduleEmployeeId] = useState<string | undefined>();
  const selectedId = searchParams.get("meetingId");

  const optionsQuery = usePlanningOptions(true);
  const defaultCycleId = optionsQuery.data?.cycle.id ?? "";

  useEffect(() => {
    if (!cycleId && defaultCycleId) setCycleId(defaultCycleId);
  }, [cycleId, defaultCycleId]);

  const params = useMemo(
    () => ({
      search: search || undefined,
      departmentId: departmentId || undefined,
      supervisorId: supervisorId || undefined,
      cycleId: cycleId || undefined,
      status: status || undefined,
      page,
      pageSize: 12,
    }),
    [search, departmentId, supervisorId, cycleId, status, page]
  );

  const boardQuery = usePlanningBoard(params, Boolean(cycleId || defaultCycleId));
  const schedule = useSchedulePlanningMeeting();
  const data = boardQuery.data;

  const setSelected = (meetingId: string | null) => {
    setScheduleOpen(false);
    const next = new URLSearchParams(searchParams);
    if (meetingId) next.set("meetingId", meetingId);
    else next.delete("meetingId");
    setSearchParams(next, { replace: true });
  };

  return (
    <>
      {boardQuery.isLoading ? <DashboardLoading /> : null}
      {boardQuery.isError ? (
        <DashboardError message="Unable to load performance planning meetings." />
      ) : null}
      {data ? (
        <div className={cn("grid gap-5", selectedId || scheduleOpen ? "xl:grid-cols-[minmax(0,1fr)_420px]" : "")}>
          <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-stone-900 dark:text-white">
                  Performance Planning Meetings
                </h1>
                <p className="mt-1 max-w-2xl text-sm text-stone-500">
                  {canSchedule
                    ? "Manage the initial performance planning meeting for each employee in your team."
                    : "Manage and oversee performance planning meetings across the organization."}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="text-sm font-medium text-stone-600">
                  Appraisal Cycle
                  <select
                    className={`${selectClass} mt-1 block min-w-[220px]`}
                    value={cycleId || defaultCycleId}
                    onChange={(event) => {
                      setCycleId(event.target.value);
                      setPage(1);
                    }}
                  >
                    {(optionsQuery.data?.cycles ?? []).map((cycle) => (
                      <option key={cycle.id} value={cycle.id}>{cycle.name}</option>
                    ))}
                  </select>
                </label>
                {canSchedule ? (
                  <Button type="button" onClick={() => { setScheduleEmployeeId(undefined); setScheduleOpen(true); setSelected(null); }}>
                    Schedule Meeting
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <MetricCard icon={<Users className="h-5 w-5" />} value={data.kpis.totalEmployees} label={canSchedule ? "Team Members" : "Total Employees"} tone="blue" />
              <MetricCard icon={<CheckCircle2 className="h-5 w-5" />} value={data.kpis.completed} label="Completed" tone="green" hint={percent(data.kpis.completed, data.kpis.totalEmployees)} />
              <MetricCard icon={<CalendarDays className="h-5 w-5" />} value={data.kpis.scheduled} label="Scheduled" tone="amber" hint={percent(data.kpis.scheduled, data.kpis.totalEmployees)} />
              <MetricCard icon={<Clock3 className="h-5 w-5" />} value={data.kpis.pendingEmployeeResponse} label="Pending Employee Response" tone="red" hint={percent(data.kpis.pendingEmployeeResponse, data.kpis.totalEmployees)} />
              <MetricCard icon={<CalendarClock className="h-5 w-5" />} value={data.kpis.notScheduled} label="Not Scheduled" tone="slate" hint={percent(data.kpis.notScheduled, data.kpis.totalEmployees)} />
            </div>

            <section className="rounded-[28px] border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-950">
              <div className="mb-4 flex flex-wrap gap-2">
                {[
                  ["", `All (${data.pagination.total})`],
                  ["COMPLETED", "Completed"],
                  ["SCHEDULED", "Scheduled"],
                  ["PENDING_RESPONSE", "Pending Response"],
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
                      status === value ? "bg-amber-400 text-stone-950" : "bg-stone-100 text-stone-600 dark:bg-stone-900"
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
                    placeholder="Search team members..."
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setPage(1);
                    }}
                  />
                </div>
                <select className={selectClass} value={departmentId} onChange={(event) => { setDepartmentId(event.target.value); setPage(1); }}>
                  <option value="">All Departments</option>
                  {optionsQuery.data?.departments.map((department) => (
                    <option key={department.id} value={department.id}>{department.name}</option>
                  ))}
                </select>
                {isHr ? (
                  <select className={selectClass} value={supervisorId} onChange={(event) => { setSupervisorId(event.target.value); setPage(1); }}>
                    <option value="">All Supervisors</option>
                    {optionsQuery.data?.supervisors.map((supervisor) => (
                      <option key={supervisor.id} value={supervisor.id}>{supervisor.name}</option>
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
                      {isHr ? <th className="px-3 py-2">Supervisor</th> : null}
                      <th className="px-3 py-2">Last Year's Appraisal</th>
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
                        {isHr ? (
                          <td className="px-3 py-3 text-stone-600">
                            {row.employee.supervisor?.name ?? "—"}
                          </td>
                        ) : null}
                        <td className="px-3 py-3">
                          <button
                            type="button"
                            className="text-sky-600 hover:underline"
                            onClick={() => row.meeting && setSelected(row.meeting.id)}
                            disabled={!row.meeting}
                          >
                            View
                          </button>
                        </td>
                        <td className="px-3 py-3">{formatMeetingSlot(row.meeting?.scheduledAt)}</td>
                        <td className="px-3 py-3"><Badge kind="status" value={row.status} /></td>
                        <td className="px-3 py-3"><Badge kind="response" value={row.meeting?.employeeResponse ?? "PENDING"} /></td>
                        <td className="px-3 py-3"><Badge kind="response" value={row.meeting?.hrResponse ?? "NOT_INVITED"} /></td>
                        <td className="px-3 py-3">
                          {row.meeting ? (
                            <button type="button" className="text-sky-600 hover:underline" onClick={() => setSelected(row.meeting!.id)}>
                              {row.status === "RESCHEDULE_REQUESTED" && canSchedule ? "Reschedule" : "View Details"}
                            </button>
                          ) : canSchedule ? (
                            <button type="button" className="text-amber-700 hover:underline" onClick={() => { setScheduleEmployeeId(row.employee.id); setScheduleOpen(true); setSelected(null); }}>
                              Schedule
                            </button>
                          ) : (
                            <span className="text-stone-400">—</span>
                          )}
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
          {scheduleOpen ? (
            <ScheduleMeetingPanel
              options={optionsQuery.data}
              pending={schedule.isPending}
              defaultEmployeeId={scheduleEmployeeId}
              defaultCycleId={cycleId || defaultCycleId}
              onClose={() => setScheduleOpen(false)}
              onSubmit={(payload) => schedule.mutateAsync(payload)}
            />
          ) : selectedId ? (
            <MeetingDetailPanel meetingId={selectedId} canSchedule={canSchedule} onClose={() => setSelected(null)} />
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
  const selectedId = searchParams.get("meetingId") || upcoming?.id || null;
  const [mode, setMode] = useState<"ACCEPT" | "DECLINE" | "RESCHEDULE" | null>(null);

  useEffect(() => {
    if (!searchParams.get("meetingId") && upcoming?.id) {
      const next = new URLSearchParams(searchParams);
      next.set("meetingId", upcoming.id);
      setSearchParams(next, { replace: true });
    }
  }, [upcoming?.id, searchParams, setSearchParams]);

  if (query.isLoading) return <DashboardLoading />;
  if (query.isError) return <DashboardError message="Unable to load your meetings." />;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="space-y-5">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">My Meetings</h1>
          <p className="mt-1 text-sm text-stone-500">
            View your performance planning meeting and respond to invitations.
          </p>
        </div>
        {upcoming ? (
          <UpcomingCard
            meeting={upcoming}
            onAccept={() => setMode("ACCEPT")}
            onReschedule={() => setMode("RESCHEDULE")}
            onDecline={() => setMode("DECLINE")}
          />
        ) : (
          <div className="rounded-[28px] border border-dashed border-stone-300 bg-white p-10 text-center text-sm text-stone-500 dark:border-stone-700 dark:bg-stone-950">
            No upcoming performance planning meeting has been scheduled yet.
          </div>
        )}
        <section className="rounded-[28px] border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-950">
          <h2 className="text-lg font-semibold">Past Meetings</h2>
          {past.length === 0 ? (
            <p className="mt-3 text-sm text-stone-500">No previous performance planning meetings.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {past.map((meeting) => (
                <li key={meeting.id} className="flex items-center justify-between rounded-2xl border border-stone-100 px-4 py-3 dark:border-stone-800">
                  <div>
                    <p className="font-medium">{formatMeetingSlot(meeting.scheduledAt)}</p>
                    <p className="text-sm text-stone-500">{meeting.supervisor?.name}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge kind="status" value={meeting.status} />
                    <button type="button" className="text-sky-600" onClick={() => setSearchParams({ meetingId: meeting.id })}>
                      View
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      {selectedId ? (
        <MeetingDetailPanel
          meetingId={selectedId}
          canSchedule={false}
          onClose={() => setSearchParams({}, { replace: true })}
        />
      ) : null}
      <RespondMeetingDialog
        open={Boolean(mode && upcoming)}
        title={mode === "ACCEPT" ? "Accept invitation" : mode === "RESCHEDULE" ? "Request reschedule" : "Decline invitation"}
        description={mode === "ACCEPT" ? "Confirm that you will attend." : "Please provide a reason."}
        requireReason={mode === "DECLINE" || mode === "RESCHEDULE"}
        pending={respond.isPending}
        confirmLabel="Submit"
        onClose={() => setMode(null)}
        onSubmit={(reason) =>
          respond.mutateAsync({
            meetingId: upcoming!.id,
            decision: mode ?? "ACCEPT",
            reason: reason || undefined,
          })
        }
      />
    </div>
  );
}

function UpcomingCard({
  meeting,
  onAccept,
  onReschedule,
  onDecline,
}: {
  meeting: PlanningMeeting;
  onAccept: () => void;
  onReschedule: () => void;
  onDecline: () => void;
}) {
  return (
    <section className="rounded-[28px] border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-950">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-stone-400">Upcoming Meeting</p>
          <h2 className="mt-1 text-xl font-semibold">Performance Planning Meeting</h2>
        </div>
        <Badge kind="status" value={meeting.status} />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <p><span className="text-stone-400">Date:</span> {formatMeetingSlot(meeting.scheduledAt)}</p>
        <p><span className="text-stone-400">Method:</span> {meeting.location ?? "—"}</p>
        <p><span className="text-stone-400">Supervisor:</span> {meeting.supervisor?.name ?? "—"}</p>
        <p><span className="text-stone-400">HR:</span> {meeting.hrParticipant?.name ?? "Optional / not invited"}</p>
        <p><span className="text-stone-400">Cycle:</span> {meeting.cycle?.name ?? "—"}</p>
        <p><span className="text-stone-400">Your response:</span> <Badge kind="response" value={meeting.employeeResponse} /></p>
      </div>
      {meeting.canRespondAsEmployee ? (
        <div className="mt-5 flex flex-wrap gap-2">
          <Button type="button" className="bg-emerald-600 hover:bg-emerald-700" onClick={onAccept}>
            Accept Invitation
          </Button>
          <Button type="button" className="bg-amber-400 text-stone-950 hover:bg-amber-300" onClick={onReschedule}>
            Request Reschedule
          </Button>
          <Button type="button" variant="outline" className="border-rose-300 text-rose-700" onClick={onDecline}>
            Decline Invitation
          </Button>
        </div>
      ) : (
        <p className="mt-4 text-sm text-stone-500">Your current response is recorded. The supervisor will follow up if anything changes.</p>
      )}
      {meeting.notes && meeting.canViewNotes ? (
        <p className="mt-4 text-xs text-stone-400">Notes last updated {formatDateTime(meeting.notes.recordedAt)} by {meeting.notes.recordedBy.name}.</p>
      ) : null}
    </section>
  );
}

function percent(value: number, total: number) {
  if (!total) return undefined;
  return `${Math.round((value / total) * 100)}%`;
}
