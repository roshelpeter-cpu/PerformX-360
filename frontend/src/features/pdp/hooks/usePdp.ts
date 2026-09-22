import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiClientError } from "@/services/api/client";
import { useAuthStore } from "@/store/authStore";
import { pdpApi, type GoalInput } from "../services/pdp.api";

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

function invalidatePdps(client: ReturnType<typeof useQueryClient>) {
  void client.invalidateQueries({ queryKey: ["pdps"] });
  void client.invalidateQueries({ queryKey: ["auth", "notifications"] });
}

export function usePdpBoard(params: Record<string, string | number | undefined>, enabled = true) {
  const userId = useAuthStore((state) => state.user?.id);
  return useQuery({
    queryKey: ["pdps", "board", userId, params],
    queryFn: async () => (await pdpApi.getBoard(params)).board,
    enabled: enabled && Boolean(userId),
    staleTime: 0,
  });
}

export function useMyPdp(enabled = true) {
  const userId = useAuthStore((state) => state.user?.id);
  return useQuery({
    queryKey: ["pdps", "mine", userId],
    queryFn: async () => (await pdpApi.getMine()).pdp,
    enabled: enabled && Boolean(userId),
    staleTime: 0,
  });
}

export function usePdpOptions(enabled = true) {
  const userId = useAuthStore((state) => state.user?.id);
  return useQuery({
    queryKey: ["pdps", "options", userId],
    queryFn: async () => (await pdpApi.getOptions()).options,
    enabled: enabled && Boolean(userId),
  });
}

export function usePdp(pdpId: string | null) {
  return useQuery({
    queryKey: ["pdps", "detail", pdpId],
    queryFn: async () => (await pdpApi.getPdp(pdpId as string)).pdp,
    enabled: Boolean(pdpId),
    staleTime: 0,
  });
}

export function useCreatePdp() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      employeeId: string;
      title?: string;
      summary?: string;
      goals?: GoalInput[];
    }) => (await pdpApi.create(body)).pdp,
    onSuccess: () => {
      invalidatePdps(client);
      toast.success("PDP created as draft.");
    },
    onError: (error) => toast.error(errorMessage(error, "Unable to create PDP.")),
  });
}

export function useUpdatePdp() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      pdpId: string;
      body: { title?: string; summary?: string; goals?: GoalInput[]; revisionReason?: string };
    }) => (await pdpApi.update(args.pdpId, args.body)).pdp,
    onSuccess: () => {
      invalidatePdps(client);
      toast.success("PDP saved.");
    },
    onError: (error) => toast.error(errorMessage(error, "Unable to save PDP.")),
  });
}

export function useSendPdpForApproval() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (pdpId: string) => (await pdpApi.sendForApproval(pdpId)).pdp,
    onSuccess: () => {
      invalidatePdps(client);
      toast.success("PDP sent for approval.");
    },
    onError: (error) => toast.error(errorMessage(error, "Unable to send PDP for approval.")),
  });
}

export function useEmployeeApprovePdp() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (pdpId: string) => (await pdpApi.employeeApprove(pdpId)).pdp,
    onSuccess: () => {
      invalidatePdps(client);
      toast.success("PDP approved.");
    },
    onError: (error) => toast.error(errorMessage(error, "Unable to approve PDP.")),
  });
}

export function useEmployeeRequestPdpChanges() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (args: { pdpId: string; reason: string }) =>
      (await pdpApi.employeeRequestChanges(args.pdpId, args.reason)).pdp,
    onSuccess: () => {
      invalidatePdps(client);
      toast.success("Change request submitted.");
    },
    onError: (error) => toast.error(errorMessage(error, "Unable to request changes.")),
  });
}

export function useHrApprovePdp() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (pdpId: string) => (await pdpApi.hrApprove(pdpId)).pdp,
    onSuccess: () => {
      invalidatePdps(client);
      toast.success("PDP approved.");
    },
    onError: (error) => toast.error(errorMessage(error, "Unable to approve PDP.")),
  });
}

export function useHrRequestPdpChanges() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (args: { pdpId: string; reason: string }) =>
      (await pdpApi.hrRequestChanges(args.pdpId, args.reason)).pdp,
    onSuccess: () => {
      invalidatePdps(client);
      toast.success("Change request submitted.");
    },
    onError: (error) => toast.error(errorMessage(error, "Unable to request changes.")),
  });
}

export function useSupervisorCannotChange() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (args: { pdpId: string; changeRequestId: string; reason: string }) =>
      (await pdpApi.supervisorCannotChange(args.pdpId, args.changeRequestId, args.reason)).pdp,
    onSuccess: () => {
      invalidatePdps(client);
      toast.success("Escalated to HR for decision.");
    },
    onError: (error) => toast.error(errorMessage(error, "Unable to escalate.")),
  });
}

