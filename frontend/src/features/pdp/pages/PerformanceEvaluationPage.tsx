import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ClipboardCheck, Search } from "lucide-react";
import DashboardLayout from "@/app/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  DashboardError,
  DashboardLoading,
} from "@/features/dashboard/components/DashboardUi";
import { formatShortDate } from "@/features/hr/utils/dates";
import { PdpStatusBadge } from "../components/PdpStatusBadge";
import { EmployeeActivePdpDashboard } from "../components/EmployeeActivePdpDashboard";
import { useEmployeePdp, usePdpBoard } from "../hooks/usePdp";
import type { PdpDetail } from "../services/pdp.api";
import { cn } from "@/lib/utils";

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function PerformanceEvaluationPage() {
  const { employeeId } = useParams<{ employeeId?: string }>();
  if (employeeId) {
    return <EmployeeEvaluationView employeeId={employeeId} />;
  }
  return <EvaluationEmployeeList />;
}

function EvaluationEmployeeList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const boardQuery = usePdpBoard({ page: 1, pageSize: 100, search: search || undefined }, true);
  const data = boardQuery.data;

  const rows = useMemo(() => {
    const items = data?.items ?? [];
    return items.filter((row) => {
      const status = row.pdp?.status;
      return status === "ACTIVE" || status === "ASSIGNED" || Boolean(row.pdp);
    });
  }, [data?.items]);

  return (
    <DashboardLayout>
      {boardQuery.isLoading ? (
        <DashboardLoading />
      ) : boardQuery.isError || !data ? (
        <DashboardError message="Unable to load performance evaluation list." />
      ) : (
        <div className="space-y-5">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Performance Evaluation</h1>
            <p className="mt-1 max-w-2xl text-sm text-stone-500">
              Review assigned employees&apos; live PDP progress, approve submitted sub-goals, and add
              development goals.
            </p>
            <p className="mt-1 text-xs text-stone-400">Appraisal Cycle: {data.cycle.name}</p>
          </div>

          <section className="rounded-2xl border border-stone-200 bg-white p-4">
            <div className="mb-4 flex flex-wrap gap-3">
              <div className="relative min-w-[220px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <input
                  className="h-10 w-full rounded-xl border border-stone-200 bg-white pl-9 pr-3 text-sm"
                  placeholder="Search employee name or ID"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-stone-400">
                  <tr>
                    <th className="px-3 py-2">Employee</th>
                    <th className="px-3 py-2">Employee ID</th>
                    <th className="px-3 py-2">Department</th>
                    <th className="px-3 py-2">PDP Status</th>
                    <th className="px-3 py-2">Overall Progress</th>
                    <th className="px-3 py-2">Pending Reviews</th>
                    <th className="px-3 py-2">Completed Sub-goals</th>
                    <th className="px-3 py-2">Last Updated</th>
                    <th className="px-3 py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-3 py-8 text-center text-stone-500">
                        No assigned employees with a PDP were found.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => (
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
                        <td className="px-3 py-3 text-stone-600">
                          {row.employee.department?.name ?? "—"}
                        </td>
                        <td className="px-3 py-3">
                          {row.pdp ? (
                            <PdpStatusBadge status={row.pdp.status} />
                          ) : (
                            <span className="text-stone-400">No PDP</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-stone-700">
                          {row.pdp ? `${row.pdp.overallProgress ?? 0}%` : "—"}
                        </td>
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
                          {row.pdp
                            ? `${row.pdp.completedSubGoals ?? 0}${
                                row.pdp.totalSubGoals != null ? ` / ${row.pdp.totalSubGoals}` : ""
                              }`
                            : "—"}
                        </td>
                        <td className="px-3 py-3 text-stone-600">
                          {row.pdp ? formatShortDate(row.pdp.updatedAt) : "—"}
                        </td>
                        <td className="px-3 py-3">
                          {row.pdp ? (
                            <Button
                              type="button"
                              size="sm"
                              className="h-8 rounded-lg bg-amber-400 px-3 text-stone-900 hover:bg-amber-300"
                              onClick={() =>
                                navigate(
                                  `/supervisor/performance-evaluation/${row.employee.id}`
                                )
                              }
                            >
                              <ClipboardCheck className="mr-1.5 h-3.5 w-3.5" />
                              View Evaluation
                            </Button>
                          ) : (
                            <span className="text-stone-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </DashboardLayout>
  );
}

export function EmployeeEvaluationView({
  employeeId,
  mode = "supervisor",
  backTo = "/supervisor/performance-evaluation",
  backLabel = "Back to Performance Evaluation",
}: {
  employeeId: string;
  mode?: "supervisor" | "hr";
  backTo?: string;
  backLabel?: string;
}) {
  const pdpQuery = useEmployeePdp(employeeId);
  const [localPdp, setLocalPdp] = useState<PdpDetail | null>(null);
  const pdp = localPdp ?? pdpQuery.data ?? null;

  if (pdpQuery.isLoading && !pdp) {
    return (
      <DashboardLayout>
        <DashboardLoading />
      </DashboardLayout>
    );
  }

  if ((pdpQuery.isError && !pdp) || !pdp) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <Link
            to={backTo}
            className="inline-flex items-center gap-1 text-sm text-sky-700 hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </Link>
          <DashboardError message="Unable to load this employee's PDP for evaluation." />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mb-4">
        <Link
          to={backTo}
          className="inline-flex items-center gap-1 text-sm text-sky-700 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Link>
      </div>
      <EmployeeActivePdpDashboard
        pdp={pdp}
        mode={mode}
        onPdpChange={mode === "supervisor" ? (next) => setLocalPdp(next) : undefined}
      />
    </DashboardLayout>
  );
}
