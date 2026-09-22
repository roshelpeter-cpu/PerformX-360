import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileWarning,
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
import { getPdpPathForRole } from "@/constants/roles";
import { usePdpBoard } from "../hooks/usePdp";
import { ApprovalBadge, PdpStatusBadge } from "../components/PdpStatusBadge";
import { CreatePdpModal, type CreatePdpEmployee } from "../components/CreatePdpModal";
import { formatShortDate } from "@/features/hr/utils/dates";
import type { UserRole } from "@/features/auth/types";
import { cn } from "@/lib/utils";

const CATEGORY_TABS: Array<{ key: string; label: string }> = [
  { key: "ALL", label: "All PDPs" },
  { key: "WAITING_HR", label: "Waiting HR Approval" },
  { key: "WAITING_EMPLOYEE", label: "Waiting Employee Approval" },
  { key: "APPROVED", label: "Approved" },
  { key: "COMPLETED", label: "Completed" },
  { key: "DRAFT", label: "Draft" },
  { key: "CHANGES_REQUESTED", label: "Change Requests" },
];

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
  const [category, setCategory] = useState("ALL");
  const [page, setPage] = useState(1);
  const [createEmployee, setCreateEmployee] = useState<CreatePdpEmployee | null>(null);

  const params = useMemo(
    () => ({
      search: search || undefined,
      category: category === "ALL" ? undefined : category,
      page,
      pageSize: 12,
    }),
    [search, category, page]
  );

  const boardQuery = usePdpBoard(params, true);
  const data = boardQuery.data;
  const basePath = getPdpPathForRole(role);
  const showHrTabs = role === "HR" || role === "HR_MANAGER" || role === "SUPERVISOR";

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
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">PDP Management</h1>
            <p className="mt-1 max-w-2xl text-sm text-stone-500">{subtitle}</p>
            <p className="mt-1 text-xs text-stone-400">Appraisal Cycle: {data.cycle.name}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard icon={<Users className="h-5 w-5" />} label="Total PDPs" value={data.kpis.totalPdps} tone="slate" />
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

          {showHrTabs ? (
            <div className="flex flex-wrap gap-2">
              {CATEGORY_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={cn(
                    "rounded-full px-3 py-1.5 text-sm",
                    category === tab.key
                      ? "bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-950"
                      : "border border-stone-200 text-stone-600 hover:bg-stone-100 dark:border-stone-700 dark:hover:bg-stone-900"
                  )}
                  onClick={() => {
                    setCategory(tab.key);
                    setPage(1);
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          ) : null}

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
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-stone-400">
                  <tr>
                    <th className="px-3 py-2">Employee</th>
                    <th className="px-3 py-2">Department</th>
                    {(role === "HR" || role === "HR_MANAGER") && <th className="px-3 py-2">Supervisor</th>}
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
                      <td className="px-3 py-3 text-stone-600">{row.employee.department?.name ?? "—"}</td>
                      {(role === "HR" || role === "HR_MANAGER") && (
                        <td className="px-3 py-3 text-stone-600">{row.employee.supervisor?.name ?? "—"}</td>
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
                            onClick={() => setCreateEmployee(row.employee)}
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

      {createEmployee && data ? (
        <CreatePdpModal
          employee={createEmployee}
          cycleName={data.cycle.name}
          onClose={() => setCreateEmployee(null)}
          onCreated={(pdpId) => {
            setCreateEmployee(null);
            navigate(`${basePath}/${pdpId}`);
          }}
        />
      ) : null}
    </DashboardLayout>
  );
}
