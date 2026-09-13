import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  useActivateCycle,
  useActivationReadiness,
  useCompleteCycle,
  useConfirmCycle,
  useDeleteCycle,
} from "@/features/hr/hooks/useAppraisalCycles";
import type { AppraisalCycle } from "@/features/hr/types";

export function ConfirmCycleDialog({
  cycle,
  open,
  onClose,
}: {
  cycle: AppraisalCycle;
  open: boolean;
  onClose: () => void;
}) {
  const confirmCycle = useConfirmCycle();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Submit cycle"
      description="Submit this draft so it becomes Upcoming."
    >
      <div className="space-y-3 text-sm">
        <p className="font-medium">{cycle.name}</p>
        <p>
          Organization-wide · {cycle.progress.totalEmployees} employees
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={confirmCycle.isPending}
            onClick={async () => {
              await confirmCycle.mutateAsync(cycle.id);
              onClose();
            }}
          >
            {confirmCycle.isPending ? "Submitting…" : "Submit cycle"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

export function ActivateCycleDialog({
  cycle,
  open,
  onClose,
}: {
  cycle: AppraisalCycle;
  open: boolean;
  onClose: () => void;
}) {
  const activateCycle = useActivateCycle();
  const readiness = useActivationReadiness(cycle.id, open);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Activate ${cycle.name}?`}
      description="This becomes the current organization-wide ACTIVE cycle."
    >
      {readiness.isLoading ? (
        <p className="text-sm text-stone-500">Checking readiness…</p>
      ) : readiness.data && !readiness.data.canActivate ? (
        <div className="space-y-3 text-sm">
          <ul className="list-disc space-y-1 pl-5">
            {readiness.data.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4 text-sm">
          <p>
            Incomplete organizational assignments do not block activation.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={activateCycle.isPending}
              onClick={async () => {
                await activateCycle.mutateAsync(cycle.id);
                onClose();
              }}
            >
              {activateCycle.isPending ? "Activating…" : "Activate cycle"}
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

export function CompleteCycleDialog({
  cycle,
  open,
  onClose,
}: {
  cycle: AppraisalCycle;
  open: boolean;
  onClose: () => void;
}) {
  const completeCycle = useCompleteCycle();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Complete cycle"
      description="Completing this cycle makes it historical and read-only."
    >
      <div className="space-y-3 text-sm">
        <p>{cycle.name}</p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={completeCycle.isPending}
            onClick={async () => {
              await completeCycle.mutateAsync(cycle.id);
              onClose();
            }}
          >
            {completeCycle.isPending ? "Completing…" : "Complete cycle"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

export function DeleteDraftCycleDialog({
  cycle,
  open,
  onClose,
  onDeleted,
}: {
  cycle: AppraisalCycle;
  open: boolean;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const deleteCycle = useDeleteCycle();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Delete draft cycle"
      description="This permanently deletes the draft appraisal cycle."
    >
      <div className="space-y-3 text-sm">
        <p className="font-medium">{cycle.name}</p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-red-600 text-white hover:bg-red-700"
            disabled={deleteCycle.isPending}
            onClick={async () => {
              await deleteCycle.mutateAsync(cycle.id);
              onClose();
              onDeleted?.();
            }}
          >
            {deleteCycle.isPending ? "Deleting…" : "Delete draft"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
