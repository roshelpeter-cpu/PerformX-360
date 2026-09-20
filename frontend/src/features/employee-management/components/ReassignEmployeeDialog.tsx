import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { fieldClass } from "@/features/hr/components/ActionMenu";
import {
  useEligibleSupervisors,
  useEligibleTeams,
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
  const teamsQuery = useEligibleTeams(open);
  const reassign = useReassignEmployee();
  const [supervisorId, setSupervisorId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [reason, setReason] = useState("");

  const supervisors = supervisorsQuery.data ?? [];
  const teams = teamsQuery.data ?? [];
  const selectedTeam = teams.find((team) => team.id === teamId);

  useEffect(() => {
    if (!open) {
      setSupervisorId("");
      setTeamId("");
      setReason("");
    }
  }, [open]);

  async function confirm() {
    if (!supervisorId || !teamId || !reason.trim()) return;
    await reassign.mutateAsync({
      employeeId,
      supervisorId,
      teamId,
      reason: reason.trim(),
    });
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Reassign employee"
      description={`Move ${employeeName} to another team and supervisor. The organisation hierarchy and profiles update immediately.`}
    >
      <div className="space-y-3">
        <label className="block text-sm">
          <span className="mb-1 block text-stone-500">Team</span>
          <select
            className={fieldClass}
            value={teamId}
            onChange={(event) => {
              const nextTeamId = event.target.value;
              setTeamId(nextTeamId);
              const team = teams.find((item) => item.id === nextTeamId);
              if (team?.supervisor?.id) setSupervisorId(team.supervisor.id);
            }}
          >
            <option value="">Select team</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
                {team.supervisor ? ` · ${team.supervisor.name}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-stone-500">Supervisor</span>
          <select
            className={fieldClass}
            value={supervisorId}
            onChange={(event) => setSupervisorId(event.target.value)}
          >
            <option value="">Select supervisor</option>
            {supervisors.map((supervisor) => (
              <option key={supervisor.id} value={supervisor.id}>
                {supervisor.name} ({supervisor.employeeId})
              </option>
            ))}
          </select>
        </label>
        {selectedTeam?.supervisor && selectedTeam.supervisor.id !== supervisorId ? (
          <p className="text-xs text-amber-700">
            This team is currently led by {selectedTeam.supervisor.name}. Confirm the
            supervisor matches the destination team.
          </p>
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
            disabled={!supervisorId || !teamId || !reason.trim() || reassign.isPending}
            onClick={() => void confirm()}
          >
            Save assignment
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
