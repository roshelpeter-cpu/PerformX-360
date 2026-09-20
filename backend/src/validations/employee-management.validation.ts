import { z } from "zod";

export const employeeIdParamSchema = z.object({
  employeeId: z.string().trim().min(1),
});

export const teamQuerySchema = z.object({
  search: z.string().trim().optional(),
  batchId: z.string().trim().optional(),
  departmentId: z.string().trim().optional(),
  status: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional(),
});

export const hierarchyQuerySchema = z.object({
  search: z.string().trim().optional(),
  departmentId: z.string().trim().optional(),
  teamId: z.string().trim().optional(),
  status: z.string().trim().optional(),
});

export const reassignEmployeeSchema = z.object({
  supervisorId: z.string().trim().min(1, "Supervisor is required"),
  teamId: z.string().trim().optional(),
  reason: z.string().trim().min(1, "Reason is required"),
});

export const reassignTeamHrSchema = z.object({
  hrEmployeeId: z.string().trim().min(1, "HR is required"),
  reason: z.string().trim().min(1, "Reason is required"),
});

export const teamIdParamSchema = z.object({
  teamId: z.string().trim().min(1),
});

export const profileChangeRequestSchema = z.object({
  requestType: z.enum([
    "PERSONAL_INFORMATION",
    "CONTACT_INFORMATION",
    "EMERGENCY_CONTACT",
    "EMPLOYMENT_INFORMATION",
    "OTHER",
  ]),
  summary: z.string().trim().min(1, "Describe what needs to be changed."),
  currentValue: z.string().trim().min(1, "Current information is required."),
  requestedValue: z.string().trim().min(1, "Requested information is required."),
  reason: z.string().trim().min(1, "Reason is required."),
});

export const requestIdParamSchema = z.object({
  requestId: z.string().trim().min(1),
});

export const reviewRequestSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
});

export type TeamQuery = z.infer<typeof teamQuerySchema>;
export type HierarchyQuery = z.infer<typeof hierarchyQuerySchema>;
export type ReassignEmployeeInput = z.infer<typeof reassignEmployeeSchema>;
export type ReassignTeamHrInput = z.infer<typeof reassignTeamHrSchema>;
export type ProfileChangeRequestInput = z.infer<typeof profileChangeRequestSchema>;
