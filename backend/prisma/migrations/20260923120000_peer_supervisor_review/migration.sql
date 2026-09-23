DO $$ BEGIN
  CREATE TYPE "PeerSelectionStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'SELECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PeerReviewSubmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "SupervisorReviewDecision" AS ENUM ('PENDING', 'APPROVED', 'DECLINED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "FinalEvaluationStatus" AS ENUM ('UNDER_REVIEW', 'FINAL_APPROVED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "NotificationType" ADD VALUE 'PEER_REVIEW_ASSIGNED';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "NotificationType" ADD VALUE 'SUPERVISOR_REVIEW_DECIDED';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "NotificationType" ADD VALUE 'FINAL_EVALUATION_APPROVED';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "PeerSelection" (
  "id" TEXT NOT NULL,
  "cycleId" TEXT NOT NULL,
  "subjectEmployeeId" TEXT NOT NULL,
  "status" "PeerSelectionStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PeerSelection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PeerRecommendation" (
  "id" TEXT NOT NULL,
  "selectionId" TEXT NOT NULL,
  "peerEmployeeId" TEXT NOT NULL,
  "selected" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL,
  CONSTRAINT "PeerRecommendation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PeerReview" (
  "id" TEXT NOT NULL,
  "cycleId" TEXT NOT NULL,
  "subjectEmployeeId" TEXT NOT NULL,
  "reviewerEmployeeId" TEXT NOT NULL,
  "status" "PeerReviewSubmissionStatus" NOT NULL DEFAULT 'DRAFT',
  "totalScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "comment" TEXT NOT NULL DEFAULT '',
  "submittedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PeerReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PeerReviewResponse" (
  "id" TEXT NOT NULL,
  "peerReviewId" TEXT NOT NULL,
  "questionKey" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  "rating" INTEGER,
  "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "reason" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PeerReviewResponse_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SupervisorReview" (
  "id" TEXT NOT NULL,
  "cycleId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "supervisorId" TEXT NOT NULL,
  "decision" "SupervisorReviewDecision" NOT NULL DEFAULT 'PENDING',
  "comment" TEXT NOT NULL DEFAULT '',
  "decidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupervisorReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FinalEvaluation" (
  "id" TEXT NOT NULL,
  "cycleId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "status" "FinalEvaluationStatus" NOT NULL DEFAULT 'UNDER_REVIEW',
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinalEvaluation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PeerSelection_cycleId_subjectEmployeeId_key" ON "PeerSelection"("cycleId", "subjectEmployeeId");
CREATE INDEX IF NOT EXISTS "PeerSelection_cycleId_status_idx" ON "PeerSelection"("cycleId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "PeerRecommendation_selectionId_peerEmployeeId_key" ON "PeerRecommendation"("selectionId", "peerEmployeeId");
CREATE INDEX IF NOT EXISTS "PeerRecommendation_selectionId_sortOrder_idx" ON "PeerRecommendation"("selectionId", "sortOrder");
CREATE UNIQUE INDEX IF NOT EXISTS "PeerReview_cycleId_subjectEmployeeId_reviewerEmployeeId_key" ON "PeerReview"("cycleId", "subjectEmployeeId", "reviewerEmployeeId");
CREATE INDEX IF NOT EXISTS "PeerReview_reviewerEmployeeId_status_idx" ON "PeerReview"("reviewerEmployeeId", "status");
CREATE INDEX IF NOT EXISTS "PeerReview_subjectEmployeeId_status_idx" ON "PeerReview"("subjectEmployeeId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "PeerReviewResponse_peerReviewId_questionKey_key" ON "PeerReviewResponse"("peerReviewId", "questionKey");
CREATE UNIQUE INDEX IF NOT EXISTS "SupervisorReview_cycleId_employeeId_key" ON "SupervisorReview"("cycleId", "employeeId");
CREATE UNIQUE INDEX IF NOT EXISTS "FinalEvaluation_cycleId_employeeId_key" ON "FinalEvaluation"("cycleId", "employeeId");

DO $$ BEGIN
  ALTER TABLE "PeerSelection" ADD CONSTRAINT "PeerSelection_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "AppraisalCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "PeerSelection" ADD CONSTRAINT "PeerSelection_subjectEmployeeId_fkey" FOREIGN KEY ("subjectEmployeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "PeerRecommendation" ADD CONSTRAINT "PeerRecommendation_selectionId_fkey" FOREIGN KEY ("selectionId") REFERENCES "PeerSelection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "PeerRecommendation" ADD CONSTRAINT "PeerRecommendation_peerEmployeeId_fkey" FOREIGN KEY ("peerEmployeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "PeerReview" ADD CONSTRAINT "PeerReview_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "AppraisalCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "PeerReview" ADD CONSTRAINT "PeerReview_subjectEmployeeId_fkey" FOREIGN KEY ("subjectEmployeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "PeerReview" ADD CONSTRAINT "PeerReview_reviewerEmployeeId_fkey" FOREIGN KEY ("reviewerEmployeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "PeerReviewResponse" ADD CONSTRAINT "PeerReviewResponse_peerReviewId_fkey" FOREIGN KEY ("peerReviewId") REFERENCES "PeerReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "SupervisorReview" ADD CONSTRAINT "SupervisorReview_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "AppraisalCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "SupervisorReview" ADD CONSTRAINT "SupervisorReview_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "SupervisorReview" ADD CONSTRAINT "SupervisorReview_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "FinalEvaluation" ADD CONSTRAINT "FinalEvaluation_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "AppraisalCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "FinalEvaluation" ADD CONSTRAINT "FinalEvaluation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "FinalEvaluation" ADD CONSTRAINT "FinalEvaluation_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
