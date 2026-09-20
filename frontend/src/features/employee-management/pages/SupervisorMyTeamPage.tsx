import { useMemo, useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import { Link } from "react-router-dom";
import DashboardLayout from "@/app/layouts/DashboardLayout";
import { Pagination } from "@/features/hr/components/Pagination";
import { SummaryStat } from "@/features/hr/components/SummaryStat";
import {
  DashboardError,
  DashboardLoading,
} from "@/features/dashboard/components/DashboardUi";
import { useSupervisorTeam } from "@/features/employee-management/hooks/useEmployeeManagement";
import type { TeamMemberRow } from "@/features/employee-management/services/employee-management.api";
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

function PdpCell({ member }: { member: TeamMemberRow }) {
  if (member.pdp.status === "APPROVED" || member.pdp.label === "APPROVED") {
    return (
      <span className="text-xs font-semibold tracking-[0.14em] text-stone-500">
        APPROVED
      </span>
    );
  }
  if (member.pdp.status === "DRAFT" || member.pdp.label === "DRAFT") {
    return (
      <span className="text-xs font-semibold tracking-[0.14em] text-stone-500">
        DRAFT
      </span>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className="w-8 text-xs text-stone-500">{member.pdp.progressPercent}%</span>
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800">
        <div
          className="h-full rounded-full bg-amber-500"
          style={{ width: `${member.pdp.progressPercent}%` }}
        />
      </div>
    </div>
  );
}

export default function SupervisorMyTeamPage() {
  const [search, setSearch] = useState("");
  const [batchId, setBatchId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const params = useMemo(
    () => ({
      search: search || undefined,
      batchId: batchId || undefined,
      departmentId: departmentId || undefined,
      status: status || undefined,
      page,
      pageSize: 10,
    }),
    [search, batchId, departmentId, status, page]
  );

  const query = useSupervisorTeam(params);
  const data = query.data;

  return (
    <DashboardLayout>
      {query.isLoading ? <DashboardLoading /> : null}
      {query.isError ? (
        <DashboardError message="Unable to load your team. Please try again." />
      ) : null}
      {data ? (
        <div className="space-y-5">
          <div>
            <p className="text-xs text-stone-400">Home / My Team</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900 dark:text-white">
              My Team
            </h1>
            <p className="mt-1 text-sm text-stone-500">
              Employees assigned to you in the current appraisal cycle
              {data.cycle ? `. ${data.cycle.name}.` : "."}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryStat label="Total team size" value={data.summary.teamSize} />
            <SummaryStat
              label="Active PDPs"
              value={data.summary.activePdps}
              warn={data.summary.activePdps > 0}
            />
            <SummaryStat
              label="Avg. PDP progress"
              value={`${data.summary.avgPdpProgress}%`}
            />
            <SummaryStat
              label="Completed reviews"
              value={data.summary.completedReviews}
            />
          </div>

          <section className="rounded-[28px] border border-stone-200 bg-white p-4 shadow-[0_16px_40px_rgba(28,25,23,0.04)] dark:border-stone-800 dark:bg-stone-950 sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Search team members..."
                  className="h-10 w-full rounded-xl border border-stone-200 bg-white pl-10 pr-3 text-sm dark:border-stone-700 dark:bg-stone-950"
                />
              </div>
              <select
                className={selectClass}
                value={batchId}
                onChange={(event) => {
                  setBatchId(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">All Batches</option>
                {data.filters.batches.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.name}
                  </option>
                ))}
              </select>
              <select
                className={selectClass}
                value={departmentId}
                onChange={(event) => {
                  setDepartmentId(event.target.value);
                  setPage(1);
                }}
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
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">All Status</option>
                {data.filters.statuses.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-stone-100 text-xs uppercase tracking-wide text-stone-400 dark:border-stone-800">
                    <th className="px-3 py-3 font-medium">Employee</th>
                    <th className="px-3 py-3 font-medium">Role / Department</th>
                    <th className="px-3 py-3 font-medium">Appraisal Batch</th>
                    <th className="px-3 py-3 font-medium">PDP</th>
                    <th className="px-3 py-3 font-medium">Status</th>
                    <th className="px-3 py-3 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {data.employees.map((member) => (
                    <tr
                      key={member.id}
                      className="border-b border-stone-100 last:border-0 dark:border-stone-800"
                    >
                      <td className="px-3 py-3">
                        <Link
                          to={`/supervisor/employee-management/${member.id}`}
                          className="flex items-center gap-3"
                        >
                          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-xs font-semibold text-amber-800">
                            {initials(member.name)}
                          </span>
                          <span>
                            <span className="block font-medium text-stone-900 dark:text-stone-50">
                              {member.name}
                            </span>
                            <span className="block text-xs text-stone-400">
                              {member.employeeId}
                            </span>
                          </span>
                        </Link>
                      </td>
                      <td className="px-3 py-3">
                        <p className="text-stone-800 dark:text-stone-100">
                          Employee
                        </p>
                        <p className="text-xs text-stone-400">
                          {member.department?.name ?? "—"}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        {member.batch ? (
                          <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs text-stone-600 dark:bg-stone-800 dark:text-stone-300">
                            {member.batch.name}
                          </span>
                        ) : (
                          <span className="text-stone-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <PdpCell member={member} />
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                            member.status === "Locked"
                              ? "bg-red-100 text-red-800"
                              : "bg-amber-100 text-amber-800"
                          )}
                        >
                          {member.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Link
                          to={`/supervisor/employee-management/${member.id}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                          aria-label={`View ${member.name}`}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.employees.length === 0 ? (
                <p className="px-3 py-10 text-center text-sm text-stone-500">
                  No team members match the current filters.
                </p>
              ) : null}
            </div>

            <Pagination
              page={data.page}
              totalPages={data.totalPages}
              total={data.total}
              pageSize={data.pageSize}
              itemLabel="employees"
              onPageChange={setPage}
            />
          </section>
        </div>
      ) : null}
    </DashboardLayout>
  );
}
