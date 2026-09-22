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
import { Pagination } from "@/features/hr/components/Pagination";
import {
  DashboardError,
  DashboardLoading,
} from "@/features/dashboard/components/DashboardUi";
import { MetricCard } from "@/features/employee-management/components/MetricCard";
import { useAuthStore } from "@/store/authStore";
import {
  useMyPlanningMeetings,
  usePlanningBoard,
  usePlanningOptions,
} from "../hooks/useMeetings";
import { MeetingDetailPanel } from "../components/MeetingDetailPanel";
import { NotScheduledDetailPanel } from "../components/NotScheduledDetailPanel";
import { Badge, formatMeetingSlot, initials } from "../components/meetingBadges";
import type { PlanningBoardRow } from "../services/meetings.api";
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
              {data.cycle && role !== "SUPERVISOR" ? (
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
                  [
                    "PENDING_RESPONSE",
                    role === "HR" ? "Pending HR Response" : "Pending Response",
                  ],
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
                            meetingStatus={row.status}
                            forHr
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
  const [searchParams] = useSearchParams();
  const query = useMyPlanningMeetings(true);
  const linkedMeetingId = searchParams.get("meetingId");
  const meeting =
    query.data?.meeting ?? query.data?.upcoming?.[0] ?? query.data?.past?.[0] ?? null;
  const meetingId = linkedMeetingId || meeting?.id || null;

  if (query.isLoading) return <DashboardLoading />;
  if (query.isError) return <DashboardError message="Unable to load your meetings." />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Performance Planning Meeting</h1>
        <p className="mt-1 text-sm text-stone-500">
          View your performance planning meeting for the active appraisal cycle, respond to the
          invitation, and review related information.
        </p>
        {query.data?.cycle ? (
          <p className="mt-1 text-xs text-stone-400">Active cycle: {query.data.cycle.name}</p>
        ) : null}
      </div>

      {meetingId ? (
        <div className="mx-auto w-full max-w-3xl">
          <MeetingDetailPanel
            meetingId={meetingId}
            canSchedule={false}
            hideClose
            onClose={() => undefined}
          />
        </div>
      ) : (
        <div className="rounded-[28px] border border-dashed border-stone-300 bg-white p-10 text-center text-sm text-stone-500 dark:border-stone-700 dark:bg-stone-950">
          No performance planning meeting has been scheduled for the active appraisal cycle yet.
        </div>
      )}
    </div>
  );
}

function percent(value: number, total: number) {
  if (!total) return undefined;
  return `${Math.round((value / total) * 100)}%`;
}
