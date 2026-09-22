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
      toast.success("PDP assigned and is now active.");
    },
    onError: (error) => toast.error(errorMessage(error, "Unable to assign PDP.")),
  });
}
