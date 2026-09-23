import { z } from "zod";

export const leadershipReportQuerySchema = z.object({
  departmentId: z.string().trim().optional(),
  teamId: z.string().trim().optional(),
  employeeId: z.string().trim().optional(),
  band: z.string().trim().optional(),
  cycleId: z.string().trim().optional(),
  status: z.string().trim().optional(),
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
  format: z.enum(["json", "pdf", "docx"]).optional(),
});

export type LeadershipReportQuery = z.infer<typeof leadershipReportQuerySchema>;
