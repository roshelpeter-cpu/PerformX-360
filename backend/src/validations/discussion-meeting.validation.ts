import { z } from "zod";

export const scheduleDiscussionSchema = z.object({
  type: z.enum(["PDP_DISAGREEMENT", "PIP_DISCUSSION"]),
  employeeId: z.string().trim().min(1),
  participantIds: z.array(z.string().trim().min(1)).min(1),
  date: z.string().trim().min(1),
  startTime: z.string().trim().min(1),
  endTime: z.string().trim().min(1),
  location: z.string().trim().min(1),
  purpose: z.string().trim().min(8, "A meeting purpose is required"),
  title: z.string().trim().optional(),
});

export const discussionRespondSchema = z.object({
  decision: z.enum(["ACCEPT", "RESCHEDULE"]),
  reason: z.string().trim().optional(),
});

export const discussionRescheduleSchema = z.object({
  date: z.string().trim().min(1),
  startTime: z.string().trim().min(1),
  endTime: z.string().trim().min(1),
  location: z.string().trim().optional(),
  note: z.string().trim().optional(),
});

export const discussionIdParamSchema = z.object({
  meetingId: z.string().trim().min(1),
});
