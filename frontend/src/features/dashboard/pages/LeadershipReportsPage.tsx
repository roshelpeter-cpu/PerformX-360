import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Award,
  BarChart3,
  ClipboardList,
  Coins,
  Download,
  Rocket,
  Target,
  Users,
} from "lucide-react";
import DashboardLayout from "@/app/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { DashboardError, DashboardLoading } from "@/features/dashboard/components/DashboardUi";
import { formatShortDateRange } from "@/features/hr/utils/dates";
import { leadershipApi, type LeadershipFilters } from "../services/leadership.api";

const REPORT_CARDS = [
  { type: "PERFORMANCE_SUMMARY", label: "Performance Summary", detail: "Overall performance across employees and departments", icon: BarChart3 },
  { type: "PDP_PROGRESS", label: "PDP Progress Report", detail: "PDP completion and goal achievement status", icon: ClipboardList },
  { type: "AWARDS", label: "Awards & Recognition Report", detail: "List of awards given and recognition trends", icon: Award },
  { type: "BONUS", label: "Bonus Allocation Report", detail: "Bonus distribution by department and performance band", icon: Coins },
  { type: "PROMOTION", label: "Promotion Recommendations", detail: "Employees recommended for promotion", icon: Rocket },
  { type: "DEPARTMENT_COMPARISON", label: "Department Comparison", detail: "Compare performance and development across departments", icon: Target },
] as const;

function formatRs(value: number) {
  if (value >= 1_000_000) return `Rs. ${(value / 1_000_000).toFixed(1)}M`;
  return `Rs. ${Math.round(value).toLocaleString()}`;
}

function reportTypeLabel(type: string) {
  return REPORT_CARDS.find((item) => item.type === type)?.label ?? type;
}

