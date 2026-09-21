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

export const supervisorIdParamSchema = z.object({
  supervisorId: z.string().trim().min(1),
});

export const createAccountSchema = z.object({
  name: z.string().trim().min(1, "Full name is required"),
  companyEmail: z.string().trim().email("A valid work email is required"),
  role: z.enum(["EMPLOYEE", "SUPERVISOR", "HR", "HR_MANAGER", "LEADERSHIP"]),
  jobTitle: z.string().trim().optional(),
  departmentId: z.string().trim().optional(),
  teamId: z.string().trim().optional(),
  teamIds: z.array(z.string().trim().min(1)).optional(),
  employmentType: z.string().trim().optional(),
  workLocation: z.string().trim().optional(),
  dateOfBirth: z.string().trim().optional(),
  gender: z.string().trim().optional(),
  nationality: z.string().trim().optional(),
  contactNumber: z.string().trim().optional(),
  dateJoined: z.string().trim().optional(),
  emergencyContactName: z.string().trim().optional(),
  emergencyContactRelationship: z.string().trim().optional(),
  emergencyContactNumber: z.string().trim().optional(),
});

export const nextEmployeeIdQuerySchema = z.object({
  role: z.enum(["EMPLOYEE", "SUPERVISOR", "HR", "HR_MANAGER", "LEADERSHIP"]),
});

export const profileChangeRequestSchema = z.object({
  requestType: z.enum([
    "PERSONAL_INFORMATION",
    "CONTACT_INFORMATION",
    "EMERGENCY_CONTACT",
    "EMPLOYMENT_INFORMATION",
    "OTHER",
    "CONTACT_NUMBER",
    "ADDRESS",
    "EMAIL",
    "NAME",
  ]),
  summary: z.string().trim().optional(),
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
export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type NextEmployeeIdQuery = z.infer<typeof nextEmployeeIdQuerySchema>;
export type ProfileChangeRequestInput = z.infer<typeof profileChangeRequestSchema>;
