import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ClipboardCheck, Search } from "lucide-react";
import DashboardLayout from "@/app/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { DashboardError, DashboardLoading } from "@/features/dashboard/components/DashboardUi";
import { formatShortDate } from "@/features/hr/utils/dates";
import { evaluationsApi, type FinalBoardItem } from "@/features/reviews/services/reviews.api";
import { useAuthStore } from "@/store/authStore";
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
        mode="pdp"
        canApproveFinal={false}
        backTo={BACK}
        backLabel="Back to Performance Evaluation"
      />
    );
  }

  if (role === "HR_MANAGER") return <HrManagerEvaluationPage />;
  return <HrEvaluationList />;
}

function listStatus(row: FinalBoardItem) {
  if (!row.pdp) return { label: "No PDP", className: "bg-stone-100 text-stone-600" };
  if (row.pdp.status === "COMPLETED" || row.pdp.progress >= 100) {
    return { label: "Completed", className: "bg-emerald-50 text-emerald-800" };
  }
  if (row.pdp.pendingReviews > 0) return { label: "Awaiting Review", className: "bg-sky-50 text-sky-800" };
  if (row.pdp.status === "DRAFT" || row.pdp.status === "NOT_STARTED") {
    return { label: "PDP Not Started", className: "bg-stone-100 text-stone-600" };
  }
  if (row.pdp.status === "ACTIVE" || row.pdp.status === "APPROVED" || row.pdp.status === "ASSIGNED") {
    return { label: "Active PDP", className: "bg-emerald-50 text-emerald-900" };
  }
  return { label: row.pdp.status.replaceAll("_", " "), className: "bg-amber-50 text-amber-900" };
}

function ListStatus({ row }: { row: FinalBoardItem }) {
  const status = listStatus(row);
  return <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", status.className)}>{status.label}</span>;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function matchesSearch(row: FinalBoardItem, term: string) {
  if (!term) return true;
  return `${row.employee.name} ${row.employee.employeeId} ${row.employee.department} ${row.employee.team}`
    .toLowerCase()
    .includes(term);
}

function EvaluationTable({
  rows,
  empty,
}: {
  rows: FinalBoardItem[];
  empty: string;
}) {
  const navigate = useNavigate();
  return (
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
          {rows.length === 0 ? (
            <tr>
              <td className="px-3 py-6 text-stone-500" colSpan={10}>
                {empty}
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
                <td className="px-3 py-3 text-stone-600">{row.employee.department}</td>
                <td className="px-3 py-3 text-stone-600">{row.employee.team}</td>
                <td className="px-3 py-3 text-stone-600">{row.employee.supervisor}</td>
                <td className="px-3 py-3">
                  <ListStatus row={row} />
                </td>
                <td className="px-3 py-3">{row.pdp ? `${row.pdp.progress}%` : "—"}</td>
                <td className="px-3 py-3">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      (row.pdp?.pendingReviews ?? 0) > 0 ? "bg-sky-50 text-sky-800" : "bg-stone-100 text-stone-500"
                    )}
                  >
                    {row.pdp?.pendingReviews ?? 0}
                  </span>
                </td>
                <td className="px-3 py-3 text-stone-600">{row.pdp ? formatShortDate(row.pdp.updatedAt) : "—"}</td>
                <td className="px-3 py-3">
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 rounded-lg bg-amber-400 px-3 text-stone-900 hover:bg-amber-300"
                    onClick={() => navigate(`${BACK}/${row.employee.id}`)}
                  >
                    <ClipboardCheck className="mr-1.5 h-3.5 w-3.5" />
                    {row.pdp ? "View Evaluation" : "View"}
                  </Button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function HrEvaluationList() {
  const [search, setSearch] = useState("");
  const boardQuery = useQuery({
    queryKey: ["evaluations", "performance-board"],
    queryFn: async () => (await evaluationsApi.performanceBoard()).board,
  });
  const data = boardQuery.data;
  const term = search.trim().toLowerCase();
  const assigned = (data?.assigned ?? []).filter((row) => matchesSearch(row, term));
  const notAssigned = (data?.notAssigned ?? []).filter((row) => matchesSearch(row, term));

  return (
    <DashboardLayout>
      {boardQuery.isLoading ? (
        <DashboardLoading />
      ) : boardQuery.isError || !data ? (
        <DashboardError message="Unable to load performance evaluation." />
      ) : (
        <div className="space-y-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-semibold tracking-tight">Performance Evaluation</h1>
              <span className="rounded-full border border-stone-300 bg-stone-50 px-3 py-1 text-xs font-semibold text-stone-700">
                View Only
              </span>
            </div>
            <p className="mt-1 max-w-2xl text-sm text-stone-500">
              Demonstration set of assigned and unassigned PDPs. Approval and goal changes stay with the supervisor.
            </p>
            <p className="mt-1 text-xs text-stone-400">Appraisal Cycle: {data.cycle.name}</p>
          </div>
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input
              className="h-10 w-full rounded-xl border border-stone-200 bg-white pl-9 pr-3 text-sm"
              placeholder="Search employee name or ID"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <section className="rounded-2xl border border-stone-200 bg-white p-4">
            <div className="mb-3 flex items-center gap-3">
              <h2 className="text-base font-semibold">A. PDP Assigned</h2>
              <div className="h-px flex-1 bg-stone-200" />
              <span className="text-xs text-stone-400">{assigned.length}</span>
            </div>
            <EvaluationTable rows={assigned} empty="No assigned PDPs in this demonstration set." />
          </section>
          <section className="rounded-2xl border border-stone-200 bg-white p-4">
            <div className="mb-3 flex items-center gap-3">
              <h2 className="text-base font-semibold">B. PDP Not Assigned</h2>
              <div className="h-px flex-1 bg-stone-200" />
              <span className="text-xs text-stone-400">{notAssigned.length}</span>
            </div>
            <EvaluationTable rows={notAssigned} empty="No unassigned employees in this demonstration set." />
          </section>
        </div>
      )}
    </DashboardLayout>
  );
}
