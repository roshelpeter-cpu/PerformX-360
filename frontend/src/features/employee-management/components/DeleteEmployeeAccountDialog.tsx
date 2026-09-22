import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useDeactivateEmployee } from "../hooks/useEmployeeManagement";

const ROLE_LABELS: Record<string, string> = {
  EMPLOYEE: "Employee",
  SUPERVISOR: "Supervisor",
  HR: "HR",
  HR_MANAGER: "HR Manager",
  LEADERSHIP: "Leadership",
};

export function DeleteEmployeeAccountDialog({
  employeeId,
  name,
  employeeCode,
  jobTitle,
  role,
  onClose,
}: {
  employeeId: string;
  name: string;
  employeeCode: string;
  jobTitle: string;
  role: string;
  onClose: () => void;
}) {
  const deactivate = useDeactivateEmployee();

  return (
    <Dialog
      open
      onClose={onClose}
      title="Delete Account?"
      description="Review the account details before confirming deletion."
    >
      <div className="space-y-4 text-sm">
        <dl className="space-y-2 rounded-xl border border-stone-200 p-4 dark:border-stone-700">
          <div className="flex justify-between gap-4">
            <dt className="text-stone-500">Full Name</dt>
            <dd className="font-medium text-stone-900 dark:text-stone-100">{name}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-stone-500">Employee ID</dt>
            <dd className="font-medium">{employeeCode}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-stone-500">Job Title</dt>
            <dd className="font-medium">{jobTitle || "—"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-stone-500">Role</dt>
            <dd className="font-medium">{ROLE_LABELS[role] ?? role}</dd>
          </div>
        </dl>
        <p className="rounded-xl bg-red-50 px-3 py-2 text-red-700 dark:bg-red-950/30 dark:text-red-300">
          Deleting this account will remove the user&apos;s access to PerformX 360. This action cannot be undone.
          Historical appraisal, PDP, and meeting records are preserved.
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-red-600 text-white hover:bg-red-700"
            disabled={deactivate.isPending}
            onClick={() => void deactivate.mutateAsync(employeeId).then(onClose)}
          >
            {deactivate.isPending ? "Deleting..." : "Delete Account"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
