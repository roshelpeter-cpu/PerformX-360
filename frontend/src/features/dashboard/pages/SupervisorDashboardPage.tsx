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

export default function SupervisorDashboardPage() {
  const query = useMyDashboard();
  const data = query.data;

  return (
    <DashboardLayout>
      {query.isLoading ? <DashboardLoading /> : null}
      {query.isError ? (
        <DashboardError message="Unable to load your team dashboard. Please try again." />
      ) : null}
      {data ? (
        <div className="space-y-6">
          <DashboardHero
            eyebrow="Immediate Supervisor workspace"
            title={`Welcome back, ${data.profile.name}`}
            description="Track the employees assigned to you in the current appraisal cycle."
          />

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Team members" value={data.teamCount ?? 0} />
            <StatCard
              label="Department"
              value={data.profile.department?.name ?? "Unassigned"}
            />
            <StatCard
              label="Active cycle"
              value={data.cycle?.name ?? "None"}
            />
            <StatCard label="Unread alerts" value={data.unreadCount} />
          </div>

          <Panel title="Assigned employees">
            {data.team && data.team.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-wider text-stone-500">
                    <tr>
                      <th className="pb-3 font-medium">Employee</th>
                      <th className="pb-3 font-medium">ID</th>
                      <th className="pb-3 font-medium">Department</th>
                      <th className="pb-3 font-medium">Batch</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200 dark:divide-stone-800">
                    {data.team.map((member) => (
                      <tr key={member.id}>
                        <td className="py-3">
                          <p className="font-medium text-stone-900 dark:text-white">
                            {member.name}
                          </p>
                          <p className="text-xs text-stone-500">
                            {member.jobTitle ?? member.companyEmail}
                          </p>
                        </td>
                        <td className="py-3 text-stone-600 dark:text-stone-300">
                          {member.employeeId}
                        </td>
                        <td className="py-3 text-stone-600 dark:text-stone-300">
                          {member.department?.name ?? "—"}
                        </td>
                        <td className="py-3 text-stone-600 dark:text-stone-300">
                          {member.batch?.name ?? "Unassigned"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-stone-500">
                No employees are assigned to you in the current cycle.
              </p>
            )}
          </Panel>

          {data.cycle ? (
            <Panel title="Cycle period">
              <p className="text-sm text-stone-600 dark:text-stone-300">
                {data.cycle.name}: {formatDate(data.cycle.startDate)} —{" "}
                {formatDate(data.cycle.endDate)}
              </p>
            </Panel>
          ) : null}
        </div>
      ) : null}
    </DashboardLayout>
  );
}
