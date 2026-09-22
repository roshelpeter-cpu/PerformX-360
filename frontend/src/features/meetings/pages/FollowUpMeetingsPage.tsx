import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "@/app/layouts/DashboardLayout";
import {
  DashboardError,
  DashboardLoading,
} from "@/features/dashboard/components/DashboardUi";
import { EmployeeActivePdpDashboard } from "@/features/pdp/components/EmployeeActivePdpDashboard";
import { useEmployeePdp, usePdpBoard, usePdpOptions } from "@/features/pdp/hooks/usePdp";
import type { PdpDetail } from "@/features/pdp/services/pdp.api";
import { useAuthStore } from "@/store/authStore";

export default function FollowUpMeetingsPage() {
  const user = useAuthStore((state) => state.user);
  const role = user?.role;
  const isEmployee = role === "EMPLOYEE";
  const isSupervisorOrHr =
    role === "SUPERVISOR" || role === "HR" || role === "HR_MANAGER";

  return (
    <DashboardLayout>
      {isEmployee ? <EmployeeFollowUpEmptyState /> : null}
      {isSupervisorOrHr ? <SupervisorFollowUpView /> : null}
      {!isEmployee && !isSupervisorOrHr ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-6 text-sm text-stone-600">
          Follow-up meetings are available for supervisors and HR.
        </div>
      ) : null}
    </DashboardLayout>
  );
}

function EmployeeFollowUpEmptyState() {
  return (
    <div className="pdp-force-light rounded-2xl border border-stone-200 bg-white p-8 text-center text-stone-900">
      <h1 className="text-2xl font-semibold tracking-tight">Follow-up Meetings</h1>
      <p className="mx-auto mt-2 max-w-lg text-sm text-stone-500">
        Follow-up meetings are conducted by your supervisor. Track and update your development goals
        from My PDP.
      </p>
      <Link
        to="/employee/pdp"
        className="mt-5 inline-flex rounded-xl bg-amber-400 px-4 py-2 text-sm font-medium text-stone-900 hover:bg-amber-300"
      >
        Go to My PDP
      </Link>
    </div>
  );
}

function SupervisorFollowUpView() {
  const optionsQuery = usePdpOptions(true);
  const optionsWithPdp = useMemo(
    () => (optionsQuery.data?.employees ?? []).filter((employee) => employee.hasPdp),
    [optionsQuery.data]
  );
  const needBoardFallback =
    optionsQuery.isError || (optionsQuery.isSuccess && optionsWithPdp.length === 0);
  const boardQuery = usePdpBoard({ page: 1, pageSize: 100 }, needBoardFallback);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [localPdp, setLocalPdp] = useState<PdpDetail | null>(null);

  const employees = useMemo(() => {
    if (optionsWithPdp.length > 0) return optionsWithPdp;

    return (
      boardQuery.data?.items
        .filter((row) => row.pdp)
        .map((row) => ({
          id: row.employee.id,
          employeeId: row.employee.employeeId,
          name: row.employee.name,
          jobTitle: row.employee.jobTitle,
          hasPdp: true as const,
        })) ?? []
    );
  }, [optionsWithPdp, boardQuery.data]);

  const pdpQuery = useEmployeePdp(selectedEmployeeId || null);

  useEffect(() => {
    setLocalPdp(null);
  }, [selectedEmployeeId]);

  useEffect(() => {
    if (pdpQuery.data) {
      setLocalPdp(pdpQuery.data);
    }
  }, [pdpQuery.data]);

  const pdp = localPdp;
  const loadingOptions =
    optionsQuery.isLoading || (needBoardFallback && boardQuery.isLoading);
  const optionsError = optionsQuery.isError && boardQuery.isError;

  return (
    <div className="pdp-force-light space-y-5 text-stone-900">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-stone-900">
            Follow-up Meetings
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            Select a team member to review their active PDP, approve completed work, and add
            follow-up goals.
          </p>
        </div>
        <div className="min-w-[260px]">
          <label className="text-xs font-medium uppercase tracking-wide text-stone-400">
            Select employee
          </label>
          <select
            className="mt-1 h-10 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-800"
            value={selectedEmployeeId}
            onChange={(event) => setSelectedEmployeeId(event.target.value)}
            disabled={loadingOptions}
          >
            <option value="">Choose an employee…</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name}
                {employee.employeeId ? ` (${employee.employeeId})` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loadingOptions ? <DashboardLoading /> : null}
      {optionsError ? <DashboardError message="Unable to load team members." /> : null}

      {!loadingOptions && !optionsError && employees.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center text-sm text-stone-500">
          No employees with a PDP were found for follow-up review.
        </div>
      ) : null}

      {selectedEmployeeId ? (
        pdpQuery.isLoading && !pdp ? (
          <DashboardLoading />
        ) : pdpQuery.isError && !pdp ? (
          <DashboardError message="Unable to load this employee's PDP." />
        ) : !pdp ? (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center text-sm text-stone-500">
            This employee does not have a PDP for the active cycle.
          </div>
        ) : (
          <EmployeeActivePdpDashboard
            pdp={pdp}
            mode="supervisor"
            onPdpChange={(next) => setLocalPdp(next)}
          />
        )
      ) : !loadingOptions && employees.length > 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center text-sm text-stone-500">
          Select an employee above to open their PDP for the follow-up meeting.
        </div>
      ) : null}
    </div>
  );
}
