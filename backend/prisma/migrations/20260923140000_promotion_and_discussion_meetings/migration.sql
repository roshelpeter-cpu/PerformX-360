DO $$ BEGIN
  ALTER TYPE "MeetingType" ADD VALUE 'PIP_DISCUSSION';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "NotificationType" ADD VALUE 'PEER_REVIEW_SUBMITTED';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "NotificationType" ADD VALUE 'PROMOTION_RECOMMENDED';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "NotificationType" ADD VALUE 'PROMOTION_DECIDED';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "PromotionRecommendationStatus" AS ENUM ('PENDING', 'SHORTLISTED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "PromotionRecommendation" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "supervisorId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "pdpScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "PromotionRecommendationStatus" NOT NULL DEFAULT 'PENDING',
    "hrReason" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromotionRecommendation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PromotionRecommendation_cycleId_employeeId_key" ON "PromotionRecommendation"("cycleId", "employeeId");
CREATE INDEX IF NOT EXISTS "PromotionRecommendation_status_idx" ON "PromotionRecommendation"("status");
CREATE INDEX IF NOT EXISTS "PromotionRecommendation_supervisorId_idx" ON "PromotionRecommendation"("supervisorId");

DO $$ BEGIN
  ALTER TABLE "PromotionRecommendation" ADD CONSTRAINT "PromotionRecommendation_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "AppraisalCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "PromotionRecommendation" ADD CONSTRAINT "PromotionRecommendation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "PromotionRecommendation" ADD CONSTRAINT "PromotionRecommendation_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "PromotionRecommendation" ADD CONSTRAINT "PromotionRecommendation_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
