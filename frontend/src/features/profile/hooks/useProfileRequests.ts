import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiClientError } from "@/services/api/client";
import { useAuthStore } from "@/store/authStore";
import { profileRequestsApi } from "../services/profile-requests.api";

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

export function useProfileRequestInbox() {
  const userId = useAuthStore((state) => state.user?.id);
  return useQuery({
    queryKey: ["profile-requests", userId],
    queryFn: async () => (await profileRequestsApi.list()).requests,
    enabled: Boolean(userId),
    staleTime: 0,
  });
}

export function useSubmitProfileChangeRequest() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (form: FormData) => profileRequestsApi.submit(form),
    onSuccess: () => {
      toast.success("Your request was sent to the responsible HR contact.");
      void client.invalidateQueries({ queryKey: ["profile-requests"] });
      void client.invalidateQueries({ queryKey: ["auth", "notifications"] });
    },
    onError: (error) => {
      toast.error(errorMessage(error, "Unable to submit the request."));
    },
  });
}

export function useReviewProfileChangeRequest() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { requestId: string; decision: "APPROVED" | "REJECTED" }) =>
      profileRequestsApi.review(input.requestId, input.decision),
    onSuccess: (_data, input) => {
      toast.success(
        input.decision === "APPROVED" ? "Request approved." : "Request rejected."
      );
      void client.invalidateQueries({ queryKey: ["profile-requests"] });
      void client.invalidateQueries({ queryKey: ["dashboard"] });
      void client.invalidateQueries({ queryKey: ["employee-management"] });
      void client.invalidateQueries({ queryKey: ["auth", "notifications"] });
    },
    onError: (error) => {
      toast.error(errorMessage(error, "Unable to update this request."));
    },
  });
}
