import DashboardLayout from "@/app/layouts/DashboardLayout";
import { useMyDashboard } from "@/features/dashboard/hooks/useDashboard";
import {
  DashboardError,
  DashboardLoading,
  Panel,
} from "@/features/dashboard/components/DashboardUi";
import { StatusBadge } from "@/features/hr/components/StatusBadge";
import { formatDate } from "@/features/hr/utils/dates";
import { formatRoleLabel } from "@/constants/roles";

export default function EmployeeProfilePage() {
  const query = useMyDashboard();
  const data = query.data;

  return (
    <DashboardLayout>
      {query.isLoading ? <DashboardLoading /> : null}
      {query.isError ? (
        <DashboardError message="Unable to load your profile. Please try again." />
      ) : null}
      {data ? (
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="rounded-3xl border border-stone-200/80 bg-white/90 p-6 shadow-[0_20px_60px_rgba(28,25,23,0.08)] dark:border-stone-700/70 dark:bg-stone-950/80">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-yellow-500 text-xl font-semibold text-stone-950">
                {data.profile.name.charAt(0)}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-700 dark:text-amber-300">
                  Employee profile
                </p>
                <h1 className="mt-1 text-2xl font-semibold text-stone-900 dark:text-white">
                  {data.profile.name}
                </h1>
                <p className="mt-1 text-sm text-stone-500">
                  {formatRoleLabel(data.profile.role)} · {data.profile.employeeId}
                </p>
              </div>
            </div>
          </div>

          <Panel title="Personal information">
            <dl className="grid gap-4 sm:grid-cols-2">
              <InfoRow label="Employee name" value={data.profile.name} />
              <InfoRow label="Employee ID" value={data.profile.employeeId} />
              <InfoRow label="Email" value={data.profile.companyEmail} />
            </dl>
          </Panel>

          <Panel title="Employment information">
            <dl className="grid gap-4 sm:grid-cols-2">
              <InfoRow
                label="Department"
                value={data.profile.department?.name ?? "Unassigned"}
              />
              <InfoRow
                label="Job position"
                value={data.profile.jobTitle ?? "Not set"}
              />
              <InfoRow
                label="Team"
                value={data.profile.team?.name ?? "Unassigned"}
              />
              <InfoRow
                label="Supervisor"
                value={
                  data.supervisor
                    ? `${data.supervisor.name} (${data.supervisor.employeeId})`
                    : data.profile.team?.supervisor
                      ? `${data.profile.team.supervisor.name} (${data.profile.team.supervisor.employeeId})`
                      : "Not assigned"
                }
              />
            </dl>
          </Panel>

          <Panel title="Appraisal information">
            {data.cycle ? (
              <dl className="grid gap-4 sm:grid-cols-2">
                <InfoRow
                  label="Current appraisal cycle"
                  value={data.cycle.name}
                />
                <div>
                  <dt className="text-xs uppercase tracking-wider text-stone-500">
                    Cycle status
                  </dt>
                  <dd className="mt-1">
                    <StatusBadge status={data.cycle.status} />
                  </dd>
                </div>
                <InfoRow
                  label="Cycle period"
                  value={`${formatDate(data.cycle.startDate)} — ${formatDate(data.cycle.endDate)}`}
                />
                <InfoRow
                  label="Batch assignment"
                  value={
                    data.batch
                      ? `${data.batch.name} (Batch ${data.batch.batchNumber})`
                      : "Not assigned yet"
                  }
                />
              </dl>
            ) : (
              <p className="text-sm text-stone-500">
                There is no active appraisal cycle assigned to you yet.
              </p>
            )}
          </Panel>
        </div>
      ) : null}
    </DashboardLayout>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-stone-500">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-stone-800 dark:text-stone-100">
        {value}
      </dd>
    </div>
  );
}
