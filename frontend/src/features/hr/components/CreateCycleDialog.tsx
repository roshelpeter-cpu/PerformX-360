import { useMemo, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useCreateCycle,
  useWorkforceSummary,
} from "@/features/hr/hooks/useAppraisalCycles";
import { addOneYearIso, formatDate } from "@/features/hr/utils/dates";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function CreateCycleDialog({ open, onClose }: Props) {
  const createCycle = useCreateCycle();
  const workforce = useWorkforceSummary();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [error, setError] = useState("");

  const cycleEnd = useMemo(
    () => (startDate ? addOneYearIso(startDate) : ""),
    [startDate]
  );

  function reset() {
    setStep(1);
    setName("");
    setDescription("");
    setStartDate("");
    setError("");
  }

  function handleClose() {
    reset();
    onClose();
  }

  function nextFromDetails() {
    if (!name.trim() || !startDate) {
      setError("Cycle name and a valid start date are required.");
      return;
    }
    setError("");
    setStep(2);
  }

  async function submit(confirm: boolean) {
    await createCycle.mutateAsync({
      name: name.trim(),
      description: description.trim() || null,
      startDate,
      confirm,
    });
    handleClose();
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Create Appraisal Cycle"
      description={`Step ${step} of 2`}
      className="max-w-xl"
    >
      {step === 1 ? (
        <div className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="cycle-name">Cycle name</Label>
            <Input
              id="cycle-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Annual Appraisal 2029"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cycle-description">Description</Label>
            <textarea
              id="cycle-description"
              className="min-h-24 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-950"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Annual performance and development appraisal cycle for all employees across the organization."
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cycle-start">Start date</Label>
            <Input
              id="cycle-start"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </div>
          <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-950">
            <p className="text-stone-500">Calculated end date</p>
            <p className="font-medium">
              {cycleEnd ? formatDate(cycleEnd) : "Select a start date"}
            </p>
            <p className="mt-1 text-xs text-stone-500">
              Organization-wide cycle. Starts as Draft.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4 text-sm">
          <div className="rounded-lg border border-stone-200 p-3 dark:border-stone-700">
            <p className="font-medium">{name}</p>
            <p className="mt-1 text-stone-500">{description || "No description"}</p>
            <p className="mt-2">
              {formatDate(startDate)} — {formatDate(cycleEnd)}
            </p>
          </div>
          <p>
            Total employees: {workforce.data?.totalAssignableEmployees ?? "—"}
          </p>
          <p className="text-xs text-stone-500">
            All employees belong to this single organization-wide appraisal cycle.
            Save as Draft or Submit to Upcoming.
          </p>
        </div>
      )}

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      <div className="mt-5 flex justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={step === 1 ? handleClose : () => setStep(1)}
        >
          {step === 1 ? "Cancel" : "Back"}
        </Button>
        {step === 1 ? (
          <Button type="button" onClick={nextFromDetails}>
            Continue
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={createCycle.isPending}
              onClick={() => submit(false)}
            >
              Save Draft
            </Button>
            <Button
              type="button"
              disabled={createCycle.isPending}
              onClick={() => submit(true)}
            >
              Submit Cycle
            </Button>
          </div>
        )}
      </div>
    </Dialog>
  );
}
