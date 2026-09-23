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

export interface PdpEvidenceFile {
  fileName: string;
  storedName: string;
  mimeType?: string | null;
  size?: number | null;
  uploadedAt?: string | null;
}

export type PdpSubGoalStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "PENDING_APPROVAL"
  | "COMPLETED"
  | "CHANGES_REQUESTED";

export interface PdpSubGoal {
  id: string;
  title: string;
  description: string;
  dueDate: string | null;
  expectedOutcome: string | null;
  successCriteria: string | null;
  sortOrder: number;
  status?: PdpSubGoalStatus;
  submittedStatus?: PdpSubGoalStatus | null;
  evidenceCount?: number;
  comment?: string | null;
  completedAt?: string | null;
  approvedAt?: string | null;
  reviewedAt?: string | null;
  reviewedBy?: PdpPerson | null;
  supervisorComment?: string | null;
  evidenceFiles?: PdpEvidenceFile[];
  scoreWeight?: number;
  scoreEarned?: number;
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
  scoreWeight?: number;
  scoreEarned?: number;
  approvedSubGoalCount?: number;
  progressPercent?: number;
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
  canReviewSubGoals?: boolean;
  canAddActiveGoals?: boolean;
  canUpdateSubGoals?: boolean;
  isHrViewOnly?: boolean;
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
  activatedAt?: string | null;
  employee: PdpPerson;
  supervisor: PdpPerson | null;
  hr: PdpPerson | null;
  createdBy: PdpPerson;
  cycle: {
    id: string;
    name: string;
    status: string;
    startDate?: string;
    endDate?: string;
  };
  scoring?: {
    totalWeight: number;
    earnedPoints: number;
    progressPercent: number;
    mainGoalCount: number;
  };
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
  employee: PdpPerson & {
    supervisor?: PdpPerson | null;
    hr?: PdpPerson | null;
    team?: { id: string; name: string } | null;
  };
  pdp: {
    id: string;
    title: string;
    status: string;
    updatedAt: string;
    currentVersionNumber: number;
    employeeApprovalStatus: string | null;
    hrApprovalStatus: string | null;
    overallProgress?: number;
    earnedPoints?: number;
    pendingReviews?: number;
    completedSubGoals?: number;
    totalSubGoals?: number;
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
    status?: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
    evidenceCount?: number;
    comment?: string | null;
  }>;
};

export interface EvaluationOverview {
  cycle: { id: string; name: string; startDate: string; endDate: string };
  kpis: {
    totalEmployees: number;
    employeesWithPdps: number;
    averageProgress: number;
    pendingSupervisorReviews: number;
    completedSelfReviews: number;
    pendingSelfReviews: number;
    completedEvaluations: number;
    requiringAttention: number;
  };
  departments: Array<{
    name: string;
    employees: number;
    averageProgress: number;
    selfReviewsSubmitted: number;
    pendingReviews: number;
    status: string;
    people: Array<{
      id: string;
      employeeId: string;
      name: string;
      department: string;
      team: string;
      supervisor: string;
      pdpStatus: string;
      progress: number;
      pendingReviews: number;
      selfReviewStatus: string;
      updatedAt: string | null;
    }>;
  }>;
  attention: Array<{
    id: string;
    employeeId: string;
    name: string;
    department: string;
    issue: string;
    pendingReviews: number;
    progress: number;
  }>;
}

export const pdpApi = {
  getBoard(params: Record<string, string | number | undefined>) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== "") query.set(key, String(value));
    });
    const suffix = query.toString() ? `?${query}` : "";
    return apiRequest<{ success: true; board: PdpBoard }>(`/pdps${suffix}`);
  },
  getEvaluationOverview() {
    return apiRequest<{ success: true; overview: EvaluationOverview }>(`/pdps/evaluation-overview`);
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
  getByEmployee(employeeId: string) {
    return apiRequest<{ success: true; pdp: PdpDetail | null }>(`/pdps/by-employee/${employeeId}`);
  },
  getPendingApprovals() {
    return apiRequest<{
      success: true;
      items: Array<{
        id: string;
        title: string;
        description: string;
        comment: string | null;
        completedAt: string | null;
        evidenceCount: number;
        evidenceFiles: PdpEvidenceFile[];
        goal: { id: string; title: string };
        pdp: {
          id: string;
          title: string;
          employee: PdpPerson;
          supervisor: PdpPerson | null;
        };
      }>;
    }>(`/pdps/pending-approvals`);
  },
  updateSubGoal(
    pdpId: string,
    subGoalId: string,
    body: { status?: string; comment?: string | null; markComplete?: boolean },
    file?: File | null
  ) {
    if (file) {
      const form = new FormData();
      if (body.status) form.append("status", body.status);
      if (body.comment != null) form.append("comment", body.comment);
      if (body.markComplete) form.append("markComplete", "true");
      form.append("evidence", file);
      return apiRequest<{ success: true; pdp: PdpDetail }>(
        `/pdps/${pdpId}/sub-goals/${subGoalId}`,
        { method: "PATCH", body: form }
      );
    }
    return apiRequest<{ success: true; pdp: PdpDetail }>(`/pdps/${pdpId}/sub-goals/${subGoalId}`, {
      method: "PATCH",
      body,
    });
  },
  approveSubGoal(pdpId: string, subGoalId: string, comment?: string | null) {
    return apiRequest<{ success: true; pdp: PdpDetail }>(
      `/pdps/${pdpId}/sub-goals/${subGoalId}/approve`,
      { method: "POST", body: { comment: comment ?? null } }
    );
  },
  requestSubGoalChanges(pdpId: string, subGoalId: string, reason: string) {
    return apiRequest<{ success: true; pdp: PdpDetail }>(
      `/pdps/${pdpId}/sub-goals/${subGoalId}/request-changes`,
      { method: "POST", body: { reason } }
    );
  },
  addGoal(
    pdpId: string,
    body: {
      title: string;
      objective?: string;
      expectedOutcome?: string;
      successCriteria?: string;
      category?: string;
      subGoals?: Array<{
        title: string;
        description?: string;
        dueDate?: string | null;
        expectedOutcome?: string | null;
        successCriteria?: string | null;
      }>;
    }
  ) {
    return apiRequest<{ success: true; pdp: PdpDetail }>(`/pdps/${pdpId}/goals`, {
      method: "POST",
      body,
    });
  },
  addSubGoal(
    pdpId: string,
    goalId: string,
    body: {
      title: string;
      description?: string;
      dueDate?: string | null;
      expectedOutcome?: string | null;
      successCriteria?: string | null;
    }
  ) {
    return apiRequest<{ success: true; pdp: PdpDetail }>(
      `/pdps/${pdpId}/goals/${goalId}/sub-goals`,
      { method: "POST", body }
    );
  },
};
