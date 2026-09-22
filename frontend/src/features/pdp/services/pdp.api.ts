import { apiRequest } from "@/services/api/client";

export interface PdpPerson {
  id: string;
  employeeId: string;
  name: string;
  jobTitle?: string | null;
  companyEmail?: string;
  role?: string;
  department?: { id: string; name: string } | null;
}

export interface PdpSubGoal {
  id: string;
  title: string;
  description: string;
  dueDate: string | null;
  expectedOutcome: string | null;
  successCriteria: string | null;
  sortOrder: number;
}

export interface PdpGoal {
  id: string;
  title: string;
  objective: string;
  expectedOutcome: string | null;
  dueDate: string | null;
  successCriteria: string | null;
  category: string | null;
  developmentArea: string | null;
  notes: string | null;
  priority: string;
  sortOrder: number;
  progress: number;
  status: string;
  subGoals: PdpSubGoal[];
}

export interface PdpApproval {
  id: string;
  reviewerRole: "EMPLOYEE" | "HR";
  status: "PENDING" | "APPROVED" | "CHANGES_REQUESTED";
  comment: string | null;
  respondedAt: string | null;
  reviewer: PdpPerson;
}

export interface PdpChangeRequest {
  id: string;
  requesterRole: "EMPLOYEE" | "HR";
  message: string;
  status: string;
  supervisorResponse: string | null;
  supervisorAction: string | null;
  hrDecision: string | null;
  hrDecisionNote: string | null;
  requestedBy: PdpPerson;
  createdAt: string;
  supervisorRespondedAt: string | null;
  hrDecidedAt: string | null;
}

export interface PdpActivity {
  id: string;
  action: string;
  message: string;
  createdAt: string;
  actor: PdpPerson;
  versionNumber?: number | null;
}

export interface PdpVersionSummary {
  id: string;
  versionNumber: number;
  title: string;
  summary: string | null;
  revisionReason: string | null;
  isCurrent: boolean;
  createdAt: string;
  createdBy: PdpPerson;
  goals: PdpGoal[];
  approvals: PdpApproval[];
}

export interface PdpPermissions {
  canEdit: boolean;
  canSendForApproval: boolean;
  canApproveAsEmployee: boolean;
  canRequestChangesAsEmployee: boolean;
  canApproveAsHr: boolean;
  canRequestChangesAsHr: boolean;
  canAssign: boolean;
  canActivate: boolean;
  canEscalate: boolean;
  canDecideAsHr: boolean;
  canCreateVersion: boolean;
}

export interface PdpDetail {
  id: string;
  title: string;
  summary: string | null;
  status: string;
  currentVersionNumber: number;
  createdAt: string;
  updatedAt: string;
  assignedAt: string | null;
  employee: PdpPerson;
  supervisor: PdpPerson | null;
  hr: PdpPerson | null;
  createdBy: PdpPerson;
  cycle: { id: string; name: string; status: string };
  currentVersion: PdpVersionSummary | null;
  versions: Array<{
    id: string;
    versionNumber: number;
    title: string;
    revisionReason: string | null;
    isCurrent: boolean;
    createdAt: string;
    createdBy: PdpPerson;
  }>;
  changeRequests: PdpChangeRequest[];
  activities: PdpActivity[];
  permissions: PdpPermissions;
  employeeApproval: PdpApproval | null;
  hrApproval: PdpApproval | null;
}

export interface PdpBoardRow {
  id: string | null;
  employee: PdpPerson & { supervisor?: PdpPerson | null; hr?: PdpPerson | null };
  pdp: {
    id: string;
    title: string;
    status: string;
    updatedAt: string;
    currentVersionNumber: number;
    employeeApprovalStatus: string | null;
    hrApprovalStatus: string | null;
  } | null;
}

