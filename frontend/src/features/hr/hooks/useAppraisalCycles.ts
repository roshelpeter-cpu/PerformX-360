import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiClientError } from "@/services/api/client";
import { appraisalCycleApi } from "../services/appraisal-cycle.api";
import type { CreateCyclePayload } from "../types";

const keys = {
  all: ["appraisal-cycles"] as const,
  list: (filters?: object) => [...keys.all, "list", filters ?? {}] as const,
  current: () => [...keys.all, "current"] as const,
  history: () => [...keys.all, "history"] as const,
  workforce: () => [...keys.all, "workforce"] as const,
  activity: () => [...keys.all, "activity"] as const,
  createDefaults: () => [...keys.all, "create-defaults"] as const,
  detail: (id: string) => [...keys.all, "detail", id] as const,
  hrGroups: (id: string, search?: string) =>
    [...keys.all, "hr-groups", id, search ?? ""] as const,
  hrGroup: (cycleId: string, hrId: string) =>
    [...keys.all, "hr-group", cycleId, hrId] as const,
  employees: (id: string, filters: object) =>
    [...keys.all, "employees", id, filters] as const,
  departments: () => [...keys.all, "departments"] as const,
  readiness: (id: string) => [...keys.all, "readiness", id] as const,
};

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

export function useAppraisalCycles(filters?: {
  search?: string;
  status?: string;
  year?: number;
}) {
  return useQuery({
    queryKey: keys.list(filters),
    queryFn: async () => (await appraisalCycleApi.listCycles(filters)).cycles,
  });
}

export function useCurrentAppraisalCycle() {
  return useQuery({
    queryKey: keys.current(),
    queryFn: async () => (await appraisalCycleApi.getCurrent()).cycle,
  });
}

export function useHistoricalCycles() {
  return useQuery({
    queryKey: keys.history(),
    queryFn: async () => (await appraisalCycleApi.getHistoryCycles()).cycles,
  });
}

export function useWorkforceSummary() {
  return useQuery({
    queryKey: keys.workforce(),
    queryFn: async () => (await appraisalCycleApi.getWorkforce()).workforce,
  });
}

export function useRecentCycleActivity() {
  return useQuery({
    queryKey: keys.activity(),
    queryFn: async () =>
      (await appraisalCycleApi.getRecentActivity()).activities,
  });
}

export function useCycleCreateDefaults(enabled = true) {
  return useQuery({
    queryKey: keys.createDefaults(),
    queryFn: async () =>
      (await appraisalCycleApi.getCreateDefaults()).defaults,
    enabled,
  });
}

export function useAppraisalCycle(id: string | undefined) {
  return useQuery({
    queryKey: keys.detail(id ?? ""),
    queryFn: async () => (await appraisalCycleApi.getCycle(id!)).cycle,
    enabled: Boolean(id),
  });
}

export function useDepartments() {
  return useQuery({
    queryKey: keys.departments(),
    queryFn: async () => (await appraisalCycleApi.listDepartments()).departments,
  });
}

export function useCycleHrGroups(cycleId: string | undefined, search?: string) {
  return useQuery({
    queryKey: keys.hrGroups(cycleId ?? "", search),
    queryFn: async () =>
      (await appraisalCycleApi.listHrGroups(cycleId!, search)).groups,
    enabled: Boolean(cycleId),
  });
}

export function useHrGroupDetail(
  cycleId: string | undefined,
  hrEmployeeId: string | undefined
) {
  return useQuery({
    queryKey: keys.hrGroup(cycleId ?? "", hrEmployeeId ?? ""),
    queryFn: async () => appraisalCycleApi.getHrGroup(cycleId!, hrEmployeeId!),
    enabled: Boolean(cycleId && hrEmployeeId),
  });
}

