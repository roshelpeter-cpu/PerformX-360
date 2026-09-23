import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/app/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { DashboardError, DashboardLoading } from "@/features/dashboard/components/DashboardUi";
import { ApiClientError } from "@/services/api/client";
import { bonusesApi, type BonusRow } from "../services/reviews.api";

export default function BonusCalculationPage() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["bonuses"],
    queryFn: async () => (await bonusesApi.list()).board,
  });
  const [selected, setSelected] = useState<BonusRow | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const calculate = useMutation({
    mutationFn: async (employeeId: string) => (await bonusesApi.calculate(employeeId)).calculation,
    onSuccess: async (calculation) => {
      setSelected(calculation);
      setMessage("Bonus calculated. Review the amount, then authorize.");
      await client.invalidateQueries({ queryKey: ["bonuses"] });
    },
    onError: (error) => setMessage(error instanceof ApiClientError ? error.message : "Unable to calculate the bonus."),
  });
  const authorize = useMutation({
    mutationFn: async (employeeId: string) => (await bonusesApi.authorize(employeeId)).calculation,
    onSuccess: async (calculation) => {
      setSelected(calculation);
      setMessage("Bonus authorized. The employee now appears in Completed.");
      await client.invalidateQueries({ queryKey: ["bonuses"] });
    },
    onError: (error) => setMessage(error instanceof ApiClientError ? error.message : "Unable to authorize the bonus."),
  });

  const data = query.data;

  return (
    <DashboardLayout>
      {query.isLoading ? (
        <DashboardLoading />
      ) : query.isError || !data ? (
        <DashboardError message="Unable to load bonus calculations." />
      ) : (
        <div className="space-y-5">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Bonus Calculation</h1>
            <p className="mt-1 max-w-3xl text-sm text-stone-500">
              {data.formula.interpretation}. Months: 90–100 = 6, 80–89 = 5.5, 70–79 = 5, 60–69 = 4, below 60 = 0.
              Daily amount {data.formula.dailyAmount.toFixed(2)}.
            </p>
            <p className="text-xs text-stone-400">{data.cycle.name}</p>
          </div>
          {message ? <p className="rounded-xl bg-stone-50 px-3 py-2 text-sm">{message}</p> : null}

          <section className="rounded-2xl border border-stone-200 bg-white p-4">
            <div className="mb-3 flex items-center gap-3">
              <h2 className="text-base font-semibold">A. Needs Calculation</h2>
              <div className="h-px flex-1 bg-stone-200" />
              <span className="text-xs text-stone-400">{data.needsCalculation.length}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-stone-400">
                  <tr>
                    <th className="px-3 py-2">Employee</th>
                    <th className="px-3 py-2">Employee ID</th>
                    <th className="px-3 py-2">Final Score</th>
                    <th className="px-3 py-2">Performance Band</th>
                    <th className="px-3 py-2">Bonus status</th>
                    <th className="px-3 py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.needsCalculation.length === 0 ? (
                    <tr>
                      <td className="px-3 py-6 text-stone-500" colSpan={6}>
                        No employees currently need a bonus calculation.
                      </td>
                    </tr>
                  ) : (
                    data.needsCalculation.map((row) => (
                      <tr key={row.employee.id} className="border-t border-stone-100">
                        <td className="px-3 py-3 font-medium">{row.employee.name}</td>
                        <td className="px-3 py-3">{row.employee.employeeId}</td>
                        <td className="px-3 py-3">{row.finalScore.toFixed(1)} / 100</td>
                        <td className="px-3 py-3">{row.band}</td>
                        <td className="px-3 py-3">{row.bonusStatus}</td>
                        <td className="px-3 py-3">
                          <Button
                            type="button"
                            size="sm"
                            className="bg-amber-400 text-stone-900 hover:bg-amber-300"
                            disabled={calculate.isPending}
                            onClick={() => calculate.mutate(row.employee.id)}
                          >
                            Calculate Bonus
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-stone-200 bg-white p-4">
            <div className="mb-3 flex items-center gap-3">
              <h2 className="text-base font-semibold">B. Completed</h2>
              <div className="h-px flex-1 bg-stone-200" />
              <span className="text-xs text-stone-400">{data.completed.length}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-stone-400">
                  <tr>
                    <th className="px-3 py-2">Employee</th>
                    <th className="px-3 py-2">Employee ID</th>
                    <th className="px-3 py-2">Final Score</th>
                    <th className="px-3 py-2">Band</th>
                    <th className="px-3 py-2">Bonus amount</th>
                    <th className="px-3 py-2">Calculation</th>
                    <th className="px-3 py-2">Authorization status</th>
                    <th className="px-3 py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.completed.length === 0 ? (
                    <tr>
                      <td className="px-3 py-6 text-stone-500" colSpan={8}>
                        No authorized bonuses yet.
                      </td>
                    </tr>
                  ) : (
                    data.completed.map((row) => (
                      <tr key={row.id} className="border-t border-stone-100">
                        <td className="px-3 py-3 font-medium">{row.employee.name}</td>
                        <td className="px-3 py-3">{row.employee.employeeId}</td>
                        <td className="px-3 py-3">{row.finalScore.toFixed(1)}</td>
                        <td className="px-3 py-3">{row.band}</td>
                        <td className="px-3 py-3 font-semibold">{row.amount.toFixed(2)}</td>
                        <td className="max-w-xs px-3 py-3 text-stone-600">{row.calculation}</td>
                        <td className="px-3 py-3">Authorized</td>
                        <td className="px-3 py-3">
                          <Button type="button" size="sm" variant="outline" onClick={() => setSelected(row)}>
                            View
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {selected ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/40 p-4">
              <section className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-stone-200 bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-stone-400">Bonus summary</p>
                    <h2 className="text-xl font-semibold">{selected.employee.name}</h2>
                    <p className="text-sm text-stone-500">{selected.employee.employeeId}</p>
                  </div>
                  <Button type="button" variant="outline" onClick={() => setSelected(null)}>
                    Close
                  </Button>
                </div>
                <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Item label="Final score" value={`${selected.finalScore.toFixed(2)} / 100`} />
                  <Item label="Performance band" value={selected.band} />
                  <Item label="Bonus period" value={`${selected.bonusMonths} months`} />
                  <Item label="Fixed daily amount" value={selected.dailyAmount.toFixed(2)} />
                  <Item label="Working days / month" value={String(selected.workingDaysPerMonth)} />
                  <Item label="Bonus amount" value={selected.amount.toFixed(2)} />
                </dl>
                <p className="mt-3 text-sm text-stone-700">{selected.calculation}</p>
                <p className="mt-2 text-sm font-medium">
                  Authorization status: {selected.status === "AUTHORIZED" ? "Authorized" : "Calculated"}
                </p>
                {selected.status !== "AUTHORIZED" ? (
                  <Button
                    type="button"
                    className="mt-4 bg-stone-900 text-white hover:bg-stone-800"
                    disabled={authorize.isPending}
                    onClick={() => authorize.mutate(selected.employee.id)}
                  >
                    {authorize.isPending ? "Authorizing..." : "Authorize Bonus"}
                  </Button>
                ) : null}
              </section>
            </div>
          ) : null}
        </div>
      )}
    </DashboardLayout>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-stone-50 px-3 py-3">
      <p className="text-xs uppercase tracking-wide text-stone-400">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
