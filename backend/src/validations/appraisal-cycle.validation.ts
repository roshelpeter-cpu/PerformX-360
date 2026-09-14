import { z } from "zod";

// ============================================================
// APPRAISAL CYCLE REQUEST VALIDATION
// Backend validation is authoritative. The UI may hide invalid options,
// but every mutation is re-checked here before Prisma writes.
// ============================================================

const dateString = z
  .string()
  .trim()
  .min(1, "Date is required")
  .refine((value) => !Number.isNaN(Date.parse(value)), "Invalid date");

const optionalDateString = z
  .string()
  .trim()
  .optional()
  .nullable()
  .refine(
    (value) => !value || !Number.isNaN(Date.parse(value)),
    "Invalid date"
  );

const stageInputSchema = z.object({
  key: z.string().trim().optional(),
  title: z.string().trim().max(120).optional(),
  startDate: dateString,
  endDate: dateString,
});

export const createCycleSchema = z.object({
  // Name is system-generated; clients may omit or send a preview value.
  name: z.string().trim().max(200).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  startDate: dateString,
  confirm: z
    .union([z.boolean(), z.literal("true"), z.literal("false")])
    .optional()
    .transform((value) => value === true || value === "true"),
  stages: z.array(stageInputSchema).length(6).optional(),
  batches: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120).optional(),
        description: z.string().trim().max(2000).optional().nullable(),
        startDate: dateString,
      })
    )
    .length(3)
    .optional(),
});

export const updateCycleSchema = z.object({
  name: z.string().trim().min(1, "Cycle name is required").max(200).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  startDate: dateString.optional(),
  stages: z.array(stageInputSchema).length(6).optional(),
  batches: z
    .array(
      z.object({
        id: z.string().trim().min(1).optional(),
        name: z.string().trim().min(1).max(120).optional(),
        description: z.string().trim().max(2000).optional().nullable(),
        startDate: dateString,
      })
    )
    .length(3)
    .optional(),
});

export const reassignHrSchema = z.object({
  newHrEmployeeId: z.string().trim().min(1, "HR staff is required"),
  reason: z
    .string()
    .trim()
    .min(1, "Reason is required")
    .max(2000, "Reason is too long"),
});

export const hrEmployeeParamsSchema = z.object({
  id: z.string().trim().min(1, "Cycle ID is required"),
  hrEmployeeId: z.string().trim().min(1, "HR employee ID is required"),
});

export const cycleTeamParamsSchema = z.object({
  id: z.string().trim().min(1, "Cycle ID is required"),
  teamId: z.string().trim().min(1, "Team ID is required"),
});

export const cycleIdParamsSchema = z.object({
  id: z.string().trim().min(1, "Cycle ID is required"),
});

export const cycleBatchParamsSchema = z.object({
  id: z.string().trim().min(1, "Cycle ID is required"),
  batchId: z.string().trim().min(1, "Batch ID is required"),
});

export const cycleEmployeeParamsSchema = z.object({
  id: z.string().trim().min(1, "Cycle ID is required"),
  employeeId: z.string().trim().min(1, "Employee ID is required"),
});

export const cycleSupervisorParamsSchema = z.object({
  id: z.string().trim().min(1, "Cycle ID is required"),
  supervisorId: z.string().trim().min(1, "Supervisor ID is required"),
});

export const evidenceFilenameParamsSchema = z.object({
  filename: z
    .string()
    .trim()
    .min(1, "Filename is required")
    .regex(/^[\w.\-]+$/, "Invalid evidence filename"),
});

export const updateBatchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  startDate: dateString,
});

export const changeBatchSchema = z.object({
  newBatchId: z.string().trim().min(1, "New batch is required"),
  reason: z.string().trim().max(2000).optional().nullable(),
  confirmStarted: z
    .union([z.boolean(), z.literal("true"), z.literal("false")])
    .optional()
    .transform((value) => value === true || value === "true"),
  effectiveDate: optionalDateString,
  acknowledgeStarted: z
    .union([z.boolean(), z.literal("true"), z.literal("false")])
    .optional()
    .transform((value) => value === true || value === "true"),
});

export const changeSupervisorSchema = z.object({
  newSupervisorId: z.string().trim().min(1, "New supervisor is required"),
  reason: z.string().trim().max(2000).optional().nullable(),
  effectiveDate: optionalDateString,
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export const employeeAssignmentQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().optional(),
  departmentId: z.string().trim().optional(),
  batchId: z.string().trim().optional(),
  supervisorId: z.string().trim().optional(),
  assignmentStatus: z
    .enum([
      "ALL",
      "COMPLETE",
      "PARTIAL",
      "UNASSIGNED",
      "NO_BATCH",
      "NO_SUPERVISOR",
      "NEEDS_ASSIGNMENT",
    ])
    .optional(),
});

export const supervisorQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().optional(),
  departmentId: z.string().trim().optional(),
  grouped: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((value) => value === true || value === "true"),
  assignedOnly: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((value) => value === true || value === "true"),
});

export const assignmentHistoryQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().optional(),
  employeeId: z.string().trim().optional(),
  departmentId: z.string().trim().optional(),
  changeType: z.enum(["BATCH", "SUPERVISOR", "ALL"]).optional(),
  previousBatchId: z.string().trim().optional(),
  newBatchId: z.string().trim().optional(),
  previousSupervisorId: z.string().trim().optional(),
  newSupervisorId: z.string().trim().optional(),
  changedById: z.string().trim().optional(),
  from: optionalDateString,
  to: optionalDateString,
});

export const cycleListQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: z
    .enum(["DRAFT", "UPCOMING", "ACTIVE", "COMPLETED", "ARCHIVED", "ALL"])
    .optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

export type CreateCycleInput = z.infer<typeof createCycleSchema>;
export type UpdateCycleInput = z.infer<typeof updateCycleSchema>;
export type UpdateBatchInput = z.infer<typeof updateBatchSchema>;
export type ChangeBatchInput = z.infer<typeof changeBatchSchema>;
export type ChangeSupervisorInput = z.infer<typeof changeSupervisorSchema>;
export type EmployeeAssignmentQuery = z.infer<typeof employeeAssignmentQuerySchema>;
export type SupervisorQuery = z.infer<typeof supervisorQuerySchema>;
export type AssignmentHistoryQuery = z.infer<typeof assignmentHistoryQuerySchema>;
export type CycleListQuery = z.infer<typeof cycleListQuerySchema>;
export type ReassignHrInput = z.infer<typeof reassignHrSchema>;
