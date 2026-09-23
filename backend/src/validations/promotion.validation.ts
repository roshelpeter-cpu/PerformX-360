import { z } from "zod";

export const promotionReasonSchema = z.object({
  reason: z.string().trim().min(8, "A reason is required"),
});

export const promotionRecommendSchema = z.object({
  employeeId: z.string().trim().min(1),
  reason: z.string().trim().min(8, "A reason for the recommendation is required"),
});

export const promotionIdParamSchema = z.object({
  id: z.string().trim().min(1),
});
