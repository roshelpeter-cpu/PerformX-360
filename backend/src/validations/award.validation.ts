import { z } from "zod";

export const awardIdParamSchema = z.object({
  awardId: z.string().trim().min(1),
});

export type AwardIdParam = z.infer<typeof awardIdParamSchema>;
