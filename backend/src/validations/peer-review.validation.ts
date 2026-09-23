import { z } from "zod";

export const peerEmployeeParamSchema = z.object({
  employeeId: z.string().trim().min(1),
});

export const peerReviewParamSchema = z.object({
  reviewId: z.string().trim().min(1),
});

export const selectPeersSchema = z.object({
  peerIds: z.array(z.string().trim().min(1)).length(2),
});

export const savePeerReviewSchema = z.object({
  comment: z.string().trim().optional(),
  responses: z.array(
    z.object({
      questionKey: z.string().trim().min(1),
      rating: z.number().int().min(1).max(5).nullable().optional(),
      reason: z.string().optional(),
    })
  ),
});

export const supervisorDecisionSchema = z.object({
  decision: z.enum(["APPROVED", "DECLINED"]),
  comment: z.string().trim().min(8, "A meaningful review comment is required"),
});

export type SavePeerReviewInput = z.infer<typeof savePeerReviewSchema>;
export type SupervisorDecisionInput = z.infer<typeof supervisorDecisionSchema>;
