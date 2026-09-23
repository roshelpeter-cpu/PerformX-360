import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ClipboardCheck } from "lucide-react";
import DashboardLayout from "@/app/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { DashboardError, DashboardLoading } from "@/features/dashboard/components/DashboardUi";
import { MetricCard } from "@/features/employee-management/components/MetricCard";
import { pdpApi } from "../services/pdp.api";
import { PdpStatusBadge } from "../components/PdpStatusBadge";
import { cn } from "@/lib/utils";

export function HrManagerEvaluationPage() {
  const navigate = useNavigate();
  const [department, setDepartment] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["pdps", "evaluation-overview"],
    queryFn: async () => (await pdpApi.getEvaluationOverview()).overview,
  });

  const data = query.data;
  const selected = data?.departments.find((item) => item.name === department) ?? null;

  return (
    <DashboardLayout>
      {query.isLoading ? (
        <DashboardLoading />
      ) : query.isError || !data ? (
        <DashboardError message="Unable to load the organisation performance evaluation." />
      ) : (
        <div className="space-y-5">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Performance Evaluation</h1>
            <p className="mt-1 max-w-3xl text-sm text-stone-500">
              Organisation-wide view of PDP progress and self reviews. This page is for monitoring. Sub-goal approval stays with supervisors.
            </p>
            <p className="mt-1 text-xs text-stone-400">Appraisal Cycle: {data.cycle.name}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard icon={<ClipboardCheck className="h-5 w-5" />} label="Total Employees" value={data.kpis.totalEmployees} tone="slate" />
            <MetricCard icon={<ClipboardCheck className="h-5 w-5" />} label="Employees with PDPs" value={data.kpis.employeesWithPdps} tone="blue" />
            <MetricCard icon={<ClipboardCheck className="h-5 w-5" />} label="Average PDP Progress" value={`${data.kpis.averageProgress}%`} tone="amber" />
            <MetricCard icon={<ClipboardCheck className="h-5 w-5" />} label="Pending Supervisor Reviews" value={data.kpis.pendingSupervisorReviews} tone="amber" />
            <MetricCard icon={<ClipboardCheck className="h-5 w-5" />} label="Completed Self Reviews" value={data.kpis.completedSelfReviews} tone="green" />
            <MetricCard icon={<ClipboardCheck className="h-5 w-5" />} label="Pending Self Reviews" value={data.kpis.pendingSelfReviews} tone="blue" />
            <MetricCard icon={<ClipboardCheck className="h-5 w-5" />} label="Completed Evaluations" value={data.kpis.completedEvaluations} tone="green" />
            <MetricCard icon={<ClipboardCheck className="h-5 w-5" />} label="Requiring Attention" value={data.kpis.requiringAttention} tone="red" />
          </div>

          <section className="rounded-2xl border border-stone-200 bg-white p-4">
            <h2 className="font-semibold text-stone-900">By department</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-stone-400">
                  <tr>
                    <th className="px-3 py-2">Department</th>
                    <th className="px-3 py-2">Employees</th>
                    <th className="px-3 py-2">Avg PDP Progress</th>
                    <th className="px-3 py-2">Self Reviews</th>
                    <th className="px-3 py-2">Pending Reviews</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.departments.map((row) => (
                    <tr
                      key={row.name}
                      className={cn(
                        "cursor-pointer border-t border-stone-100 hover:bg-stone-50",
                        department === row.name && "bg-amber-50"
                      )}
                      onClick={() => setDepartment(row.name)}
                    >
                      <td className="px-3 py-3 font-medium">{row.name}</td>
                      <td className="px-3 py-3">{row.employees}</td>
                      <td className="px-3 py-3">{row.averageProgress}%</td>
                      <td className="px-3 py-3">
                        {row.selfReviewsSubmitted} / {row.employees}
                      </td>
                      <td className="px-3 py-3">{row.pendingReviews}</td>
                      <td className="px-3 py-3">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-medium",
                            row.status === "On track" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"
                          )}
                        >
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {selected ? (
            <section className="rounded-2xl border border-stone-200 bg-white p-4">
              <h2 className="font-semibold text-stone-900">{selected.name}</h2>
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-stone-400">
                    <tr>
                      <th className="px-3 py-2">Employee</th>
                      <th className="px-3 py-2">Employee ID</th>
                      <th className="px-3 py-2">Team</th>
                      <th className="px-3 py-2">Supervisor</th>
                      <th className="px-3 py-2">PDP Status</th>
                      <th className="px-3 py-2">Progress</th>
                      <th className="px-3 py-2">Pending Reviews</th>
                      <th className="px-3 py-2">Self Review</th>
                      <th className="px-3 py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.people.map((person) => (
                      <tr key={person.id} className="border-t border-stone-100">
                        <td className="px-3 py-3 font-medium">{person.name}</td>
                        <td className="px-3 py-3 text-stone-600">{person.employeeId}</td>
                        <td className="px-3 py-3 text-stone-600">{person.team}</td>
                        <td className="px-3 py-3 text-stone-600">{person.supervisor}</td>
                        <td className="px-3 py-3">
                          <PdpStatusBadge status={person.pdpStatus} />
                        </td>
                        <td className="px-3 py-3">{person.progress}%</td>
                        <td className="px-3 py-3">{person.pendingReviews}</td>
                        <td className="px-3 py-3 text-stone-600">{person.selfReviewStatus.replace(/_/g, " ")}</td>
                        <td className="px-3 py-3">
                          <Button
                            type="button"
                            size="sm"
                            className="h-8 rounded-lg bg-amber-400 px-3 text-stone-900 hover:bg-amber-300"
                            onClick={() => navigate(`/hr/performance-evaluation/${person.id}?view=pdp`)}
                          >
                            View Evaluation
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          <section className="rounded-2xl border border-stone-200 bg-white p-4">
            <h2 className="font-semibold text-stone-900">Requiring attention</h2>
            <ul className="mt-3 divide-y divide-stone-100">
              {data.attention.length === 0 ? (
                <li className="py-3 text-sm text-stone-500">No employees currently require attention.</li>
              ) : (
                data.attention.map((person) => (
                  <li key={person.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                    <div>
                      <p className="font-medium">{person.name}</p>
                      <p className="text-xs text-stone-500">
                        {person.employeeId} · {person.department} · {person.issue}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/hr/performance-evaluation/${person.id}?view=pdp`)}
                    >
                      View
                    </Button>
                  </li>
                ))
              )}
            </ul>
          </section>
        </div>
      )}
    </DashboardLayout>
  );
}