export default function LeadershipReportsPage() {
  const client = useQueryClient();
  const [filters, setFilters] = useState<LeadershipFilters>({ reportType: "PERFORMANCE_SUMMARY" });
  const [applied, setApplied] = useState<LeadershipFilters>({ reportType: "PERFORMANCE_SUMMARY" });
  const [downloadMessage, setDownloadMessage] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["leadership", "reports", applied],
    queryFn: async () => (await leadershipApi.reports(applied)).report,
  });
  const generate = useMutation({
    mutationFn: async () => (await leadershipApi.generate(filters)).report,
    onSuccess: async (report) => {
      setApplied(filters);
      await client.setQueryData(["leadership", "reports", filters], report);
      await client.invalidateQueries({ queryKey: ["leadership", "reports"] });
    },
  });
  const data = query.data;
  const preview = data?.preview;

  const maxBonus = useMemo(
    () => Math.max(...(preview?.bonusByDepartment.map((row) => row.amount) ?? [1]), 1),
    [preview]
  );

  async function download(type: string, format: "pdf" | "docx") {
    setDownloadMessage(null);
    try {
      await leadershipApi.download({ ...applied, reportType: type }, format);
      setDownloadMessage(`${reportTypeLabel(type)} downloaded.`);
    } catch {
      setDownloadMessage("Unable to download this report. Please try again.");
    }
  }

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
                Generate and view reports on employee performance, development, rewards and more.
              </p>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-white px-3 py-2 text-xs">
              <p className="font-semibold text-stone-700">{data.cycle.name}</p>
              {data.cycle.startDate && data.cycle.endDate ? (
                <p className="text-stone-400">{formatShortDateRange(data.cycle.startDate, data.cycle.endDate)}</p>
              ) : null}
            </div>
          </div>
          {downloadMessage ? <p className="rounded-xl bg-stone-50 px-3 py-2 text-sm">{downloadMessage}</p> : null}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Summary value={data.summary.employees} label="Total Employees" icon={<Users className="h-5 w-5" />} />
            <Summary value={data.summary.completedAppraisals ?? 0} label="Completed Appraisals" icon={<Target className="h-5 w-5" />} />
            <Summary value={data.summary.awardsGiven ?? data.summary.awards} label="Awards Given" icon={<Award className="h-5 w-5" />} />
            <Summary value={formatRs(data.summary.totalBonusesAllocated ?? 0)} label="Total Bonuses Allocated" icon={<Coins className="h-5 w-5" />} />
          </div>

          <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
            <section className="rounded-3xl border border-stone-200 bg-white p-5">
              <h2 className="text-sm font-semibold">Report Filters</h2>
              <div className="mt-4 space-y-3">
                <Select
                  label="Select Cycle"
                  value={filters.cycleId ?? data.cycle.id}
                  onChange={(value) => setFilters((current) => ({ ...current, cycleId: value }))}
                  options={data.cycles.map((item) => ({ value: item.id, label: item.name }))}
                />
                <Select
                  label="Department"
                  value={filters.departmentId ?? ""}
                  onChange={(value) => setFilters((current) => ({ ...current, departmentId: value || undefined }))}
                  options={data.filters.departments.map((item) => ({ value: item.id, label: item.name }))}
                  allowAll
                />
                <Select
                  label="Employee Type"
                  value={filters.employeeType ?? "ALL"}
                  onChange={(value) => setFilters((current) => ({ ...current, employeeType: value }))}
                  options={(data.filters.employeeTypes ?? ["ALL", "Permanent"]).map((item) => ({
                    value: item,
                    label: item === "ALL" ? "All" : item,
                  }))}
                />
                <Select
                  label="Report Type"
                  value={filters.reportType ?? "PERFORMANCE_SUMMARY"}
                  onChange={(value) => setFilters((current) => ({ ...current, reportType: value }))}
                  options={(data.filters.reportTypes ?? REPORT_CARDS).map((item) => ({
                    value: "value" in item ? item.value : item.type,
                    label: item.label,
                  }))}
                />
                <Button
                  type="button"
                  className="w-full bg-amber-400 text-stone-900 hover:bg-amber-300"
                  disabled={generate.isPending}
                  onClick={() => generate.mutate()}
                >
                  Generate Report
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    const reset = { reportType: "PERFORMANCE_SUMMARY" };
                    setFilters(reset);
                    setApplied(reset);
                  }}
                >
                  Reset Filters
                </Button>
              </div>
            </section>

            <div className="space-y-5">
              <section className="rounded-3xl border border-stone-200 bg-white p-5">
                <h2 className="text-sm font-semibold">Available Reports</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {REPORT_CARDS.map((card) => {
                    const Icon = card.icon;
                    const active = (filters.reportType ?? applied.reportType) === card.type;
                    return (
                      <button
                        key={card.type}
                        type="button"
                        className={`rounded-2xl border p-4 text-left ${
                          active ? "border-amber-300 bg-amber-50" : "border-stone-200 bg-white hover:border-amber-200"
                        }`}
                        onClick={() => {
                          const next = { ...filters, reportType: card.type };
                          setFilters(next);
                          setApplied(next);
                        }}
                      >
                        <Icon className="h-5 w-5 text-amber-600" />
                        <p className="mt-3 font-medium text-stone-900">{card.label}</p>
                        <p className="mt-1 text-xs text-stone-500">{card.detail}</p>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="rounded-3xl border border-stone-200 bg-white p-5">
                <h2 className="text-sm font-semibold">Report Preview</h2>
                <div className="mt-4 grid gap-5 lg:grid-cols-3">
                  <div>
                    <p className="mb-3 text-xs uppercase tracking-wide text-stone-400">Performance Band Distribution</p>
                    <div className="flex h-40 items-end gap-2">
                      {(preview?.bandDistribution ?? []).map((row) => (
                        <div key={row.name} className="flex flex-1 flex-col items-center gap-1">
                          <span className="text-[10px] text-stone-500">{row.value}</span>
                          <div className="w-full rounded-t bg-amber-400" style={{ height: `${Math.max(8, row.percent)}%` }} />
                          <span className="text-center text-[10px] text-stone-400">{row.name.split(" ")[0]}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-3 text-xs uppercase tracking-wide text-stone-400">Bonus Allocation by Department</p>
                    <div className="flex flex-col items-center">
                      <p className="text-2xl font-semibold">{formatRs(data.summary.totalBonusesAllocated ?? 0)}</p>
                      <p className="text-xs text-stone-400">Total</p>
                      <ul className="mt-3 w-full space-y-1 text-sm">
                        {(preview?.bonusByDepartment ?? []).slice(0, 5).map((row) => (
                          <li key={row.name} className="flex justify-between">
                            <span>{row.name}</span>
                            <span>{Math.round((row.amount / maxBonus) * 100)}%</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <div>
                    <p className="mb-3 text-xs uppercase tracking-wide text-stone-400">Awards by Category</p>
                    <ul className="space-y-2 text-sm">
                      {(preview?.awardsByCategory ?? []).map((row) => (
                        <li key={row.name} className="flex justify-between">
                          <span>{row.name}</span>
                          <span className="font-medium">{row.value}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </section>
            </div>
          </div>

          <section className="overflow-hidden rounded-3xl border border-stone-200 bg-white">
            <div className="flex items-center justify-between px-5 py-4">
              <h2 className="text-sm font-semibold">Recent Reports</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-stone-400">
                  <tr>
                    <th className="px-5 py-2">Report Name</th>
                    <th className="px-5 py-2">Type</th>
                    <th className="px-5 py-2">Generated On</th>
                    <th className="px-5 py-2">Generated By</th>
                    <th className="px-5 py-2">Status</th>
                    <th className="px-5 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.recentReports ?? []).map((row) => (
                    <tr key={row.id} className="border-t border-stone-100">
                      <td className="px-5 py-3 font-medium">{row.name}</td>
                      <td className="px-5 py-3">{reportTypeLabel(row.type)}</td>
                      <td className="px-5 py-3">{new Date(row.generatedOn).toLocaleString()}</td>
                      <td className="px-5 py-3">{row.generatedBy}</td>
                      <td className="px-5 py-3">
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800">{row.status}</span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => void download(row.type, "pdf")}>
                            <Download className="mr-1 h-3.5 w-3.5" />
                            PDF
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            className="bg-amber-400 text-stone-900 hover:bg-amber-300"
                            onClick={() => void download(row.type, "docx")}
                          >
                            Word
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </DashboardLayout>
  );
}

function Summary({
  value,
  label,
  icon,
}: {
  value: string | number;
  label: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-stone-200 bg-white p-5">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-amber-600">{icon}</div>
      <p className="mt-4 text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-sm text-stone-500">{label}</p>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  allowAll,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  allowAll?: boolean;
}) {
  return (
    <label className="block text-xs uppercase tracking-wide text-stone-400">
      {label}
      <select
        className="mt-1 h-10 w-full rounded-xl border border-stone-300 px-3 text-sm text-stone-800"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {allowAll ? <option value="">All Departments</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
