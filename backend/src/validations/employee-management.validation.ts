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

export type TeamQuery = z.infer<typeof teamQuerySchema>;
export type HierarchyQuery = z.infer<typeof hierarchyQuerySchema>;
export type ReassignEmployeeInput = z.infer<typeof reassignEmployeeSchema>;
