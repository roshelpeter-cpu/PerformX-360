import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ClipboardCheck, Search } from "lucide-react";
import DashboardLayout from "@/app/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { DashboardError, DashboardLoading } from "@/features/dashboard/components/DashboardUi";
import { PdpStatusBadge } from "@/features/pdp/components/PdpStatusBadge";
import { EmployeeActivePdpDashboard } from "@/features/pdp/components/EmployeeActivePdpDashboard";
import { useEmployeePdp, usePdpBoard } from "@/features/pdp/hooks/usePdp";
import type { PdpDetail } from "@/features/pdp/services/pdp.api";
import { EvaluationPackageCard } from "../components/EvaluationPackageCard";

export default function SupervisorReviewPage() {
  const { employeeId } = useParams<{ employeeId?: string }>();
  if (employeeId) return <SupervisorReviewDetail employeeId={employeeId} />;
  return <SupervisorReviewList />;
}

function SupervisorReviewList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const board = usePdpBoard({ page: 1, pageSize: 200, search: search || undefined }, true);
  const rows = useMemo(() => board.data?.items ?? [], [board.data]);

  return (
    <DashboardLayout>
      {board.isLoading ? (
        <DashboardLoading />
      ) : board.isError || !board.data ? (
        <DashboardError message="Unable to load supervisor review." />
      ) : (
        <div className="space-y-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Supervisor Review</h1>
            <p className="mt-1 text-sm text-stone-500">Employees assigned to you. Approve sub-goals, add goals, and record the supervisor decision.</p>
          </div>
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input
              className="h-10 w-full rounded-xl border border-stone-200 pl-9 pr-3 text-sm"
              placeholder="Search employee"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-stone-400">
                <tr>
                  <th className="px-3 py-2">Employee</th>
                  <th className="px-3 py-2">Employee ID</th>
                  <th className="px-3 py-2">Department</th>
                  <th className="px-3 py-2">Team</th>
                  <th className="px-3 py-2">PDP status</th>
                  <th className="px-3 py-2">PDP progress</th>
                  <th className="px-3 py-2">Evaluation status</th>
                  <th className="px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.employee.id} className="border-t border-stone-100">
                    <td className="px-3 py-3 font-medium">{row.employee.name}</td>
                    <td className="px-3 py-3">{row.employee.employeeId}</td>
                    <td className="px-3 py-3">{row.employee.department?.name ?? "—"}</td>
                    <td className="px-3 py-3">{row.employee.team?.name ?? "—"}</td>
                    <td className="px-3 py-3">{row.pdp ? <PdpStatusBadge status={row.pdp.status} /> : "Not Started"}</td>
                    <td className="px-3 py-3">{row.pdp ? `${row.pdp.overallProgress ?? 0}%` : "—"}</td>
                    <td className="px-3 py-3">{(row.pdp?.pendingReviews ?? 0) > 0 ? "Awaiting Supervisor Approval" : row.pdp ? "Pending" : "Not Started"}</td>
                    <td className="px-3 py-3">
                      <Button type="button" size="sm" className="bg-amber-400 text-stone-900 hover:bg-amber-300" onClick={() => navigate(`/supervisor/review/${row.employee.id}`)}>
                        <ClipboardCheck className="mr-1.5 h-3.5 w-3.5" />
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

function SupervisorReviewDetail({ employeeId }: { employeeId: string }) {
  const pdpQuery = useEmployeePdp(employeeId);
  const [localPdp, setLocalPdp] = useState<PdpDetail | null>(null);
  const pdp = localPdp ?? pdpQuery.data ?? null;

  return (
    <DashboardLayout>
      <div className="mb-4">
        <Link to="/supervisor/review" className="inline-flex items-center gap-1 text-sm text-sky-700 hover:underline">
          <ArrowLeft className="h-4 w-4" />
          Back to Supervisor Review
        </Link>
      </div>
      <EvaluationPackageCard employeeId={employeeId} canDecide />
      {pdpQuery.isLoading && !pdp ? (
        <DashboardLoading />
      ) : pdp ? (
        <EmployeeActivePdpDashboard pdp={pdp} mode="supervisor" onPdpChange={setLocalPdp} />
      ) : (
        <DashboardError message="This employee does not have a PDP in the active cycle." />
      )}
    </DashboardLayout>
  );
}
