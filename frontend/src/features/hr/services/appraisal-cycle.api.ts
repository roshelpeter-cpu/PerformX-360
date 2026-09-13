import { apiRequest } from "@/services/api/client";
import type {
  ActivationReadiness,
  AppraisalCycle,
  CreateCyclePayload,
  CycleActivity,
  CycleEmployeeRow,
  HrGroupSummary,
  HrTeamRow,
} from "../types";

function toQuery(params: Record<string, string | number | boolean | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "" || value === false) continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export const appraisalCycleApi = {
  listCycles: (filters?: { search?: string; status?: string; year?: number }) =>
    apiRequest<{ success: true; cycles: AppraisalCycle[] }>(
      `/hr/appraisal-cycles${toQuery(filters ?? {})}`
    ),

  getCurrent: () =>
    apiRequest<{ success: true; cycle: AppraisalCycle | null }>(
      "/hr/appraisal-cycles/current"
    ),

  getHistoryCycles: () =>
    apiRequest<{ success: true; cycles: AppraisalCycle[] }>(
      "/hr/appraisal-cycles/history"
    ),

  getWorkforce: () =>
    apiRequest<{
      success: true;
      workforce: {
        totalAssignableEmployees: number;
        supervisorCount: number;
        departmentCount: number;
        employeesInCycles: number;
        activeCycles: number;
        upcomingCycles: number;
        completedCycles: number;
        draftCycles: number;
      };
    }>("/hr/appraisal-cycles/workforce"),

  getRecentActivity: () =>
    apiRequest<{ success: true; activities: CycleActivity[] }>(
      "/hr/appraisal-cycles/activity"
    ),

  getCycle: (id: string) =>
    apiRequest<{ success: true; cycle: AppraisalCycle }>(
      `/hr/appraisal-cycles/${id}`
    ),

  createCycle: (payload: CreateCyclePayload) =>
    apiRequest<{ success: true; cycle: AppraisalCycle }>(
      "/hr/appraisal-cycles",
      { method: "POST", body: payload }
    ),

  updateCycle: (id: string, payload: Partial<CreateCyclePayload>) =>
    apiRequest<{ success: true; cycle: AppraisalCycle }>(
      `/hr/appraisal-cycles/${id}`,
      { method: "PATCH", body: payload }
    ),

  confirmCycle: (id: string) =>
    apiRequest<{ success: true; cycle: AppraisalCycle }>(
      `/hr/appraisal-cycles/${id}/confirm`,
      { method: "POST" }
    ),

  getActivationReadiness: (id: string) =>
    apiRequest<{ success: true; readiness: ActivationReadiness }>(
      `/hr/appraisal-cycles/${id}/activation-readiness`
    ),

  activateCycle: (id: string) =>
    apiRequest<{ success: true; cycle: AppraisalCycle }>(
      `/hr/appraisal-cycles/${id}/activate`,
      { method: "POST" }
    ),

  completeCycle: (id: string) =>
    apiRequest<{ success: true; cycle: AppraisalCycle }>(
      `/hr/appraisal-cycles/${id}/complete`,
      { method: "POST" }
    ),

  deleteCycle: (id: string) =>
    apiRequest<{ success: true; id: string; deleted: true }>(
      `/hr/appraisal-cycles/${id}`,
      { method: "DELETE" }
    ),

  listHrGroups: (cycleId: string, search?: string) =>
    apiRequest<{ success: true; groups: HrGroupSummary[] }>(
      `/hr/appraisal-cycles/${cycleId}/hr-groups${toQuery({ search })}`
    ),

  getHrGroup: (cycleId: string, hrEmployeeId: string) =>
    apiRequest<{
      success: true;
      hr: HrGroupSummary & { label?: string };
      teamCount: number;
      employeeCount: number;
      teams: HrTeamRow[];
    }>(`/hr/appraisal-cycles/${cycleId}/hr-groups/${hrEmployeeId}`),

  reassignHr: (
    cycleId: string,
    teamId: string,
    payload: { newHrEmployeeId: string; reason?: string }
  ) =>
    apiRequest<{ success: true; teams: HrTeamRow[] }>(
      `/hr/appraisal-cycles/${cycleId}/teams/${teamId}/reassign-hr`,
      { method: "POST", body: payload }
    ),

  listEmployees: (
    cycleId: string,
    filters: {
      search?: string;
      departmentId?: string;
      page?: number;
      pageSize?: number;
    }
  ) =>
    apiRequest<{
      success: true;
      employees: CycleEmployeeRow[];
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    }>(
      `/hr/appraisal-cycles/${cycleId}/employees${toQuery({
        search: filters.search,
        departmentId: filters.departmentId,
        page: filters.page,
        pageSize: filters.pageSize,
      })}`
    ),

  listDepartments: () =>
    apiRequest<{
      success: true;
      departments: Array<{
        id: string;
        name: string;
        _count: { employees: number; teams?: number };
      }>;
    }>("/hr/appraisal-cycles/departments"),
};
