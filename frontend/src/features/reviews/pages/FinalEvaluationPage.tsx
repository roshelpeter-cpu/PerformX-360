import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ClipboardCheck } from "lucide-react";
import DashboardLayout from "@/app/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { DashboardError, DashboardLoading } from "@/features/dashboard/components/DashboardUi";
import { EmployeeActivePdpDashboard } from "@/features/pdp/components/EmployeeActivePdpDashboard";
import { useEmployeePdp } from "@/features/pdp/hooks/usePdp";
import { useAuthStore } from "@/store/authStore";
import { EvaluationPackageCard } from "../components/EvaluationPackageCard";
import { evaluationsApi } from "../services/reviews.api";

function listPath(role: string | undefined) {
  return role === "SUPERVISOR" ? "/supervisor/final-evaluation" : "/hr/final-evaluation";
}

export default function FinalEvaluationPage() {
  const role = useAuthStore((state) => state.user?.role);
  const { employeeId } = useParams<{ employeeId?: string }>();
  if (employeeId) return <FinalEvaluationDetail employeeId={employeeId} />;
  return <FinalEvaluationList backTo={listPath(role)} />;
}

function FinalEvaluationList({ backTo }: { backTo: string }) {
  const role = useAuthStore((state) => state.user?.role);
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: ["evaluations", "final-board", role],
    queryFn: async () => (await evaluationsApi.finalBoard()).board,
  });

  return (
    <DashboardLayout>
      {query.isLoading ? (
        <DashboardLoading />
      ) : query.isError || !query.data ? (
        <DashboardError message="Unable to load final evaluations." />
      ) : (
        <div className="space-y-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Final Evaluation</h1>
            <p className="mt-1 max-w-2xl text-sm text-stone-500">
              {role === "HR"
                ? "Completed appraisal packages. Only HR can approve the final appraisal."
                : role === "HR_MANAGER"
                  ? "Organisation view of completed appraisal packages. This page is view only."
                  : "Completed appraisal packages for your team. Final HR approval stays with HR."}
            </p>
            <p className="text-xs text-stone-400">{query.data.cycle.name}</p>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-stone-400">
                <tr>
                  <th className="px-3 py-2">Employee</th>
                  <th className="px-3 py-2">Employee ID</th>
                  <th className="px-3 py-2">Department</th>
                  <th className="px-3 py-2">Self /20</th>
                  <th className="px-3 py-2">Peer /20</th>
                  <th className="px-3 py-2">Supervisor / PDP /60</th>
                  <th className="px-3 py-2">Final /100</th>
                  <th className="px-3 py-2">Band</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {query.data.items.length === 0 ? (
                  <tr>
                    <td className="px-3 py-6 text-stone-500" colSpan={10}>
                      No completed evaluations are available yet.
                    </td>
                  </tr>
                ) : (
                  query.data.items.map((item) => (
                    <tr key={item.employee.id} className="border-t border-stone-100">
                      <td className="px-3 py-3 font-medium">{item.employee.name}</td>
                      <td className="px-3 py-3">{item.employee.employeeId}</td>
                      <td className="px-3 py-3">{item.employee.department}</td>
                      <td className="px-3 py-3">{item.scores.self.toFixed(1)}</td>
                      <td className="px-3 py-3">{item.scores.peer.toFixed(1)}</td>
                      <td className="px-3 py-3">{item.scores.supervisorPdp.toFixed(1)}</td>
                      <td className="px-3 py-3 font-semibold">{item.scores.total.toFixed(1)}</td>
                      <td className="px-3 py-3">{item.scores.band}</td>
                      <td className="px-3 py-3">
                        {item.finalStatus === "FINAL_APPROVED" ? "Approved" : "Ready for review"}
                      </td>
                      <td className="px-3 py-3">
                        <Button
                          type="button"
                          size="sm"
                          className="bg-amber-400 text-stone-900 hover:bg-amber-300"
                          onClick={() => navigate(`${backTo}/${item.employee.id}`)}
                        >
                          <ClipboardCheck className="mr-1.5 h-3.5 w-3.5" />
                          View
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

function FinalEvaluationDetail({ employeeId }: { employeeId: string }) {
  const role = useAuthStore((state) => state.user?.role);
  const backTo = listPath(role);
  const pdpQuery = useEmployeePdp(employeeId);
  const pdp = pdpQuery.data ?? null;

  return (
    <DashboardLayout>
      <div className="mb-4">
        <Link to={backTo} className="inline-flex items-center gap-1 text-sm text-sky-700 hover:underline">
          <ArrowLeft className="h-4 w-4" />
          Back to Final Evaluation
        </Link>
      </div>
      <EvaluationPackageCard
        employeeId={employeeId}
        canApproveFinal={role === "HR"}
        showFullDetail
      />
      {pdp ? <EmployeeActivePdpDashboard pdp={pdp} mode="hr" /> : null}
    </DashboardLayout>
  );
}
