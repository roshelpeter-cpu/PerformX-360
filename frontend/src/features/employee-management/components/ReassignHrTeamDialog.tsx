import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { fieldClass } from "@/features/hr/components/ActionMenu";
import {
  useEligibleHrStaff,
  useReassignTeamHr,
} from "@/features/employee-management/hooks/useEmployeeManagement";

export function ReassignHrTeamDialog({
  open,
  onClose,
  teamId,
  teamName,
}: {
  open: boolean;
  onClose: () => void;
  teamId: string;
  teamName: string;
}) {
  const hrQuery = useEligibleHrStaff(open);
  const reassign = useReassignTeamHr();
  const [hrEmployeeId, setHrEmployeeId] = useState("");
  const [reason, setReason] = useState("");
  const hrStaff = hrQuery.data ?? [];

  useEffect(() => {
    if (!open) {
      setHrEmployeeId("");
      setReason("");
    }
  }, [open]);

  async function confirm() {
    if (!hrEmployeeId || !reason.trim()) return;
    await reassign.mutateAsync({
      teamId,
      hrEmployeeId,
      reason: reason.trim(),
    });
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Reassign team HR"
      description={`Change which HR is responsible for ${teamName}. Employees on this team will appear under the new HR.`}
    >
      <div className="space-y-3">
        <label className="block text-sm">
          <span className="mb-1 block text-stone-500">Responsible HR</span>
          <select
            className={fieldClass}
            value={hrEmployeeId}
            onChange={(event) => setHrEmployeeId(event.target.value)}
          >
            <option value="">Select HR</option>
            {hrStaff.map((hr) => (
              <option key={hr.id} value={hr.id}>
                {hr.name} ({hr.employeeId})
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-stone-500">Reason</span>
          <textarea
            className={`${fieldClass} h-24 py-2`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!hrEmployeeId || !reason.trim() || reassign.isPending}
            onClick={() => void confirm()}
          >
            Save assignment
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
