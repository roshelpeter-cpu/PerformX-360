import { apiRequest } from "@/services/api/client";

export interface MeetingPerson {
  id: string;
  employeeId: string;
  name: string;
  jobTitle: string | null;
  companyEmail?: string;
  role?: string;
  department?: { id: string; name: string } | null;
}

export interface PlanningMeeting {
  id: string;
  type: string;
  title: string;
  description: string | null;
  location: string | null;
  status: string;
  scheduledAt: string;
  endAt: string;
  previousScheduledAt: string | null;
  employee: MeetingPerson;
  supervisor: MeetingPerson | null;
  cycle: { id: string; name: string; startDate?: string; status: string } | null;
  participants: Array<{
    id: string;
    role: string;
    response: string;
    responseMessage: string | null;
    respondedAt: string | null;
    employee: MeetingPerson;
  }>;
  employeeResponse: string;
  employeeReason: string | null;
  hrInvited: boolean;
  hrResponse: string;
  hrReason: string | null;
  hrParticipant: MeetingPerson | null;
  rescheduleReason: string | null;
  notes: {
    sections: StructuredNotes;
    recordedBy: MeetingPerson;
    recordedAt: string;
  } | null;
  canViewNotes: boolean;
  canRespondAsEmployee: boolean;
  canRespondAsHr: boolean;
  canReschedule: boolean;
  canEditNotes: boolean;
}

export interface PlanningBoardRow {
  employee: MeetingPerson & {
    supervisor: MeetingPerson | null;
    hr: MeetingPerson | null;
  };
  meeting: PlanningMeeting | null;
  status: string;
}

export interface PlanningBoard {
  cycle: { id: string; name: string; startDate?: string; status: string };
  kpis: {
    totalEmployees: number;
    completed: number;
    scheduled: number;
    pendingEmployeeResponse: number;
    rescheduleRequested: number;
    notScheduled: number;
  };
  items: PlanningBoardRow[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface PlanningOptions {
  cycle: { id: string; name: string; startDate?: string; status: string };
  cycles: Array<{ id: string; name: string; startDate?: string; status: string }>;
  departments: Array<{ id: string; name: string }>;
  supervisors: MeetingPerson[];
  employees: Array<
    MeetingPerson & {
      supervisor: MeetingPerson | null;
      hr: MeetingPerson | null;
    }
  >;
}

export interface NoteSection {
  context: string;
  discussion: string;
  decisions: string;
  actions: string;
}

export interface PreviousMeetingNotes {
  scheduledAt: string;
  cycleName: string | null;
  sections: StructuredNotes;
}

export interface StructuredNotes {
  previousAppraisal: NoteSection;
  previousPdp: NoteSection;
  strengthsWeaknesses: NoteSection;
  departmentObjectives: NoteSection;
  companyObjectives: NoteSection;
  developmentNeeds: NoteSection;
}

export interface PreviousPdp {
  id: string;
  status: string;
  summary: string | null;
  cycle: { id: string; name: string; startDate?: string };
  goals: Array<{
    id: string;
    title: string;
    objective: string;
    progress: number;
    status: string;
    expectedOutcome: string | null;
  }>;
}

export interface PreviousAppraisal {
  id: string;
  overallResult: string;
  ratingBand: string | null;
  overallScore: number | null;
  supervisorComments: string | null;
  developmentRecommendations: string | null;
  achievements: string | null;
  areasForImprovement: string | null;
  outcomes: string | null;
  cycle: { id: string; name: string; startDate?: string };
}

function toQuery(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const suffix = search.toString();
  return suffix ? `?${suffix}` : "";
}

export const meetingsApi = {
  getBoard(params: Record<string, string | number | undefined>) {
    return apiRequest<{ success: true; board: PlanningBoard }>(
      `/meetings/planning${toQuery(params)}`
    );
  },
  getMine() {
    return apiRequest<{
      success: true;
      meetings: { upcoming: PlanningMeeting[]; past: PlanningMeeting[] };
    }>("/meetings/planning/mine");
  },
  getOptions() {
    return apiRequest<{ success: true; options: PlanningOptions }>("/meetings/planning/options");
  },
  getMeeting(meetingId: string) {
    return apiRequest<{
      success: true;
      meeting: PlanningMeeting;
      previousAppraisal: PreviousAppraisal | null;
      previousPdp: PreviousPdp | null;
      companyObjectives: Array<{ id: string; title: string; description: string | null }>;
      departmentObjectives: Array<{ id: string; title: string; description: string | null }>;
      noteContext: Record<string, string>;
      previousMeetingNotes: PreviousMeetingNotes | null;
    }>(`/meetings/planning/${meetingId}`);
  },
  getPreviousAppraisal(employeeId: string) {
    return apiRequest<{ success: true; previousAppraisal: PreviousAppraisal | null }>(
      `/meetings/planning/employees/${employeeId}/previous-appraisal`
    );
  },
  schedule(body: Record<string, string | undefined>) {
    return apiRequest<{ success: true; meeting: PlanningMeeting }>("/meetings/planning", {
      method: "POST",
      body,
    });
  },
  reschedule(meetingId: string, body: Record<string, string | undefined>) {
    return apiRequest<{ success: true; meeting: PlanningMeeting }>(
      `/meetings/planning/${meetingId}/reschedule`,
      { method: "POST", body }
    );
  },
  respond(meetingId: string, body: { decision: "ACCEPT" | "DECLINE" | "RESCHEDULE"; reason?: string }) {
    return apiRequest<{ success: true; meeting: PlanningMeeting }>(
      `/meetings/planning/${meetingId}/respond`,
      { method: "POST", body }
    );
  },
  saveNotes(meetingId: string, body: StructuredNotes) {
    return apiRequest<{ success: true; meeting: PlanningMeeting }>(
      `/meetings/planning/${meetingId}/notes`,
      { method: "PUT", body }
    );
  },
  complete(meetingId: string) {
    return apiRequest<{ success: true; meeting: PlanningMeeting }>(
      `/meetings/planning/${meetingId}/complete`,
      { method: "POST" }
    );
  },
};
