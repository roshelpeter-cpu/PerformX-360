import { CheckCircle2, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatShortDate } from "@/features/hr/utils/dates";
import type { PdpDetail } from "../services/pdp.api";

export function AssignedPdpGate({
  pdp,
  onViewAssigned,
}: {
  pdp: PdpDetail;
  onViewAssigned: () => void;
}) {
  const goalCount = pdp.currentVersion?.goals?.length ?? 0;
  const subGoalCount =
    pdp.currentVersion?.goals?.reduce((sum, goal) => sum + (goal.subGoals?.length ?? 0), 0) ?? 0;

  return (
    <div className="pdp-force-light space-y-5 text-stone-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-stone-400">Home / My PDP</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-stone-900">
            My Personal Development Plan
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            Your supervisor has assigned a PDP for this appraisal cycle.
          </p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800">
          Appraisal Cycle: {pdp.cycle.name}
        </div>
      </div>

      <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-400 text-stone-900">
              <ClipboardList className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                Assigned PDP
              </p>
              <h2 className="mt-1 text-xl font-semibold text-stone-900">
                PDP has been assigned to you
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-stone-600">
                Click <span className="font-medium">View My Assigned PDP</span> to open your goals
                and start tracking progress. This does not change the PDP workflow status in the
                system — it only opens your assigned plan for this session.
              </p>
            </div>
          </div>
          <Button
            type="button"
            className="rounded-xl bg-amber-400 px-5 text-stone-900 hover:bg-amber-300"
            onClick={onViewAssigned}
          >
            View My Assigned PDP
          </Button>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="rounded-2xl border border-stone-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold text-stone-900">PDP Details</h2>
            <span className="inline-flex rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-sky-800">
              Assigned
            </span>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="PDP Title" value={pdp.title} />
            <Field label="Created Date" value={formatShortDate(pdp.createdAt)} />
            <Field label="Assigned Date" value={formatShortDate(pdp.assignedAt)} />
            <Field label="Department" value={pdp.employee.department?.name ?? "—"} />
            <Field label="Employee" value={pdp.employee.name} />
            <Field label="Supervisor" value={pdp.supervisor?.name ?? "—"} />
          </div>
          <div className="mt-4">
            <p className="text-xs uppercase tracking-wide text-stone-400">Development Summary</p>
            <p className="mt-1 text-sm text-stone-700">
              {pdp.summary || "No development summary provided yet."}
            </p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-stone-100 bg-stone-50 px-3 py-2 text-sm">
              <p className="text-xs text-stone-400">Main goals ready</p>
              <p className="font-semibold text-stone-900">{goalCount}</p>
            </div>
            <div className="rounded-xl border border-stone-100 bg-stone-50 px-3 py-2 text-sm">
              <p className="text-xs text-stone-400">Sub-goals ready</p>
              <p className="font-semibold text-stone-900">{subGoalCount}</p>
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-stone-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <h3 className="font-semibold text-stone-900">Assignment Status</h3>
            </div>
            <p className="mt-2 text-sm text-stone-600">
              Both Employee and HR approvals are complete. Your supervisor has assigned this PDP to
              you.
            </p>
            <Button
              type="button"
              className="mt-4 w-full rounded-xl bg-amber-400 text-stone-900 hover:bg-amber-300"
              onClick={onViewAssigned}
            >
              View My Assigned PDP
            </Button>
          </section>

          <section className="rounded-2xl border border-stone-200 bg-white p-4">
            <h3 className="font-semibold text-stone-900">Participants</h3>
            <div className="mt-2 space-y-2 text-sm text-stone-800">
              <p>
                <span className="text-stone-400">Supervisor:</span> {pdp.supervisor?.name ?? "—"}
              </p>
              <p>
                <span className="text-stone-400">HR in Charge:</span> {pdp.hr?.name ?? "—"}
              </p>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-stone-400">{label}</p>
      <p className="mt-1 text-sm font-medium text-stone-900">{value}</p>
    </div>
  );
}
