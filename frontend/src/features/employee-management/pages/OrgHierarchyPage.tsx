import { useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  MoreHorizontal,
  Plus,
  Search,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import DashboardLayout from "@/app/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  DashboardError,
  DashboardLoading,
} from "@/features/dashboard/components/DashboardUi";
import { Pagination } from "@/features/hr/components/Pagination";
import { useOrgHierarchy } from "@/features/employee-management/hooks/useEmployeeManagement";
import { ReassignEmployeeDialog } from "@/features/employee-management/components/ReassignEmployeeDialog";
import { ReassignHrTeamDialog } from "@/features/employee-management/components/ReassignHrTeamDialog";
import { CreateAccountDialog } from "@/features/employee-management/components/CreateAccountDialog";
import { MetricCard } from "@/features/employee-management/components/MetricCard";
import type {
  HierarchyHrNode,
  HierarchySupervisorNode,
  TeamMemberRow,
} from "@/features/employee-management/services/employee-management.api";
import { formatShortDate } from "@/features/hr/utils/dates";
import { useAuthStore } from "@/store/authStore";
import { cn } from "@/lib/utils";

const selectClass =
  "h-10 min-w-[160px] rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-700 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-200";

function PersonText({
  to,
  name,
  employeeId,
  meta,
}: {
  to: string;
  name: string;
  employeeId: string;
  meta?: string;
}) {
  return (
    <Link to={to} className="min-w-0">
      <span className="block truncate font-medium text-stone-900 dark:text-stone-50">
        {name}
      </span>
      <span className="block truncate text-xs text-stone-400">
        {employeeId}
        {meta ? ` · ${meta}` : ""}
      </span>
    </Link>
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
        status === "Locked" ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-700"
      )}
    >
      {status}
    </span>
  );
}

