import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function RespondMeetingDialog({
  open,
  title,
  description,
  requireReason,
  pending,
  confirmLabel,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  description: string;
  requireReason: boolean;
  pending: boolean;
  confirmLabel: string;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<unknown>;
}) {
  const [reason, setReason] = useState("");

  return (
    <Dialog open={open} onClose={onClose} title={title} description={description}>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit(reason).then(() => {
            setReason("");
            onClose();
          });
        }}
      >
        {requireReason ? (
          <label className="block text-sm">
            Reason (required)
            <textarea
              className="mt-1 min-h-24 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-950"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              required
              maxLength={500}
            />
            <p className="mt-1 text-right text-xs text-stone-400">{reason.length}/500</p>
          </label>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : confirmLabel}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
