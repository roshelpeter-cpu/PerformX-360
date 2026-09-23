-- Self review opens after the employee's PDP period. Null falls back to the cycle end date.
ALTER TABLE "PersonalDevelopmentPlan" ADD COLUMN IF NOT EXISTS "selfReviewOpensAt" TIMESTAMP(3);

DO $$ BEGIN
  CREATE TYPE "SelfReviewStatus" AS ENUM ('DRAFT', 'SUBMITTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "NotificationType" ADD VALUE 'SELF_REVIEW_SUBMITTED';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "SelfReview" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "cycleId" TEXT NOT NULL,
  "status" "SelfReviewStatus" NOT NULL DEFAULT 'DRAFT',
  "totalScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "percentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "submittedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SelfReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SelfReviewResponse" (
  "id" TEXT NOT NULL,
  "selfReviewId" TEXT NOT NULL,
  "questionKey" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  "evidenceRequired" BOOLEAN NOT NULL DEFAULT false,
  "rating" INTEGER,
  "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "reason" TEXT NOT NULL DEFAULT '',
  "evidenceFiles" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SelfReviewResponse_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SelfReview_employeeId_cycleId_key" ON "SelfReview"("employeeId", "cycleId");
CREATE INDEX IF NOT EXISTS "SelfReview_cycleId_status_idx" ON "SelfReview"("cycleId", "status");
CREATE INDEX IF NOT EXISTS "SelfReview_employeeId_idx" ON "SelfReview"("employeeId");
CREATE UNIQUE INDEX IF NOT EXISTS "SelfReviewResponse_selfReviewId_questionKey_key" ON "SelfReviewResponse"("selfReviewId", "questionKey");
CREATE INDEX IF NOT EXISTS "SelfReviewResponse_selfReviewId_sortOrder_idx" ON "SelfReviewResponse"("selfReviewId", "sortOrder");

DO $$ BEGIN
  ALTER TABLE "SelfReview" ADD CONSTRAINT "SelfReview_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "SelfReview" ADD CONSTRAINT "SelfReview_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "AppraisalCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "SelfReviewResponse" ADD CONSTRAINT "SelfReviewResponse_selfReviewId_fkey" FOREIGN KEY ("selfReviewId") REFERENCES "SelfReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
