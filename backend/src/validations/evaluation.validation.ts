import { z } from "zod";

export const evaluationEmployeeParamSchema = z.object({
  employeeId: z.string().trim().min(1),
});
