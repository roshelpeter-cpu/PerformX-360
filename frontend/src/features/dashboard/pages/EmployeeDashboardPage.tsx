import DashboardLayout from "@/app/layouts/DashboardLayout";
import CurrentAppraisalCycleBanner from "@/features/dashboard/components/CurrentAppraisalCycleBanner";
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

          <CurrentAppraisalCycleBanner
            cycle={data.cycle}
            detailsHref={
              data.cycle ? "/employee/appraisal-cycle" : null
            }
            emptyMessage="There is no active appraisal cycle assigned to you yet."
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
      ) : null}
    </DashboardLayout>
  );
}
