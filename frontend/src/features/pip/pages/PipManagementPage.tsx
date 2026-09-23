import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/app/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { DashboardError, DashboardLoading } from "@/features/dashboard/components/DashboardUi";
import { CreatePdpModal, type CreatePdpEmployee } from "@/features/pdp/components/CreatePdpModal";
import { useAuthStore } from "@/store/authStore";
import { getPipPathForRole } from "@/constants/roles";
import type { UserRole } from "@/features/auth/types";
import { pipApi, type PipBoardRow } from "../services/pip.api";

export default function PipManagementPage() {
  const user = useAuthStore((state) => state.user);
  const role = user?.role as UserRole;
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: ["pips", "board", user?.id],
    queryFn: async () => (await pipApi.getBoard()).board,
  });
  const [createRow, setCreateRow] = useState<PipBoardRow | null>(null);
  const isHr = role === "HR" || role === "HR_MANAGER";
  const basePath = getPipPathForRole(role);

  const rows = query.data?.items ?? [];
  const selectedEmployee: CreatePdpEmployee | null = useMemo(() => {
    if (!createRow) return null;
    return {
      id: createRow.employee.id,
      employeeId: createRow.employee.employeeId,
      name: createRow.employee.name,
      department: { id: createRow.employee.department, name: createRow.employee.department },
    };
  }, [createRow]);

  return (
    <DashboardLayout>
      {query.isLoading ? (
        <DashboardLoading />
      ) : query.isError || !query.data ? (
        <DashboardError message="Unable to load PIP management." />
      ) : (
        <div className="space-y-5">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">PIP Management</h1>
            <p className="mt-1 max-w-3xl text-sm text-stone-500">
              {isHr
                ? "Review Performance Improvement Plans and complete HR approval. Goal editing stays with the supervisor."
                : "Create and manage PIPs using the same draft, employee review, and HR approval workflow as PDP."}
            </p>
            <p className="text-xs text-stone-400">Appraisal Cycle: {query.data.cycle.name}</p>
          </div>

          <section className="rounded-2xl border border-stone-200 bg-white p-4">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-stone-400">
                  <tr>
                    <th className="px-3 py-2">Employee</th>
                    <th className="px-3 py-2">ID</th>
                    <th className="px-3 py-2">Department</th>
                    {isHr ? <th className="px-3 py-2">Supervisor</th> : <th className="px-3 py-2">Team</th>}
                    <th className="px-3 py-2">Final Score</th>
                    <th className="px-3 py-2">Performance Band</th>
                    {!isHr ? <th className="px-3 py-2">Current PDP</th> : null}
                    {!isHr ? <th className="px-3 py-2">Appraisal status</th> : null}
                    <th className="px-3 py-2">PIP Status</th>
                    {isHr ? <th className="px-3 py-2">Created Date</th> : null}
                    <th className="px-3 py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td className="px-3 py-6 text-stone-500" colSpan={9}>
                        No PIP candidates were found.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <tr key={row.employee.id} className="border-t border-stone-100">
                        <td className="px-3 py-3 font-medium">{row.employee.name}</td>
                        <td className="px-3 py-3">{row.employee.employeeId}</td>
                        <td className="px-3 py-3">{row.employee.department}</td>
                        <td className="px-3 py-3">{isHr ? row.employee.supervisor : row.employee.team}</td>
                        <td className="px-3 py-3">{row.finalScore.toFixed(1)}</td>
                        <td className="px-3 py-3">{row.performanceBand}</td>
                        {!isHr ? <td className="px-3 py-3">{row.currentPdp}</td> : null}
                        {!isHr ? <td className="px-3 py-3">{row.appraisalStatus}</td> : null}
                        <td className="px-3 py-3">{row.pipStatus}</td>
                        {isHr ? (
                          <td className="px-3 py-3">
                            {row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "—"}
                          </td>
                        ) : null}
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-2">
                            {row.pipId ? (
                              <Button
                                type="button"
                                size="sm"
                                className="bg-amber-400 text-stone-900 hover:bg-amber-300"
                                onClick={() => navigate(`${basePath}/${row.pipId}`)}
                              >
                                {isHr && row.pipRawStatus === "PENDING_HR_REVIEW" ? "Approve" : "View"}
                              </Button>
                            ) : role === "SUPERVISOR" ? (
                              <Button
                                type="button"
                                size="sm"
                                className="bg-amber-400 text-stone-900 hover:bg-amber-300"
                                onClick={() => setCreateRow(row)}
                              >
                                Create PIP
                              </Button>
                            ) : (
                              <span className="text-xs text-stone-400">No PIP yet</span>
                            )}
                          </div>
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

      {selectedEmployee && createRow ? (
        <CreatePdpModal
          employee={selectedEmployee}
          cycleName={query.data?.cycle.name ?? ""}
          planType="PIP"
          performanceInfo={{
            finalScore: createRow.finalScore,
            band: createRow.performanceBand,
            currentPdp: createRow.currentPdp,
            appraisalStatus: createRow.appraisalStatus,
          }}
          onClose={() => setCreateRow(null)}
          onCreated={(pdpId) => {
            setCreateRow(null);
            navigate(`${basePath}/${pdpId}`);
          }}
        />
      ) : null}
    </DashboardLayout>
  );
}