export function useHrPdpDecision() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      pdpId: string;
      changeRequestId: string;
      decision: "CHANGE_MUST_HAPPEN" | "CHANGE_NOT_REQUIRED";
      note?: string;
    }) => (await pdpApi.hrDecision(args.pdpId, args)).pdp,
    onSuccess: () => {
      invalidatePdps(client);
      toast.success("HR decision recorded.");
    },
    onError: (error) => toast.error(errorMessage(error, "Unable to record decision.")),
  });
}

export function useAssignPdp() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (pdpId: string) => (await pdpApi.assign(pdpId)).pdp,
    onSuccess: () => {
      invalidatePdps(client);
      toast.success("PDP assigned to the employee.");
    },
    onError: (error) => toast.error(errorMessage(error, "Unable to assign PDP.")),
  });
}

export function useActivatePdp() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (pdpId: string) => (await pdpApi.activate(pdpId)).pdp,
    onSuccess: () => {
      invalidatePdps(client);
      toast.success("PDP activated successfully.");
    },
    onError: (error) => toast.error(errorMessage(error, "Unable to activate PDP.")),
  });
}

export function useEmployeePdp(employeeId: string | null) {
  return useQuery({
    queryKey: ["pdps", "by-employee", employeeId],
    queryFn: async () => (await pdpApi.getByEmployee(employeeId as string)).pdp,
    enabled: Boolean(employeeId),
    staleTime: 0,
  });
}

export function usePendingSubGoalApprovals(enabled = true) {
  const userId = useAuthStore((state) => state.user?.id);
  return useQuery({
    queryKey: ["pdps", "pending-approvals", userId],
    queryFn: async () => (await pdpApi.getPendingApprovals()).items,
    enabled: enabled && Boolean(userId),
    staleTime: 0,
  });
}

export function useUpdateSubGoal() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      pdpId: string;
      subGoalId: string;
      status?: string;
      comment?: string | null;
      markComplete?: boolean;
      file?: File | null;
    }) =>
      (
        await pdpApi.updateSubGoal(
          args.pdpId,
          args.subGoalId,
          {
            status: args.status,
            comment: args.comment,
            markComplete: args.markComplete,
          },
          args.file
        )
      ).pdp,
    onSuccess: () => {
      invalidatePdps(client);
      toast.success("Sub-goal updated.");
    },
    onError: (error) => toast.error(errorMessage(error, "Unable to update sub-goal.")),
  });
}

export function useApproveSubGoal() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (args: { pdpId: string; subGoalId: string; comment?: string | null }) =>
      (await pdpApi.approveSubGoal(args.pdpId, args.subGoalId, args.comment)).pdp,
    onSuccess: () => {
      invalidatePdps(client);
      toast.success("Sub-goal approved.");
    },
    onError: (error) => toast.error(errorMessage(error, "Unable to approve sub-goal.")),
  });
}

export function useRequestSubGoalChanges() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (args: { pdpId: string; subGoalId: string; reason: string }) =>
      (await pdpApi.requestSubGoalChanges(args.pdpId, args.subGoalId, args.reason)).pdp,
    onSuccess: () => {
      invalidatePdps(client);
      toast.success("Changes requested from employee.");
    },
    onError: (error) => toast.error(errorMessage(error, "Unable to request changes.")),
  });
}

export function useAddPdpGoal() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      pdpId: string;
      title: string;
      objective?: string;
      expectedOutcome?: string;
      successCriteria?: string;
      category?: string;
    }) => (await pdpApi.addGoal(args.pdpId, args)).pdp,
    onSuccess: () => {
      invalidatePdps(client);
      toast.success("New development goal added.");
    },
    onError: (error) => toast.error(errorMessage(error, "Unable to add goal.")),
  });
}

export function useAddPdpSubGoal() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      pdpId: string;
      goalId: string;
      title: string;
      description?: string;
      dueDate?: string | null;
      expectedOutcome?: string | null;
      successCriteria?: string | null;
    }) =>
      (
        await pdpApi.addSubGoal(args.pdpId, args.goalId, {
          title: args.title,
          description: args.description,
          dueDate: args.dueDate,
          expectedOutcome: args.expectedOutcome,
          successCriteria: args.successCriteria,
        })
      ).pdp,
    onSuccess: () => {
      invalidatePdps(client);
      toast.success("New sub-goal added.");
    },
    onError: (error) => toast.error(errorMessage(error, "Unable to add sub-goal.")),
  });
}
