import { formatDate } from "@/features/hr/utils/dates";
import DashboardLayout from "@/app/layouts/DashboardLayout";
import { useMyDashboard } from "@/features/dashboard/hooks/useDashboard";
import {
  DashboardError,
  DashboardHero,
  DashboardLoading,
  Panel,
  StatCard,
} from "@/features/dashboard/components/DashboardUi";

export default function EmployeeDashboardPage() {
  const query = useMyDashboard();
  const data = query.data;

  return (
    <DashboardLayout>
      {query.isLoading ? <DashboardLoading /> : null}
      {query.isError ? (
        <DashboardError message="Unable to load your dashboard. Please try again." />
      ) : null}
      {data ? (
        <div className="space-y-6">
          <DashboardHero
            eyebrow="Employee workspace"
            title={`Welcome back, ${data.profile.name}`}
            description="Review your current appraisal assignment, supervisor, and recent notifications."
          />

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Employee ID" value={data.profile.employeeId} />
            <StatCard
              label="Department"
              value={data.profile.department?.name ?? "Unassigned"}
            />
            <StatCard
              label="Job title"
              value={data.profile.jobTitle ?? "Not set"}
            />
            <StatCard
              label="Unread alerts"
              value={data.unreadCount}
              hint="Password resets and cycle updates"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Current appraisal cycle">
              {data.cycle ? (
                <div className="space-y-3 text-sm text-stone-600 dark:text-stone-300">
                  <p className="text-lg font-semibold text-stone-900 dark:text-white">
                    {data.cycle.name}
                  </p>
                  <p>Status: {data.cycle.status}</p>
                  <p>
                    {formatDate(data.cycle.startDate)} — {formatDate(data.cycle.endDate)}
                  </p>
                  <p>
                    Batch:{" "}
                    {data.batch
                      ? `${data.batch.name} (Batch ${data.batch.batchNumber})`
                      : "Not assigned yet"}
                  </p>
                  <p>
                    Immediate Supervisor:{" "}
                    {data.supervisor
                      ? `${data.supervisor.name} (${data.supervisor.employeeId})`
                      : "Not assigned yet"}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-stone-500">
                  There is no active appraisal cycle assigned to you yet.
                </p>
              )}
            </Panel>

            <Panel title="Recent notifications">
              {data.notifications.length === 0 ? (
                <p className="text-sm text-stone-500">No notifications yet.</p>
              ) : (
                <ul className="space-y-3">
                  {data.notifications.map((item) => (
                    <li
                      key={item.id}
                      className="rounded-2xl border border-stone-200 px-4 py-3 dark:border-stone-800"
                    >
                      <p className="text-sm font-medium text-stone-900 dark:text-white">
                        {item.title}
                      </p>
                      <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
                        {item.message}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      ) : null}
    </DashboardLayout>
  );
}
