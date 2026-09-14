// HR Reassignment modal
// Reassigns HR responsibility for a team with mandatory reason + evidence.
// Uses existing cycle activity/evidence upload infrastructure.

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fieldClass } from "@/features/hr/components/ActionMenu";
import { useReassignHr } from "@/features/hr/hooks/useAppraisalCycles";
import type { HrGroupSummary } from "@/features/hr/types";
import { ApiClientError } from "@/services/api/client";

interface Props {
  open: boolean;
  onClose: () => void;
  cycleId: string;
  teamId: string;
  teamName: string;
  currentHrName: string;
  currentHrId: string;
  hrOptions: HrGroupSummary[];
  onSuccess?: (newHrEmployeeId: string) => void;
}

export default function ReassignHrDialog({
  open,
  onClose,
  cycleId,
  teamId,
  teamName,
  currentHrName,
  currentHrId,
  hrOptions,
  onSuccess,
}: Props) {
  const reassignHr = useReassignHr(cycleId);
  const [newHrId, setNewHrId] = useState("");
  const [reason, setReason] = useState("");
  const [evidence, setEvidence] = useState<File | null>(null);
  const [error, setError] = useState("");

  const candidates = hrOptions.filter((group) => group.id !== currentHrId);

  function resetAndClose() {
    setNewHrId("");
    setReason("");
    setEvidence(null);
    setError("");
    onClose();
  }

  async function confirm() {
    const trimmedReason = reason.trim();
    if (!newHrId) {
      setError("Select a new HR staff member.");
      return;
    }
    if (!trimmedReason) {
      setError("Reason is required.");
      return;
    }
    if (!evidence) {
      setError("Supporting evidence is required.");
      return;
    }

    try {
      setError("");
      await reassignHr.mutateAsync({
        teamId,
        newHrEmployeeId: newHrId,
        reason: trimmedReason,
        evidence,
      });
      onSuccess?.(newHrId);
      resetAndClose();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "Failed to reassign HR responsibility."
      );
    }
  }

  return (
    <Dialog
      open={open}
      onClose={resetAndClose}
      title="Reassign HR"
      description="Changes HR responsibility only — not team membership."
      className="max-w-lg"
    >
      <div className="space-y-4">
        <div className="space-y-1">
          <Label>Team name</Label>
          <Input value={teamName} readOnly disabled className="bg-stone-50" />
        </div>
        <div className="space-y-1">
          <Label>Current HR</Label>
          <Input
            value={currentHrName}
            readOnly
            disabled
            className="bg-stone-50"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="new-hr">Select New HR</Label>
          <select
            id="new-hr"
            className={fieldClass}
            value={newHrId}
            onChange={(event) => setNewHrId(event.target.value)}
          >
            <option value="">Select HR staff</option>
            {candidates.map((group) => (
              <option key={group.id} value={group.id}>
                {group.label} – {group.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="reassign-reason">Reason</Label>
          <textarea
            id="reassign-reason"
            className="min-h-24 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-950"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Explain why HR responsibility is changing"
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="reassign-evidence">Evidence</Label>
          <Input
            id="reassign-evidence"
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,application/pdf,image/*"
            onChange={(event) =>
              setEvidence(event.target.files?.[0] ?? null)
            }
          />
          <p className="text-xs text-stone-500">
            PDF, Word, or image up to 10 MB. Required.
          </p>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={resetAndClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={reassignHr.isPending}
            onClick={confirm}
          >
            Confirm
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
