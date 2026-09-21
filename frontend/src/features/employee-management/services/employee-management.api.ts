import { apiRequest } from "@/services/api/client";
import type {
  DashboardPersonRef,
  DashboardProfile,
} from "@/features/dashboard/services/dashboard.api";

export interface TeamMemberPdp {
  status: string;
  progressPercent: number;
  label: string;
  active: boolean;
}

export interface TeamMemberRow {
  id: string;
  employeeId: string;
  name: string;
  jobTitle: string;
  companyEmail: string;
  role: string;
  avatarUrl?: string;
  department: { id: string; name: string } | null;
  team: { id: string; name: string } | null;
  batch: { id: string; name: string; batchNumber: number } | null;
  pdp: TeamMemberPdp;
  status: string;
  reviewCompleted: boolean;
}

export interface SupervisorTeamPayload {
  cycle: { id: string; name: string; startDate: string; endDate: string } | null;
  summary: {
    teamSize: number;
    filteredCount: number;
    activePdps: number;
    avgPdpProgress: number;
    completedReviews: number;
  };
  filters: {
    batches: Array<{ id: string; name: string; batchNumber: number }>;
    departments: Array<{ id: string; name: string }>;
    statuses: string[];
  };
  employees: TeamMemberRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface HierarchyTeamGroup {
  id: string;
  name: string;
  department: { id: string; name: string } | null;
  employees: TeamMemberRow[];
}

export interface HierarchySupervisorNode {
  id: string;
  employeeId: string;
  name: string;
  jobTitle: string;
  role: string;
  avatarUrl: string;
  department: { id: string; name: string } | null;
  team: { id: string; name: string } | null;
  employeeCount: number;
  employees: TeamMemberRow[];
  teams: HierarchyTeamGroup[];
}

export interface HierarchyHrNode {
  id: string;
  employeeId: string;
  name: string;
  jobTitle: string;
  role: string;
  avatarUrl: string;
  status: string;
  joinedAt: string;
  teamName: string | null;
  department: { id: string; name: string } | null;
  supervisorCount: number;
  employeeCount: number;
  supervisors: HierarchySupervisorNode[];
}

export interface OrgHierarchyPayload {
  viewerRole: string;
  groups: HierarchyHrNode[];
  summary: {
    hrMembers: number;
    supervisorCount: number;
    teamCount: number;
    totalEmployees: number;
    ongoingProcesses: number;
    employeeCoveragePercent: number;
  };
  filters: {
    departments: Array<{ id: string; name: string }>;
    teams: Array<{ id: string; name: string }>;
    statuses: string[];
  };
}

export type ManagedProfile = DashboardProfile & {
  supervisor?: DashboardPersonRef | null;
};

export interface EligibleSupervisor {
  id: string;
  employeeId: string;
  name: string;
  jobTitle: string | null;
  department: { id: string; name: string } | null;
  teams: Array<{ id: string; name: string }>;
}

export interface EligibleTeam {
  id: string;
  name: string;
  department: { id: string; name: string } | null;
  supervisor: DashboardPersonRef | null;
}

export interface EligibleHrStaff {
  id: string;
  employeeId: string;
  name: string;
  jobTitle: string | null;
  companyEmail: string;
}

export const employeeManagementApi = {
  getMyTeam(params: Record<string, string | number | undefined>) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== "") query.set(key, String(value));
    });
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return apiRequest<{ success: true; team: SupervisorTeamPayload }>(
      `/employee-management/my-team${suffix}`
    );
  },
  getHierarchy(params: Record<string, string | undefined>) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) query.set(key, value);
    });
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return apiRequest<{ success: true; hierarchy: OrgHierarchyPayload }>(
      `/employee-management/hierarchy${suffix}`
    );
  },
  getProfile(employeeId: string) {
    return apiRequest<{ success: true; profile: ManagedProfile }>(
      `/employee-management/employees/${employeeId}`
    );
  },
  getEligibleSupervisors(employeeId: string) {
    return apiRequest<{ success: true; supervisors: EligibleSupervisor[] }>(
      `/employee-management/employees/${employeeId}/eligible-supervisors`
    );
  },
  reassignEmployee(
    employeeId: string,
    body: { supervisorId: string; teamId?: string; reason: string }
  ) {
    return apiRequest<{ success: true; profile: ManagedProfile }>(
      `/employee-management/employees/${employeeId}/reassign`,
      { method: "POST", body }
    );
  },
  getEligibleTeams(departmentId?: string) {
    const suffix = departmentId ? `?departmentId=${encodeURIComponent(departmentId)}` : "";
    return apiRequest<{ success: true; teams: EligibleTeam[] }>(
      `/employee-management/teams${suffix}`
    );
  },
  getHrStaff() {
    return apiRequest<{ success: true; hrStaff: EligibleHrStaff[] }>(
      "/employee-management/hr-staff"
    );
  },
  reassignTeamHr(teamId: string, body: { hrEmployeeId: string; reason: string }) {
    return apiRequest<{ success: true }>(
      `/employee-management/teams/${teamId}/reassign-hr`,
      { method: "POST", body }
    );
  },
  reassignSupervisorHr(
    supervisorId: string,
    body: { hrEmployeeId: string; reason: string }
  ) {
    return apiRequest<{ success: true }>(
      `/employee-management/supervisors/${supervisorId}/reassign-hr`,
      { method: "POST", body }
    );
  },
  createAccount(body: Record<string, unknown>) {
    return apiRequest<{
      success: true;
      profile: ManagedProfile;
      temporaryPassword: string;
    }>("/employee-management/accounts", { method: "POST", body });
  },
  nextEmployeeId(role: string) {
    return apiRequest<{ success: true; employeeId: string }>(
      `/employee-management/next-employee-id?role=${encodeURIComponent(role)}`
    );
  },
};
