import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ClipboardCheck, Search } from "lucide-react";
import DashboardLayout from "@/app/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { DashboardError, DashboardLoading } from "@/features/dashboard/components/DashboardUi";
import { formatShortDate } from "@/features/hr/utils/dates";
import { useAuthStore } from "@/store/authStore";
import { PdpStatusBadge } from "../components/PdpStatusBadge";
import { usePdpBoard } from "../hooks/usePdp";
import { EmployeeEvaluationView } from "./PerformanceEvaluationPage";
import { HrManagerEvaluationPage } from "./HrManagerEvaluationPage";
import { cn } from "@/lib/utils";

const BACK = "/hr/performance-evaluation";

export default function HrPerformanceEvaluationPage() {
  const role = useAuthStore((state) => state.user?.role);
  const { employeeId } = useParams<{ employeeId?: string }>();

  if (employeeId) {
    return (
      <EmployeeEvaluationView
        employeeId={employeeId}
        mode="hr"
        backTo={BACK}
        backLabel="Back to Performance Evaluation"
      />
    );
  }

  if (role === "HR_MANAGER") return <HrManagerEvaluationPage />;
  return <HrEvaluationList />;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function HrEvaluationList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const boardQuery = usePdpBoard(
    { page: 1, pageSize: 2000, search: search || undefined, organisation: "true" },
    true
  );
  const data = boardQuery.data;

  const groups = useMemo(() => {
    const map = new Map<string, NonNullable<typeof data>["items"]>();
    for (const row of data?.items ?? []) {
      const department = row.employee.department?.name?.trim() || "Unassigned";
      const list = map.get(department) ?? [];
      list.push(row);
      map.set(department, list);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([department, rows]) => ({
        department,
        rows: rows.sort((left, right) => left.employee.name.localeCompare(right.employee.name)),
      }));
  }, [data]);

  return (
    <DashboardLayout>
      {boardQuery.isLoading ? (
        <DashboardLoading />
      ) : boardQuery.isError || !data ? (
        <DashboardError message="Unable to load performance evaluation." />
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-semibold tracking-tight">Performance Evaluation</h1>
                <span className="rounded-full border border-stone-300 bg-stone-50 px-3 py-1 text-xs font-semibold text-stone-700">
                  View Only
                </span>
              </div>
              <p className="mt-1 max-w-2xl text-sm text-stone-500">
                Review PDP progress for employees in your HR scope. Approval and goal changes stay with the supervisor.
              </p>
              <p className="mt-1 text-xs text-stone-400">Appraisal Cycle: {data.cycle.name}</p>
            </div>
          </div>

          <section className="rounded-2xl border border-stone-200 bg-white p-4">
            <div className="relative mb-4 max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input
                className="h-10 w-full rounded-xl border border-stone-200 bg-white pl-9 pr-3 text-sm"
                placeholder="Search employee name or ID"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            <div className="space-y-6">
              {groups.length === 0 ? (
                <p className="py-8 text-center text-sm text-stone-500">No employees found.</p>
              ) : (
                groups.map((group) => (
                  <div key={group.department}>
                    <div className="mb-2 flex items-center gap-3">
                      <h2 className="text-base font-semibold text-stone-900">{group.department}</h2>
                      <div className="h-px flex-1 bg-stone-200" />
                      <span className="text-xs text-stone-400">{group.rows.length}</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left text-sm">
                        <thead className="text-xs uppercase tracking-wide text-stone-400">
                          <tr>
                            <th className="px-3 py-2">Employee</th>
                            <th className="px-3 py-2">Employee ID</th>
                            <th className="px-3 py-2">Department</th>
                            <th className="px-3 py-2">Team</th>
                            <th className="px-3 py-2">Supervisor</th>
                            <th className="px-3 py-2">PDP Status</th>
                            <th className="px-3 py-2">Overall Progress</th>
                            <th className="px-3 py-2">Pending Sub-goal Reviews</th>
                            <th className="px-3 py-2">Last Updated</th>
                            <th className="px-3 py-2">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.rows.map((row) => (
                            <tr key={row.employee.id} className="border-t border-stone-100">
                              <td className="px-3 py-3">
                                <div className="flex items-center gap-3">
                                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 text-xs font-semibold text-stone-600">
                                    {initials(row.employee.name)}
                                  </span>
                                  <p className="font-medium">{row.employee.name}</p>
                                </div>
                              </td>
                              <td className="px-3 py-3 text-stone-600">{row.employee.employeeId}</td>
                              <td className="px-3 py-3 text-stone-600">{row.employee.department?.name ?? "—"}</td>
                              <td className="px-3 py-3 text-stone-600">{row.employee.team?.name ?? "—"}</td>
                              <td className="px-3 py-3 text-stone-600">{row.employee.supervisor?.name ?? "—"}</td>
                              <td className="px-3 py-3">
                                {row.pdp ? <PdpStatusBadge status={row.pdp.status} /> : <span className="text-stone-400">No PDP</span>}
                              </td>
                              <td className="px-3 py-3">{row.pdp ? `${row.pdp.overallProgress ?? 0}%` : "—"}</td>
                              <td className="px-3 py-3">
                                <span
                                  className={cn(
                                    "rounded-full px-2 py-0.5 text-xs font-medium",
                                    (row.pdp?.pendingReviews ?? 0) > 0
                                      ? "bg-sky-50 text-sky-800"
                                      : "bg-stone-100 text-stone-500"
                                  )}
                                >
                                  {row.pdp?.pendingReviews ?? 0}
                                </span>
                              </td>
                              <td className="px-3 py-3 text-stone-600">
                                {row.pdp ? formatShortDate(row.pdp.updatedAt) : "—"}
                              </td>
                              <td className="px-3 py-3">
                                <Button
                                  type="button"
                                  size="sm"
                                  className="h-8 rounded-lg bg-amber-400 px-3 text-stone-900 hover:bg-amber-300"
                                  onClick={() => navigate(`${BACK}/${row.employee.id}`)}
                                >
                                  <ClipboardCheck className="mr-1.5 h-3.5 w-3.5" />
                                  View Evaluation
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      )}
    </DashboardLayout>
  );
}