export function useCycleEmployees(
  cycleId: string | undefined,
  filters: {
    search?: string;
    departmentId?: string;
    page?: number;
    pageSize?: number;
  }
) {
  return useQuery({
    queryKey: keys.employees(cycleId ?? "", filters),
    queryFn: async () => appraisalCycleApi.listEmployees(cycleId!, filters),
    enabled: Boolean(cycleId),
  });
}

export function useActivationReadiness(
  cycleId: string | undefined,
  enabled: boolean
) {
  return useQuery({
    queryKey: keys.readiness(cycleId ?? ""),
    queryFn: async () =>
      (await appraisalCycleApi.getActivationReadiness(cycleId!)).readiness,
    enabled: Boolean(cycleId) && enabled,
  });
}

function useInvalidateCycles() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: keys.all });
}

export function useCreateCycle() {
  const invalidate = useInvalidateCycles();
  return useMutation({
    mutationFn: (payload: CreateCyclePayload) =>
      appraisalCycleApi.createCycle(payload),
    onSuccess: (_data, variables) => {
      invalidate();
      toast.success(
        variables.confirm
          ? "Appraisal cycle submitted and moved to Upcoming."
          : "Appraisal cycle saved as Draft."
      );
    },
    onError: (error) => {
      toast.error(errorMessage(error, "Failed to create cycle"));
    },
  });
}

export function useUpdateCycle(cycleId: string) {
  const invalidate = useInvalidateCycles();
  return useMutation({
    mutationFn: (payload: Partial<CreateCyclePayload>) =>
      appraisalCycleApi.updateCycle(cycleId, payload),
    onSuccess: () => {
      invalidate();
      toast.success("Cycle updated");
    },
    onError: (error) => {
      toast.error(errorMessage(error, "Failed to update cycle"));
    },
  });
}

export function useConfirmCycle() {
  const invalidate = useInvalidateCycles();
  return useMutation({
    mutationFn: (id: string) => appraisalCycleApi.confirmCycle(id),
    onSuccess: () => {
      invalidate();
      toast.success("Appraisal cycle submitted and moved to Upcoming.");
    },
    onError: (error) => {
      toast.error(errorMessage(error, "Failed to submit cycle"));
    },
  });
}

export function useActivateCycle() {
  const invalidate = useInvalidateCycles();
  return useMutation({
    mutationFn: (id: string) => appraisalCycleApi.activateCycle(id),
    onSuccess: () => {
      invalidate();
      toast.success("Appraisal cycle is now Active.");
    },
    onError: (error) => {
      toast.error(errorMessage(error, "Failed to activate cycle"));
    },
  });
}

export function useCompleteCycle() {
  const invalidate = useInvalidateCycles();
  return useMutation({
    mutationFn: (id: string) => appraisalCycleApi.completeCycle(id),
    onSuccess: () => {
      invalidate();
      toast.success("Appraisal cycle completed.");
    },
    onError: (error) => {
      toast.error(errorMessage(error, "Failed to complete cycle"));
    },
  });
}

export function useDeleteCycle() {
  const invalidate = useInvalidateCycles();
  return useMutation({
    mutationFn: (id: string) => appraisalCycleApi.deleteCycle(id),
    onSuccess: () => {
      invalidate();
      toast.success("Draft appraisal cycle deleted.");
    },
    onError: (error) => {
      toast.error(errorMessage(error, "Failed to delete cycle"));
    },
  });
}

export function useReassignHr(cycleId: string) {
  const invalidate = useInvalidateCycles();
  return useMutation({
    mutationFn: ({
      teamId,
      newHrEmployeeId,
      reason,
      evidence,
    }: {
      teamId: string;
      newHrEmployeeId: string;
      reason: string;
      evidence: File;
    }) =>
      appraisalCycleApi.reassignHr(cycleId, teamId, {
        newHrEmployeeId,
        reason,
        evidence,
      }),
    onSuccess: () => {
      invalidate();
      toast.success("HR responsibility reassigned.");
    },
    onError: (error) => {
      toast.error(errorMessage(error, "Failed to reassign HR"));
    },
  });
}
