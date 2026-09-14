// Appraisal Cycle detail — HR Manager
// Tabs: Cycle Details, HR Groups & Teams, Employees, Timeline, Settings.
// HR reassignment uses ReassignHrDialog with mandatory reason + evidence.
import { useEffect, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Users2,
} from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import DashboardLayout from "@/app/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fieldClass, EmptyState } from "@/features/hr/components/ActionMenu";
import {
  ActivateCycleDialog,
  CompleteCycleDialog,
  ConfirmCycleDialog,
  DeleteDraftCycleDialog,
} from "@/features/hr/components/CycleActionDialogs";
import { Pagination } from "@/features/hr/components/Pagination";
import ReassignHrDialog from "@/features/hr/components/ReassignHrDialog";
import { StatusBadge } from "@/features/hr/components/StatusBadge";
import {
  useAppraisalCycle,
  useCycleEmployees,
  useCycleHrGroups,
  useDepartments,
  useHrGroupDetail,
  useUpdateCycle,
} from "@/features/hr/hooks/useAppraisalCycles";
import type { AppraisalCycle, CycleStage } from "@/features/hr/types";
import {
  addOneYearIso,
  formatDate,
  formatShortDate,
  formatShortDateRange,
  toDateInputValue,
} from "@/features/hr/utils/dates";
import { cn } from "@/lib/utils";

type Tab =
  | "details"
  | "hr-groups"
  | "employees"
  | "timeline"
  | "settings";

