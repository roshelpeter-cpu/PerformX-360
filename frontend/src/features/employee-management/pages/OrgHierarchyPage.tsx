import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Search, Users } from "lucide-react";
import { Link } from "react-router-dom";
import DashboardLayout from "@/app/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  DashboardError,
  DashboardLoading,
} from "@/features/dashboard/components/DashboardUi";
import { useOrgHierarchy } from "@/features/employee-management/hooks/useEmployeeManagement";
import { ReassignEmployeeDialog } from "@/features/employee-management/components/ReassignEmployeeDialog";
import type {
  HierarchyHrNode,
  HierarchySupervisorNode,
  TeamMemberRow,
} from "@/features/employee-management/services/employee-management.api";
import { useAuthStore } from "@/store/authStore";
import { cn } from "@/lib/utils";

const selectClass =
  "h-10 min-w-[160px] rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-700 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-200";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function PersonLink({
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
    <Link to={to} className="flex min-w-0 items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-semibold text-amber-800">
        {initials(name)}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-medium text-stone-900 dark:text-stone-50">
          {name}
        </span>
        <span className="block truncate text-xs text-stone-400">
          {employeeId}
          {meta ? ` · ${meta}` : ""}
        </span>
      </span>
    </Link>
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
      <PersonLink
        to={`/hr/employee-management/${employee.id}`}
        name={employee.name}
        employeeId={employee.employeeId}
        meta={`${employee.jobTitle} · ${employee.department?.name ?? "—"}`}
      />
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "hidden rounded-full px-2.5 py-0.5 text-xs font-medium sm:inline-flex",
            employee.status === "Locked"
              ? "bg-red-100 text-red-800"
              : "bg-amber-100 text-amber-800"
          )}
        >
          {employee.status}
        </span>
        {canReassign ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onReassign(employee)}
          >
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
}: {
  supervisor: HierarchySupervisorNode;
  open: boolean;
  onToggle: () => void;
  canReassign: boolean;
  onReassign: (employee: TeamMemberRow) => void;
}) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-950">
      <div className="flex items-center gap-2 px-3 py-3">
        <button
          type="button"
          className="rounded-lg p-1 text-stone-400 hover:bg-stone-100"
          onClick={onToggle}
          aria-expanded={open}
        >
          {open ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <PersonLink
            to={`/hr/employee-management/${supervisor.id}`}
            name={supervisor.name}
            employeeId={supervisor.employeeId}
            meta={`${supervisor.jobTitle} · ${supervisor.department?.name ?? "—"}`}
          />
        </div>
        <div className="hidden text-right text-xs text-stone-500 sm:block">
          <p>{supervisor.department?.name}</p>
          <p>
            {supervisor.team?.name ?? "Team"} · {supervisor.employeeCount} employees
          </p>
        </div>
      </div>
      {open ? (
        <div className="space-y-1 border-t border-stone-100 px-3 py-2 dark:border-stone-800">
          {supervisor.employees.length === 0 ? (
            <p className="px-3 py-4 text-sm text-stone-500">
              No employees under this supervisor.
            </p>
          ) : (
            supervisor.employees.map((employee) => (
              <EmployeeRow
                key={employee.id}
                employee={employee}
                canReassign={canReassign}
                onReassign={onReassign}
              />
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

function HrBlock({
  group,
  index,
  isManagerView,
  canReassign,
  onReassign,
}: {
  group: HierarchyHrNode;
  index: number;
  isManagerView: boolean;
  canReassign: boolean;
  onReassign: (employee: TeamMemberRow) => void;
}) {
  const [open, setOpen] = useState(true);
  const [openSupervisors, setOpenSupervisors] = useState<Record<string, boolean>>(
    () => (group.supervisors[0] ? { [group.supervisors[0].id]: true } : {})
  );

  return (
    <section className="rounded-[28px] border border-stone-200 bg-white p-4 shadow-[0_16px_40px_rgba(28,25,23,0.04)] dark:border-stone-800 dark:bg-stone-950 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {isManagerView ? (
            <button
              type="button"
              className="rounded-lg p-1 text-stone-400 hover:bg-stone-100"
              onClick={() => setOpen((value) => !value)}
            >
              {open ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          ) : null}
          <PersonLink
            to={`/hr/employee-management/${group.id}`}
            name={group.name}
            employeeId={group.employeeId}
            meta={group.jobTitle}
          />
        </div>
        <div className="flex items-center gap-3 text-xs text-stone-500">
          <span className="hidden rounded-full bg-stone-100 px-3 py-1 sm:inline">
            {group.supervisorCount} supervisors
          </span>
          <span className="hidden rounded-full bg-amber-50 px-3 py-1 text-amber-800 sm:inline">
            {group.employeeCount} employees
          </span>
        </div>
      </div>
      {isManagerView ? (
        <p className="mt-2 pl-9 text-xs text-stone-400">
          HR {index + 1} · {group.department?.name ?? "Human Resources"}
        </p>
      ) : (
        <p className="mt-2 text-xs text-stone-400">
          Supervisors and employees under your HR responsibility.
        </p>
      )}

      {open ? (
        <div className="mt-4 space-y-3">
          {group.supervisors.length === 0 ? (
            <p className="px-2 py-6 text-sm text-stone-500">
              No supervisors match the current filters.
            </p>
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
              />
            ))
          )}
        </div>
      ) : null}
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
  const [reassign, setReassign] = useState<TeamMemberRow | null>(null);

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

  return (
    <DashboardLayout>
      {query.isLoading ? <DashboardLoading /> : null}
      {query.isError ? (
        <DashboardError message="Unable to load employee management. Please try again." />
      ) : null}
      {data ? (
        <div className="space-y-5">
          <div>
            <p className="text-xs text-stone-400">Home / Employee Management</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900 dark:text-white">
              Employee Management
            </h1>
            <p className="mt-1 text-sm text-stone-500">
              {isManager
                ? "Organisation hierarchy: HR, supervisors, and their assigned employees."
                : "Your HR group: supervisors reporting to you and the employees on their teams."}
            </p>
          </div>

          <section className="rounded-[28px] border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-950 sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search employees, supervisors, or HR..."
                  className="h-10 w-full rounded-xl border border-stone-200 bg-white pl-10 pr-3 text-sm dark:border-stone-700 dark:bg-stone-950"
                />
              </div>
              <select
                className={selectClass}
                value={departmentId}
                onChange={(event) => setDepartmentId(event.target.value)}
              >
                <option value="">All Departments</option>
                {data.filters.departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
              <select
                className={selectClass}
                value={teamId}
                onChange={(event) => setTeamId(event.target.value)}
              >
                <option value="">All Teams</option>
                {data.filters.teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
              <select
                className={selectClass}
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="">All Status</option>
                {data.filters.statuses.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          </section>

          {data.groups.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-stone-300 bg-white px-6 py-16 text-center dark:border-stone-700 dark:bg-stone-950">
              <Users className="mx-auto h-8 w-8 text-stone-300" />
              <p className="mt-3 text-sm font-medium">No matching people</p>
              <p className="mt-1 text-sm text-stone-500">
                Try a different search or filter.
              </p>
            </div>
          ) : (
            data.groups.map((group, index) => (
              <HrBlock
                key={group.id}
                group={group}
                index={index}
                isManagerView={isManager}
                canReassign
                onReassign={setReassign}
              />
            ))
          )}
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
    </DashboardLayout>
  );
}
