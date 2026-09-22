import { z } from "zod";

export const pdpListQuerySchema = z.object({
  search: z.string().trim().optional(),
  departmentId: z.string().trim().optional(),
  supervisorId: z.string().trim().optional(),
  hrEmployeeId: z.string().trim().optional(),
  cycleId: z.string().trim().optional(),
  status: z.string().trim().optional(),
  category: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional(),
});

export const pdpSubGoalInputSchema = z.object({
  id: z.string().trim().optional(),
  title: z.string().trim().default(""),
  description: z.string().trim().default(""),
  dueDate: z.string().trim().optional().nullable(),
  expectedOutcome: z.string().trim().optional().nullable(),
  successCriteria: z.string().trim().optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  status: z
    .enum(["NOT_STARTED", "IN_PROGRESS", "PENDING_APPROVAL", "COMPLETED", "CHANGES_REQUESTED"])
    .optional(),
  evidenceCount: z.coerce.number().int().min(0).optional(),
  comment: z.string().trim().optional().nullable(),
});

export const updateSubGoalSchema = z.object({
  status: z
    .enum(["NOT_STARTED", "IN_PROGRESS", "PENDING_APPROVAL", "COMPLETED", "CHANGES_REQUESTED"])
    .optional(),
  comment: z.string().trim().optional().nullable(),
  markComplete: z
    .union([z.boolean(), z.literal("true"), z.literal("false")])
    .optional()
    .transform((value) => value === true || value === "true"),
});

export const approveSubGoalSchema = z.object({
  comment: z.string().trim().optional().nullable(),
});

export const addActiveGoalSchema = z.object({
  title: z.string().trim().min(1, "Goal title is required"),
  objective: z.string().trim().optional(),
  category: z.string().trim().optional(),
  subGoals: z
    .array(
      z.object({
        title: z.string().trim().min(1),
        description: z.string().trim().optional(),
        dueDate: z.string().trim().optional().nullable(),
      })
    )
    .optional(),
});

export const addActiveSubGoalSchema = z.object({
  title: z.string().trim().min(1, "Sub-goal title is required"),
  description: z.string().trim().optional(),
  dueDate: z.string().trim().optional().nullable(),
});

export const pdpEmployeeIdParamSchema = z.object({
  employeeId: z.string().trim().min(1),
});

export const pdpSubGoalParamSchema = z.object({
  pdpId: z.string().trim().min(1),
  subGoalId: z.string().trim().min(1),
});

export const pdpGoalParamSchema = z.object({
  pdpId: z.string().trim().min(1),
  goalId: z.string().trim().min(1),
});

export const pdpEvidenceParamSchema = z.object({
  pdpId: z.string().trim().min(1),
  subGoalId: z.string().trim().min(1),
  storedName: z
    .string()
    .trim()
    .min(1)
    .regex(/^[\w.\-]+$/, "Invalid evidence filename"),
});

export const pdpGoalInputSchema = z.object({
  id: z.string().trim().optional(),
  title: z.string().trim().default(""),
  objective: z.string().trim().default(""),
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
  subGoals: z.array(pdpSubGoalInputSchema).optional(),
});

export const createPdpSchema = z.object({
  employeeId: z.string().trim().min(1, "Employee is required"),
  cycleId: z.string().trim().optional(),
  title: z.string().trim().min(1).optional(),
  summary: z.string().trim().optional().nullable(),
  goals: z.array(pdpGoalInputSchema).optional().default([]),
  planningMeetingId: z.string().trim().optional().nullable(),
});

export const updatePdpSchema = z.object({
  title: z.string().trim().min(1).optional(),
  summary: z.string().trim().optional().nullable(),
  goals: z.array(pdpGoalInputSchema).optional(),
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
export type PdpSubGoalInput = z.infer<typeof pdpSubGoalInputSchema>;
export type PdpGoalInput = z.infer<typeof pdpGoalInputSchema>;
export type CreatePdpInput = z.infer<typeof createPdpSchema>;
export type UpdatePdpInput = z.infer<typeof updatePdpSchema>;
export type RequestChangesInput = z.infer<typeof requestChangesSchema>;
export type SupervisorCannotChangeInput = z.infer<typeof supervisorCannotChangeSchema>;
export type HrDecisionInput = z.infer<typeof hrDecisionSchema>;
export type UpdateSubGoalInput = z.infer<typeof updateSubGoalSchema>;
export type ApproveSubGoalInput = z.infer<typeof approveSubGoalSchema>;
export type AddActiveGoalInput = z.infer<typeof addActiveGoalSchema>;
export type AddActiveSubGoalInput = z.infer<typeof addActiveSubGoalSchema>;
