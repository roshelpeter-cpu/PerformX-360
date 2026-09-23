import { z } from "zod";

export const saveSelfReviewSchema = z.object({
  responses: z
    .array(
      z.object({
        questionKey: z.string().trim().min(1),
        rating: z.number().int().min(1).max(5).nullable().optional(),
        reason: z.string().trim().max(4000).optional(),
      })
    )
    .min(1),
});

export const selfReviewEmployeeParamSchema = z.object({
  employeeId: z.string().trim().min(1),
});

export const selfReviewEvidenceParamSchema = z.object({
  questionKey: z.string().trim().min(1),
  storedName: z.string().trim().min(1),
});

export const selfReviewQuestionParamSchema = z.object({
  questionKey: z.string().trim().min(1),
});

export type SaveSelfReviewInput = z.infer<typeof saveSelfReviewSchema>;
