import { apiDownload, apiRequest } from "@/services/api/client";

export type ProfileChangeRequestType =
  | "PERSONAL_INFORMATION"
  | "CONTACT_INFORMATION"
  | "EMERGENCY_CONTACT"
  | "EMPLOYMENT_INFORMATION"
  | "OTHER"
  | "CONTACT_NUMBER"
  | "ADDRESS"
  | "EMAIL"
  | "NAME";

export type ProfileChangeRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface ProfileChangeRequest {
  id: string;
  requestType: ProfileChangeRequestType;
  summary: string;
  currentValue: string;
  requestedValue: string;
  reason: string;
  status: ProfileChangeRequestStatus;
  evidenceName: string | null;
  evidenceMime: string | null;
  evidenceSize: number | null;
  hasEvidence: boolean;
  createdAt: string;
  reviewedAt: string | null;
  requester: {
    id: string;
    employeeId: string;
    name: string;
    jobTitle: string | null;
    role: string;
    companyEmail: string;
    department: { id: string; name: string } | null;
    team: { id: string; name: string } | null;
  };
  recipient: {
    id: string;
    employeeId: string;
    name: string;
    role: string;
  };
}

export const REQUEST_TYPE_LABELS: Record<ProfileChangeRequestType, string> = {
  PERSONAL_INFORMATION: "Name",
  CONTACT_INFORMATION: "Contact Number",
  EMERGENCY_CONTACT: "Emergency Contact",
  EMPLOYMENT_INFORMATION: "Address",
  OTHER: "Other",
  CONTACT_NUMBER: "Contact Number",
  ADDRESS: "Address",
  EMAIL: "Email",
  NAME: "Name",
};

export const REQUEST_FORM_TYPES: ProfileChangeRequestType[] = [
  "CONTACT_NUMBER",
  "ADDRESS",
  "EMAIL",
  "EMERGENCY_CONTACT",
  "NAME",
  "OTHER",
];

export const profileRequestsApi = {
  submit(form: FormData) {
    return apiRequest<{ success: true; request: ProfileChangeRequest }>(
      "/profile-requests",
      { method: "POST", body: form }
    );
  },
  list(status?: string) {
    const suffix = status ? `?status=${encodeURIComponent(status)}` : "";
    return apiRequest<{ success: true; requests: ProfileChangeRequest[] }>(
      `/profile-requests${suffix}`
    );
  },
  review(requestId: string, decision: "APPROVED" | "REJECTED") {
    return apiRequest<{ success: true; request: ProfileChangeRequest }>(
      `/profile-requests/${requestId}/review`,
      { method: "POST", body: { decision } }
    );
  },
  downloadEvidence(requestId: string, filename: string) {
    return apiDownload(`/profile-requests/${requestId}/evidence`, filename);
  },
};
