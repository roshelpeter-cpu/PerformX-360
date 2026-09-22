import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCreatePdp } from "../hooks/usePdp";
import type { GoalInput, PdpPerson } from "../services/pdp.api";
import { defaultFiveGoals } from "../utils/goalDefaults";
import { GoalEditor } from "./GoalEditor";

export type CreatePdpEmployee = PdpPerson & {
  supervisor?: PdpPerson | null;
  hr?: PdpPerson | null;
};

export function CreatePdpModal({
  employee,
  cycleName,
  onClose,
  onCreated,
}: {
  employee: CreatePdpEmployee;
  cycleName: string;
  onClose: () => void;
  onCreated: (pdpId: string) => void;
}) {
  const createPdp = useCreatePdp();
  const [title, setTitle] = useState(`Professional Development Plan ${new Date().getFullYear()}`);
  const [summary, setSummary] = useState("");
  const [goals, setGoals] = useState<GoalInput[]>(defaultFiveGoals());

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-950/50 p-4 sm:p-6">
      <div className="my-4 flex w-full max-w-5xl flex-col rounded-2xl border border-stone-200 bg-white shadow-2xl dark:border-stone-800 dark:bg-stone-950">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-stone-200 bg-white px-5 py-4 dark:border-stone-800 dark:bg-stone-950">
          <div>
            <h2 className="text-xl font-semibold">Create PDP</h2>
            <p className="mt-1 text-sm text-stone-500">
              Draft a Professional Development Plan with 5 main goals and 5 sub-goals each.
            </p>
          </div>
          <button type="button" className="rounded-lg p-2 hover:bg-stone-100 dark:hover:bg-stone-900" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[75vh] space-y-6 overflow-y-auto px-5 py-5">
          <section className="rounded-2xl border border-stone-200 p-4 dark:border-stone-800">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-400">Employee Information</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <ReadOnly label="Employee Name" value={employee.name} />
              <ReadOnly label="Employee ID" value={employee.employeeId} />
              <ReadOnly label="Department" value={employee.department?.name ?? "—"} />
              <ReadOnly label="Supervisor" value={employee.supervisor?.name ?? "—"} />
              <ReadOnly label="HR in Charge" value={employee.hr?.name ?? "—"} />
              <ReadOnly label="Appraisal Cycle" value={cycleName} />
            </div>
          </section>

          <section className="rounded-2xl border border-stone-200 p-4 dark:border-stone-800">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-400">PDP Information</h3>
            <label className="mt-3 block text-sm">
              PDP Title
              <input
                className="mt-1 h-10 w-full rounded-xl border border-stone-300 px-3 dark:border-stone-700 dark:bg-stone-900"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <label className="mt-3 block text-sm">
              Development Summary
              <textarea
                className="mt-1 min-h-28 w-full rounded-xl border border-stone-300 px-3 py-2 dark:border-stone-700 dark:bg-stone-900"
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                placeholder="Describe the overall development focus for this cycle..."
              />
            </label>
          </section>

          <GoalEditor goals={goals} onChange={setGoals} editable />
        </div>

        <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-stone-200 bg-white px-5 py-4 dark:border-stone-800 dark:bg-stone-950">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={createPdp.isPending || !title.trim()}
            onClick={() =>
              void createPdp
                .mutateAsync({
                  employeeId: employee.id,
                  title: title.trim(),
                  summary,
                  goals,
                })
                .then((pdp) => onCreated(pdp.id))
            }
          >
            Save as Draft
          </Button>
          <Button
            type="button"
            disabled={createPdp.isPending || !title.trim()}
            onClick={() =>
              void createPdp
                .mutateAsync({
                  employeeId: employee.id,
                  title: title.trim(),
                  summary,
                  goals,
                })
                .then((pdp) => onCreated(pdp.id))
            }
          >
            Create PDP
          </Button>
        </div>
      </div>
    </div>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-stone-400">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}
