import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiClientError } from "@/services/api/client";
import { useAuthStore } from "@/store/authStore";
import { meetingsApi } from "../services/meetings.api";

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

export function usePlanningBoard(params: Record<string, string | number | undefined>, enabled = true) {
  const userId = useAuthStore((state) => state.user?.id);
  return useQuery({
    queryKey: ["meetings", "planning", "board", userId, params],
    queryFn: async () => (await meetingsApi.getBoard(params)).board,
    enabled: enabled && Boolean(userId),
    staleTime: 0,
  });
}

export function useMyPlanningMeetings(enabled = true) {
  const userId = useAuthStore((state) => state.user?.id);
  return useQuery({
    queryKey: ["meetings", "planning", "mine", userId],
    queryFn: async () => (await meetingsApi.getMine()).meetings,
    enabled: enabled && Boolean(userId),
    staleTime: 0,
  });
}

export function usePlanningOptions(enabled = true) {
  const userId = useAuthStore((state) => state.user?.id);
  return useQuery({
    queryKey: ["meetings", "planning", "options", userId],
    queryFn: async () => (await meetingsApi.getOptions()).options,
    enabled: enabled && Boolean(userId),
  });
}

export function usePlanningMeeting(meetingId: string | null) {
  return useQuery({
    queryKey: ["meetings", "planning", "detail", meetingId],
    queryFn: async () => meetingsApi.getMeeting(meetingId as string),
    enabled: Boolean(meetingId),
    staleTime: 0,
  });
}

export function usePreviousAppraisal(employeeId: string | null) {
  return useQuery({
    queryKey: ["meetings", "planning", "appraisal", employeeId],
    queryFn: async () => (await meetingsApi.getPreviousAppraisal(employeeId as string)).previousAppraisal,
    enabled: Boolean(employeeId),
  });
}

function invalidateMeetings(client: ReturnType<typeof useQueryClient>) {
  void client.invalidateQueries({ queryKey: ["meetings"] });
  void client.invalidateQueries({ queryKey: ["auth", "notifications"] });
}

export function useSchedulePlanningMeeting() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: meetingsApi.schedule,
    onSuccess: () => {
      invalidateMeetings(client);
      toast.success("Performance planning meeting scheduled.");
    },
    onError: (error) => toast.error(errorMessage(error, "Unable to schedule the meeting.")),
  });
}

export function useReschedulePlanningMeeting() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { meetingId: string; body: Record<string, string | undefined> }) =>
      meetingsApi.reschedule(input.meetingId, input.body),
    onSuccess: () => {
      invalidateMeetings(client);
      toast.success("Meeting rescheduled. New invitations were sent.");
    },
    onError: (error) => toast.error(errorMessage(error, "Unable to reschedule the meeting.")),
  });
}

export function useRespondPlanningMeeting() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      meetingId: string;
      decision: "ACCEPT" | "DECLINE" | "RESCHEDULE";
      reason?: string;
    }) => meetingsApi.respond(input.meetingId, input),
    onSuccess: () => {
      invalidateMeetings(client);
      toast.success("Your response was saved.");
    },
    onError: (error) => toast.error(errorMessage(error, "Unable to save your response.")),
  });
}

export function useSavePlanningNotes() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { meetingId: string; body: Record<string, string | undefined> }) =>
      meetingsApi.saveNotes(input.meetingId, input.body),
    onSuccess: () => {
      invalidateMeetings(client);
      toast.success("Meeting notes saved.");
    },
    onError: (error) => toast.error(errorMessage(error, "Unable to save notes.")),
  });
}

export function useCompletePlanningMeeting() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: meetingsApi.complete,
    onSuccess: () => {
      invalidateMeetings(client);
      toast.success("Meeting marked as completed.");
    },
    onError: (error) => toast.error(errorMessage(error, "Unable to complete the meeting.")),
  });
}
