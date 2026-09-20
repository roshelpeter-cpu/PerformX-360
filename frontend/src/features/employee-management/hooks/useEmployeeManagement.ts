import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiClientError } from "@/services/api/client";
import { useAuthStore } from "@/store/authStore";
import { employeeManagementApi } from "../services/employee-management.api";

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

export function useSupervisorTeam(params: Record<string, string | number | undefined>) {
  const userId = useAuthStore((state) => state.user?.id);
  return useQuery({
    queryKey: ["employee-management", "my-team", userId, params],
    queryFn: async () => (await employeeManagementApi.getMyTeam(params)).team,
    enabled: Boolean(userId),
    staleTime: 0,
  });
}

export function useOrgHierarchy(params: Record<string, string | undefined>) {
  const userId = useAuthStore((state) => state.user?.id);
  return useQuery({
    queryKey: ["employee-management", "hierarchy", userId, params],
    queryFn: async () => (await employeeManagementApi.getHierarchy(params)).hierarchy,
    enabled: Boolean(userId),
    staleTime: 0,
  });
}

export function useManagedProfile(employeeId: string | undefined) {
  return useQuery({
    queryKey: ["employee-management", "profile", employeeId],
    queryFn: async () =>
      (await employeeManagementApi.getProfile(employeeId as string)).profile,
    enabled: Boolean(employeeId),
    staleTime: 0,
  });
}

export function useEligibleSupervisors(employeeId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["employee-management", "eligible-supervisors", employeeId],
    queryFn: async () =>
      (await employeeManagementApi.getEligibleSupervisors(employeeId as string))
        .supervisors,
    enabled: Boolean(employeeId) && enabled,
  });
}

export function useEligibleTeams(enabled: boolean, departmentId?: string) {
  return useQuery({
    queryKey: ["employee-management", "teams", departmentId],
    queryFn: async () =>
      (await employeeManagementApi.getEligibleTeams(departmentId)).teams,
    enabled,
  });
}

export function useEligibleHrStaff(enabled: boolean) {
  return useQuery({
    queryKey: ["employee-management", "hr-staff"],
    queryFn: async () => (await employeeManagementApi.getHrStaff()).hrStaff,
    enabled,
  });
}

export function useReassignEmployee() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      employeeId: string;
      supervisorId: string;
      teamId?: string;
      reason: string;
    }) =>
      employeeManagementApi.reassignEmployee(input.employeeId, {
        supervisorId: input.supervisorId,
        teamId: input.teamId,
        reason: input.reason,
      }),
    onSuccess: async () => {
      toast.success("Employee assignment updated.");
      await client.invalidateQueries({ queryKey: ["employee-management"] });
      await client.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) => {
      toast.error(errorMessage(error, "Unable to update assignment."));
    },
  });
}

export function useReassignTeamHr() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { teamId: string; hrEmployeeId: string; reason: string }) =>
      employeeManagementApi.reassignTeamHr(input.teamId, {
        hrEmployeeId: input.hrEmployeeId,
        reason: input.reason,
      }),
    onSuccess: async () => {
      toast.success("Team HR assignment updated.");
      await client.invalidateQueries({ queryKey: ["employee-management"] });
      await client.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) => {
      toast.error(errorMessage(error, "Unable to reassign this team."));
    },
  });
}
