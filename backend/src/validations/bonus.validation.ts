import { z } from "zod";

export const bonusEmployeeParamSchema = z.object({
  employeeId: z.string().trim().min(1),
});
