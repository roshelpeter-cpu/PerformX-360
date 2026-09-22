import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileWarning,
  Plus,
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
import { getPdpPathForRole } from "@/constants/roles";
import { useCreatePdp, usePdpBoard, usePdpOptions } from "../hooks/usePdp";
import { ApprovalBadge, PdpStatusBadge } from "../components/PdpStatusBadge";
import { formatShortDate } from "@/features/hr/utils/dates";
import type { UserRole } from "@/features/auth/types";

const selectClass =
  "h-10 min-w-[160px] rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-700 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-200";

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function TeamPdpsPage() {
  const user = useAuthStore((state) => state.user);
  const role = user?.role as UserRole;
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");

  const params = useMemo(
    () => ({
      search: search || undefined,
      status: status || undefined,
      page,
      pageSize: 12,
    }),
    [search, status, page]
  );

  const boardQuery = usePdpBoard(params, true);
  const optionsQuery = usePdpOptions(role === "SUPERVISOR");
  const createPdp = useCreatePdp();
  const data = boardQuery.data;
  const basePath = getPdpPathForRole(role);

  const subtitle =
    role === "SUPERVISOR"
      ? "Create and manage PDPs for your team, review feedback, and assign approved plans."
      : role === "HR"
        ? "Review and approve PDPs for employees under your HR responsibility."
        : "Oversee PDPs across the organization, review approvals, and manage change requests.";

  return (
    <DashboardLayout>
      {boardQuery.isLoading ? (
        <DashboardLoading />
      ) : boardQuery.isError || !data ? (
        <DashboardError message="Unable to load PDP management." />
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">PDP Management</h1>
              <p className="mt-1 max-w-2xl text-sm text-stone-500">{subtitle}</p>
              <p className="mt-1 text-xs text-stone-400">Appraisal Cycle: {data.cycle.name}</p>
            </div>
            {role === "SUPERVISOR" ? (
              <Button type="button" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" />
                Create PDP
              </Button>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard
              icon={<Users className="h-5 w-5" />}
              label="Total PDPs"
              value={data.kpis.totalPdps}
              tone="slate"
            />
            <MetricCard
              icon={<Clock3 className="h-5 w-5" />}
              label="Pending HR Approval"
              value={data.kpis.pendingHrApproval}
              tone="amber"
            />
            <MetricCard
              icon={<ClipboardList className="h-5 w-5" />}
              label="Awaiting Employee Approval"
              value={data.kpis.awaitingEmployeeApproval}
              tone="blue"
            />
            <MetricCard
              icon={<FileWarning className="h-5 w-5" />}
              label="Change Requests"
              value={data.kpis.changeRequests}
              tone="red"
            />
            <MetricCard
              icon={<CheckCircle2 className="h-5 w-5" />}
              label="Approved & Assigned"
              value={data.kpis.approvedAndAssigned}
              tone="green"
            />
          </div>

          <section className="rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-950">
            <div className="mb-4 flex flex-wrap gap-3">
              <div className="relative min-w-[220px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <input
                  className="h-10 w-full rounded-xl border border-stone-200 bg-white pl-9 pr-3 text-sm dark:border-stone-700 dark:bg-stone-950"
                  placeholder="Search employee name or ID"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                />
              </div>
              <select
                className={selectClass}
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">All statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="PENDING_EMPLOYEE_REVIEW">Pending Employee Approval</option>
                <option value="PENDING_HR_REVIEW">Pending HR Approval</option>
                <option value="CHANGES_REQUESTED">Changes Requested</option>
                <option value="AWAITING_HR_DECISION">Awaiting HR Decision</option>
                <option value="APPROVED">Approved</option>
                <option value="ACTIVE">Active</option>
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-stone-400">
                  <tr>
                    <th className="px-3 py-2">Employee</th>
                    <th className="px-3 py-2">Department</th>
                    {(role === "HR" || role === "HR_MANAGER") && (
                      <th className="px-3 py-2">Supervisor</th>
                    )}
                    {role === "HR_MANAGER" && <th className="px-3 py-2">HR In Charge</th>}
                    <th className="px-3 py-2">PDP Status</th>
                    <th className="px-3 py-2">Employee Approval</th>
                    <th className="px-3 py-2">HR Status</th>
                    <th className="px-3 py-2">Last Updated</th>
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
                      {(role === "HR" || role === "HR_MANAGER") && (
                        <td className="px-3 py-3 text-stone-600">
                          {row.employee.supervisor?.name ?? "—"}
                        </td>
                      )}
                      {role === "HR_MANAGER" && (
                        <td className="px-3 py-3 text-stone-600">{row.employee.hr?.name ?? "—"}</td>
                      )}
                      <td className="px-3 py-3">
                        {row.pdp ? <PdpStatusBadge status={row.pdp.status} /> : (
                          <span className="text-stone-400">No PDP</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <ApprovalBadge status={row.pdp?.employeeApprovalStatus} />
                      </td>
                      <td className="px-3 py-3">
                        <ApprovalBadge status={row.pdp?.hrApprovalStatus} />
                      </td>
                      <td className="px-3 py-3 text-stone-600">
                        {row.pdp ? formatShortDate(row.pdp.updatedAt) : "—"}
                      </td>
                      <td className="px-3 py-3">
                        {row.pdp ? (
                          <Link className="text-sky-600 hover:underline" to={`${basePath}/${row.pdp.id}`}>
                            View
                          </Link>
                        ) : role === "SUPERVISOR" ? (
                          <button
                            type="button"
                            className="text-sky-600 hover:underline"
                            onClick={() => {
                              setSelectedEmployeeId(row.employee.id);
                              setCreateOpen(true);
                            }}
                          >
                            Create PDP
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
      )}

      {createOpen && role === "SUPERVISOR" ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-5 shadow-xl dark:border-stone-800 dark:bg-stone-950">
            <h2 className="text-lg font-semibold">Create PDP</h2>
            <p className="mt-1 text-sm text-stone-500">
              Select a team member to create a draft Professional Development Plan.
            </p>
            <label className="mt-4 block text-sm">
              Employee
              <select
                className={`${selectClass} mt-1 w-full`}
                value={selectedEmployeeId}
                onChange={(event) => setSelectedEmployeeId(event.target.value)}
              >
                <option value="">Select employee</option>
                {(optionsQuery.data?.employees ?? [])
                  .filter((employee) => !employee.hasPdp)
                  .map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name} ({employee.employeeId})
                    </option>
                  ))}
              </select>
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!selectedEmployeeId || createPdp.isPending}
                onClick={() =>
                  void createPdp
                    .mutateAsync({
                      employeeId: selectedEmployeeId,
                      title: `Professional Development Plan ${new Date().getFullYear()}`,
                      summary: "",
                      goals: [],
                    })
                    .then((pdp) => {
                      setCreateOpen(false);
                      navigate(`${basePath}/${pdp.id}`);
                    })
                }
              >
                Create Draft
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </DashboardLayout>
  );
}
