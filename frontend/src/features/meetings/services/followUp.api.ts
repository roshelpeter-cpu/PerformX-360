import { apiRequest } from "@/services/api/client";

export interface FollowUpMeeting {
  id: string;
  meetingNumber: number | null;
  isAdditional: boolean;
  title: string;
  purpose: string | null;
  date: string;
  time: string;
  endAt: string;
  location: string;
  status: string;
  confirmationStatus: string;
  canConfirm: boolean;
  employee: { id: string; employeeId: string; name: string };
  supervisor: { id: string; employeeId: string; name: string } | null;
  pendingReschedule: { id: string; reason: string } | null;
}

export interface FollowUpSchedule {
  cycle: { id: string; name: string };
  employee: { id: string; employeeId: string; name: string; department: string; supervisor: string };
  scheduleStatus: string;
  meetings: FollowUpMeeting[];
  additionalMeetings: FollowUpMeeting[];
  viewOnly: boolean;
}

export interface FollowUpBoardRow {
  employee: {
    id: string;
    employeeId: string;
    name: string;
    department: string;
    team: string;
    supervisor: string;
  };
  scheduleStatus: string;
  meetingSummaries: string[];
  additionalCount: number;
  hasSchedule: boolean;
}

export const followUpApi = {
  board() {
    return apiRequest<{
      success: true;
      board: { cycle: { id: string; name: string }; viewOnly: boolean; items: FollowUpBoardRow[] };
    }>("/follow-ups");
  },
  schedule(employeeId: string) {
    return apiRequest<{ success: true; schedule: FollowUpSchedule }>(`/follow-ups/employees/${employeeId}`);
  },
  generate(employeeId: string) {
    return apiRequest<{ success: true; schedule: FollowUpSchedule }>(
      `/follow-ups/employees/${employeeId}/generate`,
      { method: "POST" }
    );
  },
  additional(body: {
    employeeId: string;
    scheduledAt: string;
    endAt?: string;
    title?: string;
    purpose: string;
    location?: string;
  }) {
    return apiRequest<{ success: true; schedule: FollowUpSchedule }>("/follow-ups/additional", {
      method: "POST",
      body,
    });
  },
  confirm(meetingId: string) {
    return apiRequest<{ success: true }>(`/follow-ups/${meetingId}/confirm`, { method: "POST" });
  },
  requestReschedule(meetingId: string, reason: string) {
    return apiRequest<{ success: true }>(`/follow-ups/${meetingId}/reschedule-request`, {
      method: "POST",
      body: { reason },
    });
  },
  supervisorReschedule(meetingId: string, scheduledAt: string) {
    return apiRequest<{ success: true; schedule: FollowUpSchedule }>(`/follow-ups/${meetingId}/reschedule`, {
      method: "POST",
      body: { scheduledAt },
    });
  },
};
