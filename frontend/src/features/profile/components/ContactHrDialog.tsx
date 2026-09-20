import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { fieldClass } from "@/features/hr/components/ActionMenu";
import { useSubmitProfileChangeRequest } from "@/features/profile/hooks/useProfileRequests";
import {
  REQUEST_FORM_TYPES,
  REQUEST_TYPE_LABELS,
  type ProfileChangeRequestType,
} from "@/features/profile/services/profile-requests.api";
import type { DashboardProfile } from "@/features/dashboard/services/dashboard.api";

function currentForType(profile: DashboardProfile | undefined, type: ProfileChangeRequestType) {
  if (!profile) return "";
  if (type === "CONTACT_NUMBER" || type === "CONTACT_INFORMATION") return profile.contactNumber ?? "";
  if (type === "ADDRESS" || type === "EMPLOYMENT_INFORMATION") return profile.workLocation ?? "";
  if (type === "EMAIL") return profile.companyEmail;
  if (type === "NAME" || type === "PERSONAL_INFORMATION") return profile.name;
  if (type === "EMERGENCY_CONTACT") {
    return [profile.emergencyContactName, profile.emergencyContactRelationship, profile.emergencyContactNumber]
      .filter(Boolean)
      .join(" · ");
  }
  return "";
}

export function ContactHrDialog({
  open,
  onClose,
  title,
  profile,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  profile?: DashboardProfile;
}) {
  const submit = useSubmitProfileChangeRequest();
  const [requestType, setRequestType] = useState<ProfileChangeRequestType>("CONTACT_NUMBER");
  const [currentValue, setCurrentValue] = useState("");
  const [requestedValue, setRequestedValue] = useState("");
  const [reason, setReason] = useState("");
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (open) setCurrentValue(currentForType(profile, requestType));
  }, [open, profile, requestType]);

  function reset() {
    setRequestType("CONTACT_NUMBER");
    setRequestedValue("");
    setReason("");
    setFile(null);
  }

  async function onSubmit() {
    const form = new FormData();
    form.append("requestType", requestType);
    form.append("summary", `${REQUEST_TYPE_LABELS[requestType]} Update`);
    form.append("currentValue", currentValue);
    form.append("requestedValue", requestedValue);
    form.append("reason", reason);
    if (file) form.append("evidence", file);
    await submit.mutateAsync(form);
    reset();
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description="Submit a profile change request in the app. This does not open email."
      className="max-w-2xl"
    >
      <div className="space-y-3">
        <label className="block text-sm">
          <span className="mb-1 block text-stone-500">Request Type</span>
          <select
            className={fieldClass}
            value={requestType}
            onChange={(event) => setRequestType(event.target.value as ProfileChangeRequestType)}
          >
            {REQUEST_FORM_TYPES.map((type) => (
              <option key={type} value={type}>
                {REQUEST_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-stone-500">Current Information</span>
          <textarea
            className={`${fieldClass} h-20 py-2`}
            value={currentValue}
            onChange={(event) => setCurrentValue(event.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-stone-500">Requested Information</span>
          <textarea
            className={`${fieldClass} h-20 py-2`}
            value={requestedValue}
            onChange={(event) => setRequestedValue(event.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-stone-500">Reason for Change</span>
          <textarea
            className={`${fieldClass} h-24 py-2`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-stone-500">Supporting Evidence</span>
          <input
            type="file"
            className="block w-full text-sm text-stone-600 file:mr-3 file:rounded-lg file:border-0 file:bg-stone-100 file:px-3 file:py-2"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!currentValue.trim() || !requestedValue.trim() || !reason.trim() || submit.isPending}
            onClick={() => void onSubmit()}
          >
            Submit Request
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
