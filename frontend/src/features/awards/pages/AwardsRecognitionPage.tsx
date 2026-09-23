import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/app/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { DashboardError, DashboardLoading } from "@/features/dashboard/components/DashboardUi";
import { ApiClientError } from "@/services/api/client";
import { awardsApi, type AwardRow } from "../services/awards.api";

function categoryLabel(category: string) {
  if (category === "OUTSTANDING_PERFORMER") return "Outstanding Performer Award";
  if (category === "EMPLOYEE_OF_THE_YEAR") return "Employee of the Year";
  if (category === "EMPLOYEE_OF_THE_MONTH") return "Employee of the Month";
  return category;
}

export default function AwardsRecognitionPage() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["awards"],
    queryFn: async () => (await awardsApi.list()).board,
  });
  const [selected, setSelected] = useState<AwardRow | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const generate = useMutation({
    mutationFn: async () => (await awardsApi.generate()).board,
    onSuccess: async (board) => {
      setMessage("Award recommendations generated from completed appraisal data.");
      await client.invalidateQueries({ queryKey: ["awards"] });
      if (board.awards[0]) setSelected(board.awards[0]);
    },
    onError: (error) =>
      setMessage(error instanceof ApiClientError ? error.message : "Unable to generate awards."),
  });
  const approve = useMutation({
    mutationFn: async (awardId: string) => (await awardsApi.approve(awardId)).award,
    onSuccess: async (award) => {
      setSelected(award);
      setMessage("Award approved.");
      await client.invalidateQueries({ queryKey: ["awards"] });
    },
    onError: (error) =>
      setMessage(error instanceof ApiClientError ? error.message : "Unable to approve this award."),
  });

  const data = query.data;

  return (
    <DashboardLayout>
      {query.isLoading ? (
        <DashboardLoading />
      ) : query.isError || !data ? (
        <DashboardError message="Unable to load awards and recognition." />
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Awards & Recognition</h1>
              <p className="mt-1 max-w-3xl text-sm text-stone-500">
                Review recommended winners from completed appraisal and final evaluation data. Only HR
                Managers can approve awards.
              </p>
              <p className="text-xs text-stone-400">{data.cycle.name}</p>
            </div>
            <Button
              type="button"
              className="bg-amber-400 text-stone-900 hover:bg-amber-300"
              disabled={generate.isPending}
              onClick={() => generate.mutate()}
            >
              Generate Recommendations
            </Button>
          </div>
          {message ? <p className="rounded-xl bg-stone-50 px-3 py-2 text-sm">{message}</p> : null}

          <section className="rounded-2xl border border-stone-200 bg-white p-4">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-stone-400">
                  <tr>
                    <th className="px-3 py-2">Employee</th>
                    <th className="px-3 py-2">Employee ID</th>
                    <th className="px-3 py-2">Department</th>
                    <th className="px-3 py-2">Final Score</th>
                    <th className="px-3 py-2">Performance Band</th>
                    <th className="px-3 py-2">Award</th>
                    <th className="px-3 py-2">Generated Reason</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.awards.length === 0 ? (
                    <tr>
                      <td className="px-3 py-6 text-stone-500" colSpan={9}>
                        No award recommendations yet. Generate them from current appraisal results.
                      </td>
                    </tr>
                  ) : (
                    data.awards.map((row) => (
                      <tr key={row.id} className="border-t border-stone-100">
                        <td className="px-3 py-3 font-medium">{row.employee.name}</td>
                        <td className="px-3 py-3">{row.employee.employeeId}</td>
                        <td className="px-3 py-3">{row.employee.department}</td>
                        <td className="px-3 py-3">{row.finalScore.toFixed(1)} / 100</td>
                        <td className="px-3 py-3">{row.performanceBand}</td>
                        <td className="px-3 py-3">{categoryLabel(row.category)}</td>
                        <td className="max-w-xs px-3 py-3 text-stone-600">{row.reason}</td>
                        <td className="px-3 py-3">
                          <span
                            className={
                              row.status === "APPROVED"
                                ? "rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800"
                                : "rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800"
                            }
                          >
                            {row.status === "APPROVED" ? "Approved" : "Pending"}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-2">
                            <Button type="button" size="sm" variant="outline" onClick={() => setSelected(row)}>
                              View
                            </Button>
                            {row.status !== "APPROVED" ? (
                              <Button
                                type="button"
                                size="sm"
                                className="bg-amber-400 text-stone-900 hover:bg-amber-300"
                                disabled={approve.isPending}
                                onClick={() => approve.mutate(row.id)}
                              >
                                Approve Award
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {selected ? (
            <section className="rounded-2xl border border-amber-200 bg-[#fff8e8] p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Award summary</p>
              <h2 className="mt-1 text-2xl font-semibold">{selected.title}</h2>
              <p className="mt-2 text-sm text-stone-600">{selected.reason}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Employee" value={`${selected.employee.name} (${selected.employee.employeeId})`} />
                <Field label="Department" value={selected.employee.department} />
                <Field label="Final score" value={`${selected.finalScore.toFixed(1)} / 100`} />
                <Field label="Status" value={selected.status === "APPROVED" ? "Approved" : "Pending"} />
              </div>
            </section>
          ) : null}
        </div>
      )}
    </DashboardLayout>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-stone-400">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}
