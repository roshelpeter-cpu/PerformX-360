ALTER TABLE "FinalEvaluation" ADD COLUMN IF NOT EXISTS "hrComment" TEXT NOT NULL DEFAULT '';

ALTER TABLE "PromotionRecommendation" ADD COLUMN IF NOT EXISTS "recommendedPosition" TEXT;
