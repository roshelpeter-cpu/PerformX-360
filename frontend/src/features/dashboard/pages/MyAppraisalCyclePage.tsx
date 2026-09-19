import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "@/app/layouts/DashboardLayout";
import { useMyDashboard } from "@/features/dashboard/hooks/useDashboard";
import {
  DashboardError,
  DashboardLoading,
  Panel,
} from "@/features/dashboard/components/DashboardUi";
import { StatusBadge } from "@/features/hr/components/StatusBadge";
import { formatDate } from "@/features/hr/utils/dates";
import { getDashboardPathForRole } from "@/constants/roles";
import { useAuthStore } from "@/store/authStore";

export default function MyAppraisalCyclePage() {
  const user = useAuthStore((state) => state.user);
  const query = useMyDashboard();
  const data = query.data;
  const backTo = user ? getDashboardPathForRole(user.role) : "/";

  return (
    <DashboardLayout>
      {query.isLoading ? <DashboardLoading /> : null}
      {query.isError ? (
        <DashboardError message="Unable to load appraisal cycle details. Please try again." />
      ) : null}
      {data ? (
        <div className="mx-auto max-w-3xl space-y-6">
          <div>
            <Link
              to={backTo}
              className="text-sm text-stone-500 hover:text-stone-900 dark:hover:text-stone-100"
            >
              ← Back to dashboard
            </Link>
            <h1 className="mt-3 text-2xl font-semibold text-stone-900 dark:text-white">
              Appraisal cycle details
            </h1>
            <p className="mt-1 text-sm text-stone-500">
              Informational summary of your current appraisal cycle.
            </p>
          </div>

          {data.cycle ? (
            <Panel title={data.cycle.name}>
              <dl className="grid gap-4 sm:grid-cols-2">
                <InfoRow label="Cycle name" value={data.cycle.name} />
                <InfoRow
                  label="Status"
                  value={<StatusBadge status={data.cycle.status} />}
                />
                <InfoRow
                  label="Start date"
                  value={formatDate(data.cycle.startDate)}
                />
                <InfoRow
                  label="End date"
                  value={formatDate(data.cycle.endDate)}
                />
                {data.cycle.description ? (
                  <div className="sm:col-span-2">
                    <InfoRow label="Description" value={data.cycle.description} />
                  </div>
                ) : null}
                {data.batch ? (
                  <InfoRow
                    label="Batch"
                    value={`${data.batch.name} (Batch ${data.batch.batchNumber})`}
                  />
                ) : null}
                {data.supervisor ? (
                  <InfoRow
                    label="Immediate Supervisor"
                    value={`${data.supervisor.name} (${data.supervisor.employeeId})`}
                  />
                ) : null}
              </dl>
            </Panel>
          ) : (
            <Panel title="Current appraisal cycle">
              <p className="text-sm text-stone-500">
                There is no active appraisal cycle assigned to you yet.
              </p>
            </Panel>
          )}
        </div>
      ) : null}
    </DashboardLayout>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-stone-500">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-stone-800 dark:text-stone-100">
        {value}
      </dd>
    </div>
  );
}
