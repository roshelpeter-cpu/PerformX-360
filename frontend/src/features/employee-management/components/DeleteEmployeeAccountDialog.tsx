import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useDeactivateEmployee } from "../hooks/useEmployeeManagement";

export function DeleteEmployeeAccountDialog({
  employeeId,
  employeeName,
  onClose,
}: {
  employeeId: string;
  employeeName: string;
  onClose: () => void;
}) {
  const deactivate = useDeactivateEmployee();

  return (
    <Dialog
      open
      onClose={onClose}
      title="Delete Employee Account?"
      description={`This will deactivate ${employeeName}'s account and remove login access. Historical appraisal, PDP, and meeting records are kept. This cannot be undone from this screen.`}
    >
      <div className="space-y-4">
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
          The employee will no longer appear in active Employee Management lists and will not be able to sign in.
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
