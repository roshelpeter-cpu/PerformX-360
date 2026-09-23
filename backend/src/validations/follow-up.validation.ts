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
  endAt: z.string().trim().optional(),
  title: z.string().trim().min(1).optional(),
  purpose: z.string().trim().min(1, "Notes are required"),
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
