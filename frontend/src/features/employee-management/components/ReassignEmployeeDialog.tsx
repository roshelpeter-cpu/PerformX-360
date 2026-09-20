import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { fieldClass } from "@/features/hr/components/ActionMenu";
import {
  useEligibleSupervisors,
  useReassignEmployee,
} from "@/features/employee-management/hooks/useEmployeeManagement";

export function ReassignEmployeeDialog({
  open,
  onClose,
  employeeId,
  employeeName,
}: {
  open: boolean;
  onClose: () => void;
  employeeId: string;
  employeeName: string;
}) {
  const supervisorsQuery = useEligibleSupervisors(employeeId, open);
  const reassign = useReassignEmployee();
  const [supervisorId, setSupervisorId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [reason, setReason] = useState("");

  const supervisors = supervisorsQuery.data ?? [];
  const selected = supervisors.find((item) => item.id === supervisorId);

  async function confirm() {
    if (!supervisorId || !reason.trim()) return;
    await reassign.mutateAsync({
      employeeId,
      supervisorId,
      teamId: teamId || undefined,
      reason: reason.trim(),
    });
    setSupervisorId("");
    setTeamId("");
    setReason("");
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Reassign employee"
      description={`Move ${employeeName} to another supervisor on your authorised teams. Department stays the same.`}
    >
      <div className="space-y-3">
        <label className="block text-sm">
          <span className="mb-1 block text-stone-500">Supervisor</span>
          <select
            className={fieldClass}
            value={supervisorId}
            onChange={(event) => {
              setSupervisorId(event.target.value);
              setTeamId("");
            }}
          >
            <option value="">Select supervisor</option>
            {supervisors.map((supervisor) => (
              <option key={supervisor.id} value={supervisor.id}>
                {supervisor.name} ({supervisor.employeeId})
              </option>
            ))}
          </select>
        </label>
        {selected && selected.teams.length > 1 ? (
          <label className="block text-sm">
            <span className="mb-1 block text-stone-500">Team</span>
            <select
              className={fieldClass}
              value={teamId}
              onChange={(event) => setTeamId(event.target.value)}
            >
              <option value="">Default team</option>
              {selected.teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
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
            disabled={!supervisorId || !reason.trim() || reassign.isPending}
            onClick={() => void confirm()}
          >
            Save assignment
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