export default function AppraisalCycleDetailPage() {
  const { cycleId } = useParams<{ cycleId: string }>();
  const [params, setParams] = useSearchParams();
  const rawTab = params.get("tab");
  const tab: Tab =
    rawTab === "overview" || rawTab === "reports" || !rawTab
      ? "details"
      : (rawTab as Tab);
  const cycleQuery = useAppraisalCycle(cycleId);
  const cycle = cycleQuery.data;
  const [actionsOpen, setActionsOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [activateOpen, setActivateOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const navigate = useNavigate();

  if (cycleQuery.isLoading) {
    return (
      <DashboardLayout>
        <p className="text-sm text-stone-500">Loading cycle…</p>
      </DashboardLayout>
    );
  }

  if (cycleQuery.isError || !cycle || !cycleId) {
    return (
      <DashboardLayout>
        <EmptyState
          title="Unable to load this appraisal cycle."
          description="The cycle may have been removed or the request failed."
          action={
            <Link
              to="/hr/appraisal-cycles"
              className="text-sm text-stone-700 hover:underline"
            >
              Back to Appraisal Cycles
            </Link>
          }
        />
      </DashboardLayout>
    );
  }

  const canEditConfig = cycle.status === "DRAFT";

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-5">
        <nav className="flex flex-wrap items-center gap-2 text-sm text-stone-500">
          <Link to="/hr/dashboard" className="hover:text-stone-900">
            HR
          </Link>
          <ChevronRight className="h-4 w-4" />
          <Link to="/hr/appraisal-cycles" className="hover:text-stone-900">
            Appraisal Cycles
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span className="font-medium text-stone-900 dark:text-stone-100">
            {cycle.name}
          </span>
        </nav>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold text-stone-900 dark:text-stone-50">
                {cycle.name}
              </h1>
              <StatusBadge status={cycle.status} />
            </div>
            <p className="mt-1 text-sm text-stone-500">
              {formatDate(cycle.startDate)} – {formatDate(cycle.endDate)}
            </p>
            {cycle.description ? (
              <p className="mt-2 max-w-3xl text-sm text-stone-600 dark:text-stone-300">
                {cycle.description}
              </p>
            ) : null}
          </div>

          <div className="relative">
            <Button type="button" onClick={() => setActionsOpen((v) => !v)}>
              Cycle Actions ▾
            </Button>
            {actionsOpen ? (
              <div className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-lg dark:border-stone-700 dark:bg-stone-900">
                {cycle.status === "DRAFT" ? (
                  <>
                    <ActionItem
                      label="Submit cycle"
                      onClick={() => {
                        setActionsOpen(false);
                        setConfirmOpen(true);
                      }}
                    />
                    <ActionItem
                      label="Edit settings"
                      onClick={() => {
                        setActionsOpen(false);
                        setParams({ tab: "settings" });
                      }}
                    />
                    <ActionItem
                      label="Delete draft"
                      danger
                      onClick={() => {
                        setActionsOpen(false);
                        setDeleteOpen(true);
                      }}
                    />
                  </>
                ) : null}
                {cycle.status === "UPCOMING" ? (
                  <ActionItem
                    label="Activate cycle"
                    onClick={() => {
                      setActionsOpen(false);
                      setActivateOpen(true);
                    }}
                  />
                ) : null}
                {cycle.status === "ACTIVE" ? (
                  <ActionItem
                    label="Complete cycle"
                    onClick={() => {
                      setActionsOpen(false);
                      setCompleteOpen(true);
                    }}
                  />
                ) : null}
                {cycle.status === "COMPLETED" ? (
                  <p className="px-4 py-3 text-sm text-stone-500">
                    Historical cycle — read only
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-1 border-b border-stone-200 dark:border-stone-800">
          {(
            [
              ["details", "Cycle Details"],
              ["hr-groups", "HR Groups & Teams"],
              ["employees", "Employees"],
              ["timeline", "Timeline"],
              ["settings", "Settings"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setParams({ tab: key })}
              className={cn(
                "rounded-t-lg px-4 py-2 text-sm",
                tab === key
                  ? "border-b-2 border-amber-400 font-medium text-stone-900 dark:text-stone-50"
                  : "text-stone-500 hover:text-stone-800"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "details" ? <DetailsTab cycle={cycle} canEdit={canEditConfig} /> : null}
        {tab === "hr-groups" ? <HrGroupsTab cycleId={cycleId} /> : null}
        {tab === "employees" ? <EmployeesTab cycleId={cycleId} /> : null}
        {tab === "timeline" ? <TimelineTab cycle={cycle} /> : null}
        {tab === "settings" ? (
          <SettingsTab cycleId={cycleId} canEditConfig={canEditConfig} />
        ) : null}
      </div>

      <ConfirmCycleDialog
        cycle={cycle}
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
      />
      <ActivateCycleDialog
        cycle={cycle}
        open={activateOpen}
        onClose={() => setActivateOpen(false)}
      />
      <CompleteCycleDialog
        cycle={cycle}
        open={completeOpen}
        onClose={() => setCompleteOpen(false)}
      />
      <DeleteDraftCycleDialog
        cycle={cycle}
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onDeleted={() => navigate("/hr/appraisal-cycles")}
      />
    </DashboardLayout>
  );
}

function ActionItem({
  label,
  onClick,
  danger,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      className={cn(
        "block w-full px-4 py-2 text-left text-sm hover:bg-stone-50 dark:hover:bg-stone-800",
        danger && "text-red-700 dark:text-red-300"
      )}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function DetailsTab({
  cycle,
  canEdit,
}: {
  cycle: AppraisalCycle;
  canEdit: boolean;
}) {
  const progress = cycle.progress;
  const phase = cycle.currentPhase;

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <div className="rounded-xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Cycle Information</h2>
              {canEdit ? (
                <Link
                  to={`/hr/appraisal-cycles/${cycle.id}?tab=settings`}
                  className="text-sm font-medium text-stone-700 hover:underline"
                >
                  Edit
                </Link>
              ) : null}
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <Info label="Cycle Name" value={cycle.name} />
              <Info
                label="Period"
                value={formatShortDateRange(cycle.startDate, cycle.endDate)}
              />
              <div>
                <dt className="text-xs text-stone-500">Status</dt>
                <dd className="mt-1">
                  <StatusBadge status={cycle.status} />
                </dd>
              </div>
              <Info label="Created By" value={cycle.createdBy?.name ?? "—"} />
              <Info label="Created On" value={formatShortDate(cycle.createdAt)} />
              <Info label="Last Updated" value={formatShortDate(cycle.updatedAt)} />
              <div className="sm:col-span-2">
                <dt className="text-xs text-stone-500">Description</dt>
                <dd className="mt-1 text-stone-700 dark:text-stone-300">
                  {cycle.description || "No description provided."}
                </dd>
              </div>
            </dl>
          </div>

          <TimelineCard stages={cycle.stages} canEdit={canEdit} cycleId={cycle.id} />
        </div>

        <div className="space-y-5">
          <div className="rounded-xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900">
            <h2 className="text-sm font-semibold">Key Statistics</h2>
            <div className="mt-4 space-y-3">
              <StatRow
                icon={<Users2 className="h-4 w-4" />}
                iconClass="bg-amber-100 text-amber-700"
                label="Total Employees"
                value={progress.totalEmployees}
                hint="Across all HR groups"
              />
              <StatRow
                icon={<CheckCircle2 className="h-4 w-4" />}
                iconClass="bg-emerald-100 text-emerald-700"
                label="Completed"
                value={progress.completed}
                hint={`${Math.round(
                  (progress.completed / Math.max(progress.totalEmployees, 1)) * 100
                )}% of employees`}
              />
              <StatRow
                icon={<CalendarDays className="h-4 w-4" />}
                iconClass="bg-amber-100 text-amber-700"
                label="In Progress"
                value={progress.inProgress}
                hint={`${Math.round(
                  (progress.inProgress / Math.max(progress.totalEmployees, 1)) * 100
                )}% of employees`}
              />
              <StatRow
                icon={<CircleAlert className="h-4 w-4" />}
                iconClass="bg-red-100 text-red-700"
                label="Overdue"
                value={progress.overdue}
                hint={`${Math.round(
                  (progress.overdue / Math.max(progress.totalEmployees, 1)) * 100
                )}% of employees`}
              />
            </div>
          </div>

          <div className="rounded-xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900">
            <h2 className="text-sm font-semibold">Current Phase</h2>
            {phase ? (
              <>
                <p className="mt-3 text-base font-semibold text-stone-900 dark:text-stone-50">
                  {phase.title}
                </p>
                <p className="mt-1 text-sm text-stone-500">
                  {formatShortDateRange(phase.startDate, phase.endDate)}
                </p>
              </>
            ) : (
              <p className="mt-3 text-sm text-stone-500">No phase available.</p>
            )}
            <p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-400/10 dark:text-amber-200">
              All employees are in the same appraisal cycle. Employees may be in
              different stages based on individual progress.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900">
        <h2 className="text-sm font-semibold">Cycle History</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs text-stone-500">
              <tr>
                <th className="px-2 py-2">Date</th>
                <th className="px-2 py-2">User</th>
                <th className="px-2 py-2">Action</th>
                <th className="px-2 py-2">Details</th>
              </tr>
            </thead>
            <tbody>
              {cycle.recentActivity.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-2 py-4 text-stone-500">
                    No history yet.
                  </td>
                </tr>
              ) : (
                cycle.recentActivity.map((item) => (
                  <tr
                    key={item.id}
                    className="border-t border-stone-100 dark:border-stone-800"
                  >
                    <td className="px-2 py-3 whitespace-nowrap">
                      {formatShortDate(item.date)}
                    </td>
                    <td className="px-2 py-3">{item.user.name}</td>
                    <td className="px-2 py-3 font-medium">{item.action}</td>
                    <td className="px-2 py-3 text-stone-600">{item.details}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TimelineCard({
  stages,
  canEdit,
  cycleId,
}: {
  stages: CycleStage[];
  canEdit: boolean;
  cycleId: string;
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Cycle Timeline</h2>
        {canEdit ? (
          <Link
            to={`/hr/appraisal-cycles/${cycleId}?tab=settings`}
            className="text-sm font-medium text-stone-700 hover:underline"
          >
            Edit Timeline
          </Link>
        ) : null}
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {stages.map((stage, index) => (
          <div key={stage.id} className="relative">
            {index < stages.length - 1 ? (
              <div
                className={cn(
                  "absolute left-4 top-3 hidden h-0.5 w-[calc(100%+1rem)] xl:block",
                  stage.status === "COMPLETED" ? "bg-amber-400" : "bg-stone-200"
                )}
              />
            ) : null}
            <div className="relative z-10 flex flex-col items-start gap-2">
              <span
                className={cn(
                  "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs",
                  stage.status === "COMPLETED" && "bg-amber-400 text-white",
                  stage.status === "CURRENT" &&
                    "border-2 border-amber-400 bg-white text-amber-500",
                  stage.status === "UPCOMING" && "bg-stone-200 text-stone-500"
                )}
              >
                {stage.status === "COMPLETED" ? "✓" : ""}
              </span>
              <p className="text-sm font-medium">{stage.title}</p>
              <p className="text-xs text-stone-500">
                {formatShortDateRange(stage.startDate, stage.endDate)}
              </p>
              <StatusBadge status={stage.status} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TimelineTab({ cycle }: { cycle: AppraisalCycle }) {
  return (
    <div className="space-y-4">
      <TimelineCard
        stages={cycle.stages}
        canEdit={cycle.status === "DRAFT"}
        cycleId={cycle.id}
      />
      <p className="text-sm text-stone-500">
        These stages belong to the same organization-wide appraisal cycle. They are
        not appraisal batches.
      </p>
    </div>
  );
}

function HrGroupsTab({ cycleId }: { cycleId: string }) {
  const [search, setSearch] = useState("");
  const groupsQuery = useCycleHrGroups(cycleId, search || undefined);
  const groups = groupsQuery.data ?? [];
  const [selectedHrId, setSelectedHrId] = useState<string | undefined>();
  const detailQuery = useHrGroupDetail(cycleId, selectedHrId);
  const allGroupsQuery = useCycleHrGroups(cycleId);
  const [reassignTeam, setReassignTeam] = useState<{
    id: string;
    name: string;
  } | null>(null);

  useEffect(() => {
    if (!selectedHrId && groups[0]) setSelectedHrId(groups[0].id);
  }, [groups, selectedHrId]);

  const detail = detailQuery.data;
  const selectedMeta = groups.find((group) => group.id === selectedHrId);

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <div className="rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">HR Groups</h2>
        </div>
        <Input
          className="mt-3 h-9"
          placeholder="Search HRs..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="mt-3 space-y-1">
          {groupsQuery.isLoading ? (
            <p className="text-sm text-stone-500">Loading…</p>
          ) : groups.length === 0 ? (
            <p className="text-sm text-stone-500">No HR groups found.</p>
          ) : (
            groups.map((group) => (
              <button
                key={group.id}
                type="button"
                onClick={() => setSelectedHrId(group.id)}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-sm",
                  selectedHrId === group.id
                    ? "bg-amber-50 text-stone-900 dark:bg-amber-400/10"
                    : "hover:bg-stone-50 dark:hover:bg-stone-800"
                )}
              >
                <div>
                  <p className="font-medium">
                    {group.label} – {group.name}
                  </p>
                  <p className="text-xs text-stone-500">
                    {group.teamCount} teams • {group.employeeCount} employees
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-stone-400" />
              </button>
            ))
          )}
        </div>
      </div>

      <div className="space-y-4 rounded-xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900">
        {!selectedHrId ? (
          <p className="text-sm text-stone-500">Select an HR group.</p>
        ) : detailQuery.isLoading ? (
          <p className="text-sm text-stone-500">Loading teams…</p>
        ) : detail ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">
                  {selectedMeta?.label ?? "HR"} – {detail.hr.name}
                </h2>
                <p className="text-sm text-stone-500">
                  Handles {detail.teamCount} teams • {detail.employeeCount} employees
                </p>
              </div>
            </div>

            <h3 className="text-sm font-medium">
              Teams under {detail.hr.name}
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs text-stone-500">
                  <tr>
                    <th className="px-2 py-2">Team Name</th>
                    <th className="px-2 py-2">Supervisor</th>
                    <th className="px-2 py-2">Employees</th>
                    <th className="px-2 py-2">Progress</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.teams.map((team) => (
                    <tr
                      key={team.id}
                      className="border-t border-stone-100 dark:border-stone-800"
                    >
                      <td className="px-2 py-3 font-medium">{team.name}</td>
                      <td className="px-2 py-3">
                        {team.supervisor?.name ?? "—"}
                      </td>
                      <td className="px-2 py-3">{team.employeeCount}</td>
                      <td className="px-2 py-3">
                        <div className="w-28">
                          <p className="text-xs">{team.progressPercent}%</p>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-stone-100">
                            <div
                              className="h-full bg-amber-400"
                              style={{ width: `${team.progressPercent}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-3 text-amber-700">{team.status}</td>
                      <td className="px-2 py-3">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setReassignTeam({ id: team.id, name: team.name })
                          }
                        >
                          Reassign HR
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-xl border border-dashed border-stone-300 px-6 py-10 text-center text-sm text-stone-500">
              Select a team to view its employees
            </div>

            {reassignTeam && selectedHrId ? (
              <ReassignHrDialog
                open={Boolean(reassignTeam)}
                onClose={() => setReassignTeam(null)}
                cycleId={cycleId}
                teamId={reassignTeam.id}
                teamName={reassignTeam.name}
                currentHrName={detail.hr.name}
                currentHrId={selectedHrId}
                hrOptions={allGroupsQuery.data ?? []}
                onSuccess={(newHrEmployeeId) => {
                  setSelectedHrId(newHrEmployeeId);
                }}
              />
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

function EmployeesTab({ cycleId }: { cycleId: string }) {
  const departments = useDepartments();
  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [page, setPage] = useState(1);
  const employeesQuery = useCycleEmployees(cycleId, {
    search: search || undefined,
    departmentId: departmentId || undefined,
    page,
    pageSize: 15,
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900 md:grid-cols-3">
        <Input
          placeholder="Search employees"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
        <select
          className={fieldClass}
          value={departmentId}
          onChange={(event) => {
            setDepartmentId(event.target.value);
            setPage(1);
          }}
        >
          <option value="">All departments</option>
          {(departments.data ?? []).map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </select>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setSearch("");
            setDepartmentId("");
            setPage(1);
          }}
        >
          Clear filters
        </Button>
      </div>

      {employeesQuery.isLoading ? (
        <p className="text-sm text-stone-500">Loading employees…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-stone-200 text-xs text-stone-500 dark:border-stone-800">
              <tr>
                <th className="px-3 py-3">Employee</th>
                <th className="px-3 py-3">Employee ID</th>
                <th className="px-3 py-3">Department</th>
                <th className="px-3 py-3">Team</th>
                <th className="px-3 py-3">Supervisor</th>
                <th className="px-3 py-3">Progress</th>
                <th className="px-3 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {(employeesQuery.data?.employees ?? []).map((employee) => (
                <tr
                  key={employee.id}
                  className="border-b border-stone-100 dark:border-stone-800"
                >
                  <td className="px-3 py-3 font-medium">{employee.name}</td>
                  <td className="px-3 py-3">{employee.employeeId}</td>
                  <td className="px-3 py-3">{employee.department?.name ?? "—"}</td>
                  <td className="px-3 py-3">{employee.team?.name ?? "—"}</td>
                  <td className="px-3 py-3">
                    {employee.supervisor?.name ?? "—"}
                  </td>
                  <td className="px-3 py-3">{employee.progressPercent}%</td>
                  <td className="px-3 py-3">
                    <StatusBadge status={String(employee.status)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {employeesQuery.data ? (
            <div className="p-3">
              <Pagination
                page={employeesQuery.data.page}
                totalPages={employeesQuery.data.totalPages}
                total={employeesQuery.data.total}
                onPageChange={setPage}
              />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function SettingsTab({
  cycleId,
  canEditConfig,
}: {
  cycleId: string;
  canEditConfig: boolean;
}) {
  const cycleQuery = useAppraisalCycle(cycleId);
  const cycle = cycleQuery.data;
  const updateCycle = useUpdateCycle(cycleId);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [stages, setStages] = useState<
    Array<{ key: string; title: string; startDate: string; endDate: string }>
  >([]);

  if (!cycle) return null;

  function startEdit() {
    setName(cycle!.name);
    setDescription(cycle!.description ?? "");
    setStartDate(toDateInputValue(cycle!.startDate));
    setStages(
      cycle!.stages.map((stage) => ({
        key: stage.key,
        title: stage.title,
        startDate: toDateInputValue(stage.startDate),
        endDate: toDateInputValue(stage.endDate),
      }))
    );
    setEditing(true);
  }

  async function save() {
    await updateCycle.mutateAsync({
      name,
      description,
      startDate,
      stages,
    });
    setEditing(false);
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Cycle settings</h2>
        {canEditConfig && !editing ? (
          <Button type="button" size="sm" variant="outline" onClick={startEdit}>
            Edit draft
          </Button>
        ) : null}
      </div>

      {editing ? (
        <div className="mt-4 space-y-4">
          <div className="space-y-1">
            <Label>Cycle name</Label>
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <textarea
              className="min-h-20 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-950"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Start date</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
            <p className="text-xs text-stone-500">
              End date: {startDate ? formatDate(addOneYearIso(startDate)) : "—"}
            </p>
          </div>
          <div className="space-y-3">
            <p className="text-sm font-medium">Timeline stages</p>
            {stages.map((stage, index) => (
              <div
                key={stage.key}
                className="grid gap-2 rounded-lg border border-stone-200 p-3 sm:grid-cols-3 dark:border-stone-700"
              >
                <p className="text-sm font-medium sm:col-span-3">{stage.title}</p>
                <Input
                  type="date"
                  value={stage.startDate}
                  onChange={(event) =>
                    setStages((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, startDate: event.target.value }
                          : item
                      )
                    )
                  }
                />
                <Input
                  type="date"
                  value={stage.endDate}
                  onChange={(event) =>
                    setStages((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, endDate: event.target.value }
                          : item
                      )
                    )
                  }
                />
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={save} disabled={updateCycle.isPending}>
              Save
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-3 text-sm">
          <Info label="Cycle name" value={cycle.name} />
          <Info
            label="Period"
            value={formatShortDateRange(cycle.startDate, cycle.endDate)}
          />
          <Info
            label="Description"
            value={cycle.description || "No description provided."}
          />
          <p className="text-stone-500">
            {canEditConfig
              ? "Draft settings and timeline can be edited before submission."
              : "Configuration is locked after the cycle is submitted."}
          </p>
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-stone-500">{label}</dt>
      <dd className="mt-1">{value}</dd>
    </div>
  );
}

function StatRow({
  icon,
  iconClass,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  iconClass: string;
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className={cn("rounded-lg p-2", iconClass)}>{icon}</div>
      <div>
        <p className="text-xs text-stone-500">{label}</p>
        <p className="text-lg font-bold">{value}</p>
        <p className="text-xs text-stone-500">{hint}</p>
      </div>
    </div>
  );
}