function EmployeeRow({
  employee,
  canReassign,
  onReassign,
}: {
  employee: TeamMemberRow;
  canReassign: boolean;
  onReassign: (employee: TeamMemberRow) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl px-3 py-2 hover:bg-stone-50 dark:hover:bg-stone-900">
      <PersonText
        to={`/hr/employee-management/${employee.id}`}
        name={employee.name}
        employeeId={employee.employeeId}
        meta={`${employee.jobTitle} · ${employee.department?.name ?? "—"}`}
      />
      <div className="flex items-center gap-2">
        <StatusPill status={employee.status} />
        {canReassign ? (
          <Button type="button" size="sm" variant="outline" onClick={() => onReassign(employee)}>
            Reassign
          </Button>
        ) : null}
        <Link
          to={`/hr/employee-management/${employee.id}`}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100"
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

function SupervisorBlock({
  supervisor,
  open,
  onToggle,
  canReassign,
  onReassign,
  canReassignHr,
  onReassignHr,
}: {
  supervisor: HierarchySupervisorNode;
  open: boolean;
  onToggle: () => void;
  canReassign: boolean;
  onReassign: (employee: TeamMemberRow) => void;
  canReassignHr: boolean;
  onReassignHr: (supervisor: HierarchySupervisorNode) => void;
}) {
  const teams = supervisor.teams?.length
    ? supervisor.teams
    : supervisor.team
      ? [{ id: supervisor.team.id, name: supervisor.team.name, department: supervisor.department, employees: supervisor.employees }]
      : [];

  return (
    <div className="rounded-2xl border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-950">
      <div className="flex items-center gap-2 px-3 py-3">
        <button type="button" className="rounded-lg p-1 text-stone-400 hover:bg-stone-100" onClick={onToggle}>
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <div className="min-w-0 flex-1">
          <PersonText
            to={`/hr/employee-management/${supervisor.id}`}
            name={supervisor.name}
            employeeId={supervisor.employeeId}
            meta={`${supervisor.jobTitle} · ${supervisor.department?.name ?? "—"}`}
          />
        </div>
        <div className="flex items-center gap-2">
          {canReassignHr ? (
            <Button type="button" size="sm" variant="outline" onClick={() => onReassignHr(supervisor)}>
              Reassign HR
            </Button>
          ) : null}
          <div className="hidden text-right text-xs text-stone-500 sm:block">
            <p>{supervisor.department?.name}</p>
            <p>
              {teams.length} team{teams.length === 1 ? "" : "s"} · {supervisor.employeeCount} employees
            </p>
          </div>
        </div>
      </div>
      {open ? (
        <div className="space-y-3 border-t border-stone-100 px-3 py-3 dark:border-stone-800">
          {teams.length === 0 ? (
            <p className="px-3 py-4 text-sm text-stone-500">No teams under this supervisor.</p>
          ) : (
            teams.map((team) => (
              <div key={team.id} className="rounded-2xl bg-stone-50 px-3 py-3 dark:bg-stone-900">
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                  Team: {team.name}
                </p>
                <div className="mt-2 space-y-1">
                  {team.employees.length === 0 ? (
                    <p className="px-2 py-3 text-sm text-stone-500">No employees on this team.</p>
                  ) : (
                    team.employees.map((employee) => (
                      <EmployeeRow
                        key={employee.id}
                        employee={employee}
                        canReassign={canReassign}
                        onReassign={onReassign}
                      />
                    ))
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

function HierarchyDetail({
  group,
  canReassign,
  onReassign,
  canReassignHr,
  onReassignHr,
}: {
  group: HierarchyHrNode;
  canReassign: boolean;
  onReassign: (employee: TeamMemberRow) => void;
  canReassignHr: boolean;
  onReassignHr: (supervisor: HierarchySupervisorNode) => void;
}) {
  const [openSupervisors, setOpenSupervisors] = useState<Record<string, boolean>>(
    () => (group.supervisors[0] ? { [group.supervisors[0].id]: true } : {})
  );

  return (
    <section className="rounded-[28px] border border-stone-200 bg-white p-4 shadow-[0_16px_40px_rgba(28,25,23,0.04)] dark:border-stone-800 dark:bg-stone-950 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <PersonText
          to={`/hr/employee-management/${group.id}`}
          name={group.name}
          employeeId={group.employeeId}
          meta={group.jobTitle}
        />
        <div className="flex items-center gap-3 text-xs text-stone-500">
          <span className="hidden rounded-full bg-stone-100 px-3 py-1 sm:inline">
            {group.supervisorCount} supervisors
          </span>
          <span className="hidden rounded-full bg-amber-50 px-3 py-1 text-amber-800 sm:inline">
            {group.employeeCount} employees
          </span>
        </div>
      </div>
      <p className="mt-2 text-xs text-stone-400">
        {group.department?.name ?? "Human Resources"} · {group.teamName ?? "HR Team"}
      </p>
      <div className="mt-4 space-y-3">
        {group.supervisors.length === 0 ? (
          <p className="px-2 py-6 text-sm text-stone-500">No supervisors are assigned to this HR member.</p>
        ) : (
          group.supervisors.map((supervisor) => (
            <SupervisorBlock
              key={supervisor.id}
              supervisor={supervisor}
              open={Boolean(openSupervisors[supervisor.id])}
              onToggle={() =>
                setOpenSupervisors((current) => ({
                  ...current,
                  [supervisor.id]: !current[supervisor.id],
                }))
              }
              canReassign={canReassign}
              onReassign={onReassign}
              canReassignHr={canReassignHr}
              onReassignHr={onReassignHr}
            />
          ))
        )}
      </div>
    </section>
  );
}

export default function OrgHierarchyPage() {
  const user = useAuthStore((state) => state.user);
  const isManager = user?.role === "HR_MANAGER";
  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [selectedHrId, setSelectedHrId] = useState<string | null>(null);
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [reassign, setReassign] = useState<TeamMemberRow | null>(null);
  const [reassignHr, setReassignHr] = useState<HierarchySupervisorNode | null>(null);

  const params = useMemo(
    () => ({
      search: search || undefined,
      departmentId: departmentId || undefined,
      teamId: teamId || undefined,
      status: status || undefined,
    }),
    [search, departmentId, teamId, status]
  );

  const query = useOrgHierarchy(params);
  const data = query.data;
  const groups = data?.groups ?? [];
  const selected = groups.find((group) => group.id === selectedHrId) ?? null;
  const supervisors = isManager
    ? selected?.supervisors ?? []
    : groups.flatMap((group) => group.supervisors);
  const selectedSupervisor =
    supervisors.find((supervisor) => supervisor.id === selectedSupervisorId) ?? null;
  const pageSize = 5;
  const totalPages = Math.max(1, Math.ceil(groups.length / pageSize));
  const paged = groups.slice((page - 1) * pageSize, page * pageSize);
  const summary = data?.summary;

  function exportRows() {
    const header = ["HR ID", "Full Name", "Job Title", "Department", "Team", "Status", "Joining Date"];
    const rows = groups.map((group) =>
      [
        group.employeeId,
        group.name,
        group.jobTitle,
        group.department?.name ?? "",
        group.teamName ?? "",
        group.status,
        formatShortDate(group.joinedAt),
      ].join(",")
    );
    const blob = new Blob([[header.join(","), ...rows].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "hr-members.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <DashboardLayout>
      {query.isLoading ? <DashboardLoading /> : null}
      {query.isError ? (
        <DashboardError message="Unable to load employee management. Please try again." />
      ) : null}
      {data ? (
        <div className="space-y-5">
          {!isManager && selectedSupervisor ? (
            <button
              type="button"
              className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800"
              onClick={() => setSelectedSupervisorId(null)}
            >
              <ChevronLeft className="h-4 w-4" />
              Back to supervisors
            </button>
          ) : null}
          {selected && isManager ? (
            <button
              type="button"
              className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800"
              onClick={() => setSelectedHrId(null)}
            >
              <ChevronLeft className="h-4 w-4" />
              Back to all HR members
            </button>
          ) : null}

          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs text-stone-400">Home / Employee Management</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900 dark:text-white">
                Employee Management
              </h1>
              <p className="mt-1 text-sm text-stone-500">
                {isManager
                  ? selected
                    ? `${selected.name}: supervisors, teams, and employees.`
                    : "Manage HR members across the organization."
                  : selectedSupervisor
                    ? `${selectedSupervisor.name}: teams and employees.`
                    : "Supervisors, teams, and employees under your HR responsibility."}
              </p>
            </div>
            {isManager && !selected ? (
              <Button
                type="button"
                className="bg-amber-400 text-stone-950 hover:bg-amber-300"
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Add Employee
              </Button>
            ) : null}
          </div>

          {!selected && !selectedSupervisor && summary ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {isManager ? (
                <>
                  <MetricCard
                    icon={<Users className="h-5 w-5" />}
                    value={summary.hrMembers}
                    label="HR Members"
                    hint="Organisation-wide HR accounts"
                    tone="blue"
                  />
                  <MetricCard
                    icon={<Users className="h-5 w-5" />}
                    value={summary.totalEmployees}
                    label="Total Employees"
                    hint={`${summary.supervisorCount} supervisors`}
                    tone="amber"
                  />
                  <MetricCard
                    icon={<FileText className="h-5 w-5" />}
                    value={summary.ongoingProcesses}
                    label="Ongoing Processes"
                    hint="Active cycle, PDPs, and requests"
                    tone="blue"
                  />
                  <MetricCard
                    icon={<CheckCircle2 className="h-5 w-5" />}
                    value={`${summary.employeeCoveragePercent}%`}
                    label="Employee Coverage"
                    hint="Employees assigned to a team"
                    tone="green"
                  />
                </>
              ) : (
                <>
                  <MetricCard
                    icon={<Users className="h-5 w-5" />}
                    value={summary.supervisorCount}
                    label="Supervisors"
                    hint="Assigned to you"
                    tone="blue"
                  />
                  <MetricCard
                    icon={<Users className="h-5 w-5" />}
                    value={summary.totalEmployees}
                    label="Employees"
                    hint="Under your supervisors"
                    tone="amber"
                  />
                  <MetricCard
                    icon={<FileText className="h-5 w-5" />}
                    value={summary.teamCount}
                    label="Teams"
                    hint="In your HR responsibility"
                    tone="blue"
                  />
                  <MetricCard
                    icon={<CheckCircle2 className="h-5 w-5" />}
                    value={`${summary.employeeCoveragePercent}%`}
                    label="Employee Coverage"
                    hint="Assigned employees in your scope"
                    tone="green"
                  />
                </>
              )}
            </div>
          ) : null}

          <section className="rounded-[28px] border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-950 sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  placeholder={
                    isManager
                      ? "Search HR members by name, ID, role, department..."
                      : "Search employees, supervisors, or teams..."
                  }
                  className="h-10 w-full rounded-xl border border-stone-200 bg-white pl-10 pr-3 text-sm dark:border-stone-700 dark:bg-stone-950"
                />
              </div>
              <select className={selectClass} value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
                <option value="">All Departments</option>
                {data.filters.departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
              <select className={selectClass} value={teamId} onChange={(event) => setTeamId(event.target.value)}>
                <option value="">All Teams</option>
                {data.filters.teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
              <select className={selectClass} value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="">All Statuses</option>
                {data.filters.statuses.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          </section>

          {isManager && !selected ? (
            <section className="rounded-[28px] border border-stone-200 bg-white p-4 shadow-[0_16px_40px_rgba(28,25,23,0.04)] dark:border-stone-800 dark:bg-stone-950 sm:p-5">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-semibold">All HR Members ({groups.length})</p>
                <div className="flex items-center gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={exportRows}>
                    <Download className="h-4 w-4" />
                    Export
                  </Button>
                  <Button type="button" size="icon" variant="outline" aria-label="More">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-stone-100 text-xs uppercase tracking-wide text-stone-400">
                      <th className="px-3 py-3 font-medium">HR ID</th>
                      <th className="px-3 py-3 font-medium">Full Name</th>
                      <th className="px-3 py-3 font-medium">Job Title</th>
                      <th className="px-3 py-3 font-medium">Department</th>
                      <th className="px-3 py-3 font-medium">Team</th>
                      <th className="px-3 py-3 font-medium">Status</th>
                      <th className="px-3 py-3 font-medium">Joining Date</th>
                      <th className="px-3 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((group) => (
                      <tr key={group.id} className="border-b border-stone-100 last:border-0">
                        <td className="px-3 py-3 text-stone-500">{group.employeeId}</td>
                        <td className="px-3 py-3">
                          <button
                            type="button"
                            className="font-medium text-sky-700 hover:underline"
                            onClick={() => setSelectedHrId(group.id)}
                          >
                            {group.name}
                          </button>
                        </td>
                        <td className="px-3 py-3">{group.jobTitle}</td>
                        <td className="px-3 py-3">{group.department?.name ?? "Human Resources"}</td>
                        <td className="px-3 py-3">{group.teamName ?? "HR Team"}</td>
                        <td className="px-3 py-3">
                          <StatusPill status={group.status} />
                        </td>
                        <td className="px-3 py-3">{formatShortDate(group.joinedAt)}</td>
                        <td className="px-3 py-3">
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100"
                            onClick={() => setSelectedHrId(group.id)}
                            aria-label={`View ${group.name}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={page}
                totalPages={totalPages}
                total={groups.length}
                pageSize={pageSize}
                itemLabel="HR members"
                onPageChange={setPage}
              />
            </section>
          ) : null}

          {selected && isManager ? (
            <HierarchyDetail
              group={selected}
              canReassign={false}
              onReassign={setReassign}
              canReassignHr
              onReassignHr={setReassignHr}
            />
          ) : null}

          {!isManager && !selectedSupervisor ? (
            <section className="rounded-[28px] border border-stone-200 bg-white p-4 shadow-[0_16px_40px_rgba(28,25,23,0.04)] dark:border-stone-800 dark:bg-stone-950 sm:p-5">
              <p className="mb-3 font-semibold">Supervisors ({supervisors.length})</p>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-stone-100 text-xs uppercase tracking-wide text-stone-400">
                      <th className="px-3 py-3 font-medium">ID</th>
                      <th className="px-3 py-3 font-medium">Full Name</th>
                      <th className="px-3 py-3 font-medium">Job Title</th>
                      <th className="px-3 py-3 font-medium">Department</th>
                      <th className="px-3 py-3 font-medium">Team</th>
                      <th className="px-3 py-3 font-medium">Employees</th>
                      <th className="px-3 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {supervisors.map((supervisor) => (
                      <tr key={supervisor.id} className="border-b border-stone-100 last:border-0">
                        <td className="px-3 py-3 text-stone-500">{supervisor.employeeId}</td>
                        <td className="px-3 py-3">
                          <button
                            type="button"
                            className="font-medium text-sky-700 hover:underline"
                            onClick={() => setSelectedSupervisorId(supervisor.id)}
                          >
                            {supervisor.name}
                          </button>
                        </td>
                        <td className="px-3 py-3">{supervisor.jobTitle}</td>
                        <td className="px-3 py-3">{supervisor.department?.name ?? "—"}</td>
                        <td className="px-3 py-3">{supervisor.team?.name ?? supervisor.teams[0]?.name ?? "—"}</td>
                        <td className="px-3 py-3">{supervisor.employeeCount}</td>
                        <td className="px-3 py-3">
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100"
                            onClick={() => setSelectedSupervisorId(supervisor.id)}
                            aria-label={`View ${supervisor.name}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {supervisors.length === 0 ? (
                <p className="px-3 py-10 text-center text-sm text-stone-500">
                  No supervisors match the current filters.
                </p>
              ) : null}
            </section>
          ) : null}

          {!isManager && selectedSupervisor ? (
            <SupervisorBlock
              supervisor={selectedSupervisor}
              open
              onToggle={() => undefined}
              canReassign
              onReassign={setReassign}
              canReassignHr={false}
              onReassignHr={setReassignHr}
            />
          ) : null}
        </div>
      ) : null}

      {reassign ? (
        <ReassignEmployeeDialog
          open
          employeeId={reassign.id}
          employeeName={reassign.name}
          onClose={() => setReassign(null)}
        />
      ) : null}
      {reassignHr ? (
        <ReassignHrTeamDialog
          open
          supervisorId={reassignHr.id}
          supervisorName={reassignHr.name}
          onClose={() => setReassignHr(null)}
        />
      ) : null}
      {data ? (
        <CreateAccountDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          departments={data.filters.departments}
        />
      ) : null}
    </DashboardLayout>
  );
}
