import { z } from "zod";

export const followUpEmployeeParamSchema = z.object({
  employeeId: z.string().trim().min(1),
});

export const followUpMeetingParamSchema = z.object({
  meetingId: z.string().trim().min(1),
});

export const additionalFollowUpSchema = z.object({
  employeeId: z.string().trim().min(1),
  scheduledAt: z.string().trim().min(1),
  purpose: z.string().trim().min(1, "Purpose is required"),
  location: z.string().trim().optional(),
});

export const rescheduleFollowUpSchema = z.object({
  reason: z.string().trim().min(1, "A reason is required to request a reschedule"),
  requestedStart: z.string().trim().optional(),
});

export const supervisorRescheduleSchema = z.object({
  scheduledAt: z.string().trim().min(1),
  reviewNote: z.string().trim().optional(),
});

export type AdditionalFollowUpInput = z.infer<typeof additionalFollowUpSchema>;
export type RescheduleFollowUpInput = z.infer<typeof rescheduleFollowUpSchema>;
export type SupervisorRescheduleInput = z.infer<typeof supervisorRescheduleSchema>;
