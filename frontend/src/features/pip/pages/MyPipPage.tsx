import { useState } from "react";
import DashboardLayout from "@/app/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { DashboardError, DashboardLoading } from "@/features/dashboard/components/DashboardUi";
import { AssignedPdpGate } from "@/features/pdp/components/AssignedPdpGate";
import { EmployeeActivePdpDashboard } from "@/features/pdp/components/EmployeeActivePdpDashboard";
import { ApprovalBadge, PdpStatusBadge } from "@/features/pdp/components/PdpStatusBadge";
import { useEmployeeApprovePdp, useEmployeeRequestPdpChanges, useMyPdp } from "@/features/pdp/hooks/usePdp";
import { formatShortDate } from "@/features/hr/utils/dates";
import type { PdpDetail } from "@/features/pdp/services/pdp.api";

export default function MyPipPage() {
  const query = useMyPdp(true, "PIP");
  const [live, setLive] = useState<PdpDetail | null>(null);
  const [opened, setOpened] = useState(false);
  const [reason, setReason] = useState("");
  const approve = useEmployeeApprovePdp();
  const requestChanges = useEmployeeRequestPdpChanges();
  const pdp = live ?? query.data ?? null;

  return (
    <DashboardLayout>
      {query.isLoading ? <DashboardLoading /> : null}
      {query.isError ? <DashboardError message="Unable to load your PIP." /> : null}
      {!query.isLoading && !query.isError && !pdp ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center text-sm text-stone-500">
          No Performance Improvement Plan has been assigned to you for this cycle.
        </div>
      ) : null}
      {pdp && (pdp.status === "ACTIVE" || (pdp.status === "ASSIGNED" && opened)) ? (
        <div className="pdp-force-light text-stone-900">
          <EmployeeActivePdpDashboard pdp={pdp} mode="employee" onPdpChange={setLive} />
        </div>
      ) : null}
      {pdp && pdp.status === "ASSIGNED" && !opened ? (
        <AssignedPdpGate pdp={pdp} kind="PIP" onViewAssigned={() => setOpened(true)} />
      ) : null}
      {pdp && pdp.status !== "ACTIVE" && pdp.status !== "ASSIGNED" ? (
        <div className="space-y-5">
          <div>
            <p className="text-xs text-stone-400">Home / My PIP</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">My Performance Improvement Plan</h1>
            <p className="mt-1 text-sm text-stone-500">
              Review the PIP assigned by your supervisor, then approve or request changes using the same
              workflow as My PDP.
            </p>
          </div>
          <section className="rounded-2xl border border-stone-200 bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">PIP Details</h2>
              <PdpStatusBadge status={pdp.status} />
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Title" value={pdp.title} />
              <Field label="Employee" value={pdp.employee.name} />
              <Field label="Supervisor" value={pdp.supervisor?.name ?? "—"} />
              <Field label="Department" value={pdp.employee.department?.name ?? "—"} />
              <Field label="Start date" value={formatShortDate(pdp.createdAt)} />
              <Field label="Review period" value={pdp.cycle.name} />
            </div>
            <p className="mt-4 text-sm text-stone-600">{pdp.summary || "No summary provided yet."}</p>
          </section>
          <section className="rounded-2xl border border-stone-200 bg-white p-5">
            <h2 className="font-semibold">PIP goals</h2>
            <div className="mt-3 space-y-3">
              {(pdp.currentVersion?.goals ?? []).map((goal, index) => (
                <div key={goal.id} className="rounded-xl border border-stone-100 p-4">
                  <p className="text-xs uppercase tracking-wide text-amber-800">Goal {index + 1}</p>
                  <p className="font-medium">{goal.title}</p>
                  <p className="mt-1 text-sm text-stone-600">{goal.objective}</p>
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-2xl border border-stone-200 bg-white p-5">
            <h2 className="font-semibold">Approval status</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-stone-100 p-3">
                <p className="text-xs text-stone-400">Your approval</p>
                <ApprovalBadge status={pdp.employeeApproval?.status} />
              </div>
              <div className="rounded-xl border border-stone-100 p-3">
                <p className="text-xs text-stone-400">HR approval</p>
                <ApprovalBadge status={pdp.hrApproval?.status} />
              </div>
            </div>
            {pdp.permissions.canApproveAsEmployee ? (
              <div className="mt-4 space-y-3">
                <textarea
                  className="min-h-24 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
                  placeholder="Reason if you request changes"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    className="bg-amber-400 text-stone-900 hover:bg-amber-300"
                    disabled={approve.isPending}
                    onClick={() => void approve.mutateAsync(pdp.id).then(setLive)}
                  >
                    Approve PIP
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={requestChanges.isPending || !reason.trim()}
                    onClick={() =>
                      void requestChanges.mutateAsync({ pdpId: pdp.id, reason }).then(setLive)
                    }
                  >
                    Request changes
                  </Button>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </DashboardLayout>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-stone-400">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}
