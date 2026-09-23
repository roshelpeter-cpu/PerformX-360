import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/app/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { DashboardError, DashboardLoading, StatCard } from "@/features/dashboard/components/DashboardUi";
import { leadershipApi, type LeadershipFilters } from "../services/leadership.api";

export default function LeadershipReportsPage() {
  const [filters, setFilters] = useState<LeadershipFilters>({});
  const query = useQuery({
    queryKey: ["leadership", "reports", filters],
    queryFn: async () => (await leadershipApi.reports(filters)).report,
  });
  const data = query.data;
  const teams = useMemo(() => {
    const department = data?.filters.departments.find((item) => item.id === filters.departmentId);
    return department?.teams ?? [];
  }, [data, filters.departmentId]);

  return (
    <DashboardLayout>
      {query.isLoading ? <DashboardLoading /> : null}
      {query.isError || !data ? (
        query.isLoading ? null : <DashboardError message="Unable to load leadership reports." />
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Reports</h1>
              <p className="mt-1 max-w-3xl text-sm text-stone-500">
                Filter organisation performance, PDP progress, reviews, PIPs, promotions, and awards.
                Leadership cannot approve operational items from this workspace.
              </p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => void leadershipApi.download(filters, "pdf")}>
                Download PDF
              </Button>
              <Button
                type="button"
                className="bg-amber-400 text-stone-900 hover:bg-amber-300"
                onClick={() => void leadershipApi.download(filters, "docx")}
              >
                Download Word
              </Button>
            </div>
          </div>

          <section className="grid gap-3 rounded-2xl border border-stone-200 bg-white p-4 md:grid-cols-3 xl:grid-cols-7">
            <Select
              label="Department"
              value={filters.departmentId ?? ""}
              onChange={(value) => setFilters((current) => ({ ...current, departmentId: value || undefined, teamId: undefined }))}
              options={data.filters.departments.map((item) => ({ value: item.id, label: item.name }))}
            />
            <Select
              label="Team"
              value={filters.teamId ?? ""}
              onChange={(value) => setFilters((current) => ({ ...current, teamId: value || undefined }))}
              options={teams.map((item) => ({ value: item.id, label: item.name }))}
            />
            <Select
              label="Employee"
              value={filters.employeeId ?? ""}
              onChange={(value) => setFilters((current) => ({ ...current, employeeId: value || undefined }))}
              options={data.filters.employees.map((item) => ({
                value: item.id,
                label: `${item.name} (${item.employeeId})`,
              }))}
            />
            <Select
              label="Performance band"
              value={filters.band ?? ""}
              onChange={(value) => setFilters((current) => ({ ...current, band: value || undefined }))}
              options={data.filters.bands.map((item) => ({ value: item, label: item }))}
            />
            <Select
              label="Appraisal cycle"
              value={filters.cycleId ?? ""}
              onChange={(value) => setFilters((current) => ({ ...current, cycleId: value || undefined }))}
              options={data.cycles.map((item) => ({ value: item.id, label: item.name }))}
            />
            <Select
              label="Status"
              value={filters.status ?? ""}
              onChange={(value) => setFilters((current) => ({ ...current, status: value || undefined }))}
              options={[
                { value: "ACTIVE", label: "Active PDP" },
                { value: "FINAL_APPROVED", label: "Final approved" },
                { value: "SUBMITTED", label: "Self review submitted" },
              ]}
            />
            <label className="text-xs uppercase tracking-wide text-stone-400">
              Date range
              <div className="mt-1 grid grid-cols-2 gap-1">
                <input
                  type="date"
                  className="h-10 rounded-xl border border-stone-300 px-2 text-sm text-stone-800"
                  value={filters.from ?? ""}
                  onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value || undefined }))}
                />
                <input
                  type="date"
                  className="h-10 rounded-xl border border-stone-300 px-2 text-sm text-stone-800"
                  value={filters.to ?? ""}
                  onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value || undefined }))}
                />
              </div>
            </label>
          </section>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard label="Employees" value={data.summary.employees} />
            <StatCard label="Average score" value={data.summary.averageScore} />
            <StatCard label="PDP progress" value={`${data.summary.averagePdp}%`} />
            <StatCard label="PIPs" value={data.summary.pips} />
            <StatCard label="Awards" value={data.summary.awards} />
          </div>

          <section className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-stone-400">
                <tr>
                  <th className="px-3 py-2">Employee</th>
                  <th className="px-3 py-2">Department</th>
                  <th className="px-3 py-2">Team</th>
                  <th className="px-3 py-2">Score</th>
                  <th className="px-3 py-2">Band</th>
                  <th className="px-3 py-2">PDP</th>
                  <th className="px-3 py-2">Self</th>
                  <th className="px-3 py-2">Peer</th>
                  <th className="px-3 py-2">Supervisor</th>
                  <th className="px-3 py-2">Final</th>
                  <th className="px-3 py-2">PIP</th>
                  <th className="px-3 py-2">Award</th>
                  <th className="px-3 py-2">Promotion</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.slice(0, 80).map((row) => (
                  <tr key={row.employee.id} className="border-t border-stone-100">
                    <td className="px-3 py-3 font-medium">
                      {row.employee.name}
                      <p className="text-xs text-stone-400">{row.employee.employeeId}</p>
                    </td>
                    <td className="px-3 py-3">{row.employee.department}</td>
                    <td className="px-3 py-3">{row.employee.team}</td>
                    <td className="px-3 py-3">{row.finalScore.toFixed(1)}</td>
                    <td className="px-3 py-3">{row.band}</td>
                    <td className="px-3 py-3">{row.pdpProgress}%</td>
                    <td className="px-3 py-3">{row.selfReview}</td>
                    <td className="px-3 py-3">{row.peerReviews}</td>
                    <td className="px-3 py-3">{row.supervisorReview}</td>
                    <td className="px-3 py-3">{row.finalEvaluation}</td>
                    <td className="px-3 py-3">{row.pipStatus}</td>
                    <td className="px-3 py-3">{row.award}</td>
                    <td className="px-3 py-3">{row.promotion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}
    </DashboardLayout>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="text-xs uppercase tracking-wide text-stone-400">
      {label}
      <select
        className="mt-1 h-10 w-full rounded-xl border border-stone-300 px-3 text-sm text-stone-800"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">All</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
