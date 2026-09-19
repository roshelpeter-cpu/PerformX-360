import { apiRequest } from "@/services/api/client";

export interface DashboardPersonRef {
  id: string;
  employeeId: string;
  name: string;
  jobTitle: string | null;
  companyEmail: string;
}

export interface DashboardProfile {
  id: string;
  employeeId: string;
  name: string;
  role: "EMPLOYEE" | "SUPERVISOR" | "HR" | "HR_MANAGER" | "LEADERSHIP";
  companyEmail: string;
  jobTitle: string | null;
  createdAt?: string;
  accountStatus?: string;
  lastLoginAt?: string | null;
  dateOfBirth?: string;
  gender?: string;
  nationality?: string;
  contactNumber?: string;
  employmentType?: string;
  workLocation?: string;
  dateJoined?: string;
  emergencyContactName?: string;
  emergencyContactRelationship?: string;
  emergencyContactNumber?: string;
  avatarUrl?: string;
  department: { id: string; name: string } | null;
  team?: {
    id: string;
    name: string;
    supervisor: DashboardPersonRef | null;
  } | null;
}

export interface DashboardNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  status: "UNREAD" | "READ";
  createdAt: string;
}

export interface DashboardCycle {
  id: string;
  name: string;
  status: string;
  startDate: string;
  endDate: string;
  description?: string | null;
}

export interface DashboardBatch {
  id: string;
  name: string;
  batchNumber: number;
  status?: string;
  currentStage?: string;
  startDate?: string;
  endDate?: string;
}

export interface DashboardTeamMember {
  id: string;
  employeeId: string;
  name: string;
  jobTitle: string | null;
  companyEmail: string;
  department: { id: string; name: string } | null;
  batch: { id: string; name: string; batchNumber: number } | null;
}

export interface DashboardPayload {
  role: DashboardProfile["role"];
  profile: DashboardProfile;
  cycle?: DashboardCycle | null;
  batch?: DashboardBatch | null;
  supervisor?: DashboardPersonRef | null;
  team?: DashboardTeamMember[];
  teamCount?: number;
  workforce?: {
    totalAssignableEmployees: number;
    supervisorCount: number;
    departmentCount: number;
    employeesInCycles: number;
    activeCycles: number;
    upcomingCycles: number;
    completedCycles: number;
    draftCycles: number;
  };
  currentCycle?: unknown;
  cycles?: Array<{
    id: string;
    name: string;
    status: string;
    startDate: string;
    endDate: string;
    year?: number;
    employeeCount?: number;
    supervisorCount?: number;
  }>;
  departments?: Array<{ id: string; name: string; employeeCount: number }>;
  pendingPasswordResets?: number;
  stats?: Array<{
    label: string;
    value: number;
    hint?: string;
    change?: string;
  }>;
  activities?: Array<{
    id: string;
    when: string;
    time: string;
    title: string;
    detail: string;
  }>;
  pendingActions?: Array<{
    count: number;
    title: string;
    detail: string;
  }>;
  keyDates?: Array<{ label: string; date: string }>;
  notifications: DashboardNotification[];
  unreadCount: number;
}

export async function getMyDashboardRequest() {
  return apiRequest<{ success: true; dashboard: DashboardPayload }>(
    "/dashboard/me"
  );
}
