import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/app/layouts/DashboardLayout";
import {
  DashboardError,
  DashboardHero,
  DashboardLoading,
  Panel,
  StatCard,
} from "@/features/dashboard/components/DashboardUi";
import { formatShortDate } from "@/features/hr/utils/dates";
import { leadershipApi } from "../services/leadership.api";

export default function LeadershipDashboardPage() {
  const query = useQuery({
    queryKey: ["leadership", "overview"],
    queryFn: async () => (await leadershipApi.overview()).overview,
  });
  const data = query.data;

  return (
    <DashboardLayout>
      {query.isLoading ? <DashboardLoading /> : null}
      {query.isError ? (
        <DashboardError message="Unable to load leadership insights. Please try again." />
      ) : null}
      {data ? (
        <div className="space-y-6">
          <DashboardHero
            eyebrow="Leadership workspace"
            title="Organisation performance overview"
            description="A read-only view of appraisal progress, department completion, development focus, and upcoming milestones."
          />

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Employees" value={data.kpis.employees} hint={data.cycle.name} />
            <StatCard label="PDP completion" value={`${data.kpis.pdpCompletion}%`} />
            <StatCard label="Active PIPs" value={data.kpis.activePips} />
            <StatCard label="Awards" value={data.kpis.awards} />
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <Panel title="Department completion">
              <div className="space-y-3">
                {data.departments.map((department) => (
                  <div key={department.name}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span>{department.name}</span>
                      <span className="text-stone-500">
                        {department.completion}% · {department.employees}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-stone-100">
                      <div
                        className="h-2 rounded-full bg-amber-400"
                        style={{ width: `${Math.min(100, department.completion)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel title="Overall progress">
              <div className="flex items-center justify-center">
                <div className="relative flex h-40 w-40 items-center justify-center rounded-full border-[12px] border-amber-300">
                  <div className="text-center">
                    <p className="text-3xl font-semibold">{data.progress.overall}%</p>
                    <p className="text-xs text-stone-500">Complete</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <p className="text-lg font-semibold">{data.progress.completed}</p>
                  <p className="text-stone-500">Completed</p>
                </div>
                <div>
                  <p className="text-lg font-semibold">{data.progress.inProgress}</p>
                  <p className="text-stone-500">In progress</p>
                </div>
                <div>
                  <p className="text-lg font-semibold">{data.progress.notStarted}</p>
                  <p className="text-stone-500">Not started</p>
                </div>
              </div>
            </Panel>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title="Employee status">
              <ul className="space-y-2">
                {data.statuses.map((item) => (
                  <li key={item.label} className="flex items-center justify-between rounded-xl bg-stone-50 px-3 py-2 text-sm">
                    <span>{item.label}</span>
                    <span className="font-semibold">{item.value}</span>
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel title="Top development areas">
              <ul className="space-y-2">
                {data.developmentAreas.length === 0 ? (
                  <li className="text-sm text-stone-500">No development areas recorded yet.</li>
                ) : (
                  data.developmentAreas.map((item) => (
                    <li key={item.name} className="flex items-center justify-between text-sm">
                      <span>{item.name}</span>
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-800">{item.count}</span>
                    </li>
                  ))
                )}
              </ul>
            </Panel>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title="Upcoming milestones">
              <ul className="space-y-3">
                {data.milestones.length === 0 ? (
                  <li className="text-sm text-stone-500">No upcoming meetings.</li>
                ) : (
                  data.milestones.map((item) => (
                    <li key={item.id} className="rounded-xl border border-stone-100 px-3 py-2 text-sm">
                      <p className="font-medium">{item.title}</p>
                      <p className="text-xs text-stone-500">
                        {item.employee} · {formatShortDate(item.date)} · {item.status}
                      </p>
                    </li>
                  ))
                )}
              </ul>
            </Panel>
            <Panel title="Recent activity">
              <ul className="space-y-3">
                {data.activity.map((item) => (
                  <li key={item.id} className="text-sm">
                    <p className="font-medium">{item.title}</p>
                    <p className="text-xs text-stone-500">{item.detail}</p>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>

          <Panel title="Generate reports">
            <p className="text-sm text-stone-500">
              Open the Reports tab to filter organisation performance and download PDF or Word files.
              Leadership access is view-only.
            </p>
            <Link
              to="/leadership/reports"
              className="mt-4 inline-flex h-11 items-center rounded-xl bg-amber-400 px-4 text-sm font-medium text-stone-900 hover:bg-amber-300"
            >
              Generate Reports
            </Link>
          </Panel>
        </div>
      ) : null}
    </DashboardLayout>
  );
}