export interface PdpBoard {
  kpis: {
    totalPdps: number;
    draft: number;
    pendingHrApproval: number;
    awaitingEmployeeApproval: number;
    changeRequests: number;
    approvedAndAssigned: number;
  };
  items: PdpBoardRow[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  cycle: { id: string; name: string };
}

export type GoalInput = {
  id?: string;
  title: string;
  objective: string;
  expectedOutcome?: string;
  dueDate?: string | null;
  successCriteria?: string;
  category?: string;
  developmentArea?: string;
  notes?: string;
  priority?: string;
  sortOrder?: number;
  subGoals?: Array<{
    id?: string;
    title: string;
    description: string;
    dueDate?: string | null;
    expectedOutcome?: string;
    successCriteria?: string;
    sortOrder?: number;
  }>;
};

export const pdpApi = {
  getBoard(params: Record<string, string | number | undefined>) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== "") query.set(key, String(value));
    });
    const suffix = query.toString() ? `?${query}` : "";
    return apiRequest<{ success: true; board: PdpBoard }>(`/pdps${suffix}`);
  },
  getMine() {
    return apiRequest<{ success: true; pdp: PdpDetail | null }>(`/pdps/mine`);
  },
  getOptions() {
    return apiRequest<{
      success: true;
      options: {
        employees: Array<PdpPerson & { hasPdp: boolean }>;
        cycle: { id: string; name: string };
      };
    }>(`/pdps/options`);
  },
  getPdp(pdpId: string) {
    return apiRequest<{ success: true; pdp: PdpDetail }>(`/pdps/${pdpId}`);
  },
  getVersion(pdpId: string, versionNumber: number) {
    return apiRequest<{ success: true; version: PdpVersionSummary }>(
      `/pdps/${pdpId}/versions/${versionNumber}`
    );
  },
  create(body: { employeeId: string; title?: string; summary?: string; goals?: GoalInput[] }) {
    return apiRequest<{ success: true; pdp: PdpDetail }>(`/pdps`, {
      method: "POST",
      body,
    });
  },
  update(
    pdpId: string,
    body: { title?: string; summary?: string; goals?: GoalInput[]; revisionReason?: string }
  ) {
    return apiRequest<{ success: true; pdp: PdpDetail }>(`/pdps/${pdpId}`, {
      method: "PUT",
      body,
    });
  },
  sendForApproval(pdpId: string) {
    return apiRequest<{ success: true; pdp: PdpDetail }>(`/pdps/${pdpId}/send-for-approval`, {
      method: "POST",
    });
  },
  employeeApprove(pdpId: string) {
    return apiRequest<{ success: true; pdp: PdpDetail }>(`/pdps/${pdpId}/employee/approve`, {
      method: "POST",
    });
  },
  employeeRequestChanges(pdpId: string, reason: string) {
    return apiRequest<{ success: true; pdp: PdpDetail }>(`/pdps/${pdpId}/employee/request-changes`, {
      method: "POST",
      body: { reason },
    });
  },
  hrApprove(pdpId: string) {
    return apiRequest<{ success: true; pdp: PdpDetail }>(`/pdps/${pdpId}/hr/approve`, {
      method: "POST",
    });
  },
  hrRequestChanges(pdpId: string, reason: string) {
    return apiRequest<{ success: true; pdp: PdpDetail }>(`/pdps/${pdpId}/hr/request-changes`, {
      method: "POST",
      body: { reason },
    });
  },
  supervisorCannotChange(pdpId: string, changeRequestId: string, reason: string) {
    return apiRequest<{ success: true; pdp: PdpDetail }>(`/pdps/${pdpId}/supervisor/cannot-change`, {
      method: "POST",
      body: { changeRequestId, reason },
    });
  },
  hrDecision(
    pdpId: string,
    body: { changeRequestId: string; decision: "CHANGE_MUST_HAPPEN" | "CHANGE_NOT_REQUIRED"; note?: string }
  ) {
    return apiRequest<{ success: true; pdp: PdpDetail }>(`/pdps/${pdpId}/hr/decision`, {
      method: "POST",
      body,
    });
  },
  assign(pdpId: string) {
    return apiRequest<{ success: true; pdp: PdpDetail }>(`/pdps/${pdpId}/assign`, {
      method: "POST",
    });
  },
  activate(pdpId: string) {
    return apiRequest<{ success: true; pdp: PdpDetail }>(`/pdps/${pdpId}/activate`, {
      method: "POST",
    });
  },
};
