import { z } from "zod";

export const startBatchStageSchema = z.object({
  stage: z.enum([
    "SELF_REVIEW",
    "PEER_REVIEW",
    "SUPERVISOR_REVIEW",
    "HR_EVALUATION",
    "RECOGNITION_PIP",
    "CLOSURE",
  ]),
});

export const planningListQuerySchema = z.object({
  search: z.string().trim().optional(),
  departmentId: z.string().trim().optional(),
  supervisorId: z.string().trim().optional(),
  hrEmployeeId: z.string().trim().optional(),
  cycleId: z.string().trim().optional(),
  status: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional(),
});

export const schedulePlanningMeetingSchema = z.object({
  employeeId: z.string().trim().min(1, "Employee is required"),
  cycleId: z.string().trim().optional(),
  date: z.string().trim().min(1, "Date is required"),
  startTime: z.string().trim().min(1, "Start time is required"),
  endTime: z.string().trim().min(1, "End time is required"),
  location: z.string().trim().min(1, "Meeting method is required"),
  hrEmployeeId: z.string().trim().optional(),
  agenda: z.string().trim().optional(),
});

export const reschedulePlanningMeetingSchema = z.object({
  date: z.string().trim().min(1, "Date is required"),
  startTime: z.string().trim().min(1, "Start time is required"),
  endTime: z.string().trim().min(1, "End time is required"),
  location: z.string().trim().optional(),
  note: z.string().trim().optional(),
});

export const respondPlanningMeetingSchema = z.object({
  decision: z.enum(["ACCEPT", "DECLINE", "RESCHEDULE"]),
  reason: z.string().trim().optional(),
});

export const noteSectionSchema = z.object({
  context: z.string().optional(),
  discussion: z.string().optional(),
  decisions: z.string().optional(),
  actions: z.string().optional(),
});

export const planningNotesSchema = z.object({
  previousAppraisal: noteSectionSchema.optional(),
  previousPdp: noteSectionSchema.optional(),
  strengthsWeaknesses: noteSectionSchema.optional(),
  departmentObjectives: noteSectionSchema.optional(),
  companyObjectives: noteSectionSchema.optional(),
  developmentNeeds: noteSectionSchema.optional(),
  decisionsActions: noteSectionSchema.optional(),
});

export const meetingIdParamSchema = z.object({
  meetingId: z.string().trim().min(1),
});

export const meetingEmployeeParamSchema = z.object({
  employeeId: z.string().trim().min(1),
});

export type StartBatchStageInput = z.infer<typeof startBatchStageSchema>;
export type PlanningListQuery = z.infer<typeof planningListQuerySchema>;
export type SchedulePlanningMeetingInput = z.infer<typeof schedulePlanningMeetingSchema>;
export type ReschedulePlanningMeetingInput = z.infer<typeof reschedulePlanningMeetingSchema>;
export type RespondPlanningMeetingInput = z.infer<typeof respondPlanningMeetingSchema>;
export type PlanningNotesInput = z.infer<typeof planningNotesSchema>;
