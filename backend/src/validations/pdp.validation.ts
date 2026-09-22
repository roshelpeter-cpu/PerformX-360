import { z } from "zod";

export const pdpListQuerySchema = z.object({
  search: z.string().trim().optional(),
  departmentId: z.string().trim().optional(),
  supervisorId: z.string().trim().optional(),
  hrEmployeeId: z.string().trim().optional(),
  cycleId: z.string().trim().optional(),
  status: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional(),
});

export const pdpGoalInputSchema = z.object({
  title: z.string().trim().min(1, "Goal title is required"),
  objective: z.string().trim().min(1, "Goal objective is required"),
  expectedOutcome: z.string().trim().optional().nullable(),
  dueDate: z.string().trim().optional().nullable(),
  successCriteria: z.string().trim().optional().nullable(),
  category: z.string().trim().optional().nullable(),
  developmentArea: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  measurementKpi: z.string().trim().optional().nullable(),
  weightage: z.coerce.number().min(0).max(100).optional(),
});

export const createPdpSchema = z.object({
  employeeId: z.string().trim().min(1, "Employee is required"),
  cycleId: z.string().trim().optional(),
  title: z.string().trim().min(1).optional(),
  summary: z.string().trim().optional().nullable(),
  goals: z.array(pdpGoalInputSchema).min(1, "At least one goal is required"),
  planningMeetingId: z.string().trim().optional().nullable(),
});

export const updatePdpSchema = z.object({
  title: z.string().trim().min(1).optional(),
  summary: z.string().trim().optional().nullable(),
  goals: z.array(pdpGoalInputSchema).min(1).optional(),
  revisionReason: z.string().trim().optional().nullable(),
  changeRequestId: z.string().trim().optional(),
});

export const requestChangesSchema = z.object({
  reason: z.string().trim().min(1, "Reason is required"),
});

export const supervisorCannotChangeSchema = z.object({
  changeRequestId: z.string().trim().min(1, "Change request is required"),
  reason: z.string().trim().min(1, "Reason is required"),
});

export const hrDecisionSchema = z.object({
  changeRequestId: z.string().trim().min(1, "Change request is required"),
  decision: z.enum(["CHANGE_MUST_HAPPEN", "CHANGE_NOT_REQUIRED"]),
  note: z.string().trim().optional().nullable(),
});

export const pdpIdParamSchema = z.object({
  pdpId: z.string().trim().min(1),
});

export const pdpVersionParamSchema = z.object({
  pdpId: z.string().trim().min(1),
  versionNumber: z.coerce.number().int().min(1),
});

export type PdpListQuery = z.infer<typeof pdpListQuerySchema>;
export type PdpGoalInput = z.infer<typeof pdpGoalInputSchema>;
export type CreatePdpInput = z.infer<typeof createPdpSchema>;
export type UpdatePdpInput = z.infer<typeof updatePdpSchema>;
export type RequestChangesInput = z.infer<typeof requestChangesSchema>;
export type SupervisorCannotChangeInput = z.infer<typeof supervisorCannotChangeSchema>;
export type HrDecisionInput = z.infer<typeof hrDecisionSchema>;
