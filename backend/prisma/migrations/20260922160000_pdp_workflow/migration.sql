-- AlterEnum PdpStatus (compatible with Postgres versions without ADD VALUE IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'PdpStatus' AND e.enumlabel = 'ACTIVE'
  ) THEN
    ALTER TYPE "PdpStatus" ADD VALUE 'ACTIVE';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'PdpStatus' AND e.enumlabel = 'PENDING_REAPPROVAL'
  ) THEN
    ALTER TYPE "PdpStatus" ADD VALUE 'PENDING_REAPPROVAL';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'PdpStatus' AND e.enumlabel = 'AWAITING_SUPERVISOR_ACTION'
  ) THEN
    ALTER TYPE "PdpStatus" ADD VALUE 'AWAITING_SUPERVISOR_ACTION';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'PdpStatus' AND e.enumlabel = 'AWAITING_HR_DECISION'
  ) THEN
    ALTER TYPE "PdpStatus" ADD VALUE 'AWAITING_HR_DECISION';
  END IF;
END $$;

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PdpApprovalStatus') THEN
    CREATE TYPE "PdpApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'CHANGES_REQUESTED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PdpReviewerRole') THEN
    CREATE TYPE "PdpReviewerRole" AS ENUM ('EMPLOYEE', 'HR');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PdpChangeRequestStatus') THEN
    CREATE TYPE "PdpChangeRequestStatus" AS ENUM (
      'OPEN',
      'SUPERVISOR_WILL_CHANGE',
      'SUPERVISOR_CANNOT_CHANGE',
      'HR_REQUIRES_CHANGE',
      'HR_CHANGE_NOT_REQUIRED',
      'RESOLVED'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PdpSupervisorChangeAction') THEN
    CREATE TYPE "PdpSupervisorChangeAction" AS ENUM ('WILL_CHANGE', 'CANNOT_CHANGE');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PdpHrChangeDecision') THEN
    CREATE TYPE "PdpHrChangeDecision" AS ENUM ('CHANGE_MUST_HAPPEN', 'CHANGE_NOT_REQUIRED');
  END IF;
END $$;

-- AlterTable PersonalDevelopmentPlan
ALTER TABLE "PersonalDevelopmentPlan" ADD COLUMN IF NOT EXISTS "title" TEXT NOT NULL DEFAULT 'Professional Development Plan';
ALTER TABLE "PersonalDevelopmentPlan" ADD COLUMN IF NOT EXISTS "assignedAt" TIMESTAMP(3);
ALTER TABLE "PersonalDevelopmentPlan" ADD COLUMN IF NOT EXISTS "currentVersionNumber" INTEGER NOT NULL DEFAULT 1;

-- CreateTable PdpVersion
CREATE TABLE IF NOT EXISTS "PdpVersion" (
    "id" TEXT NOT NULL,
    "pdpId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "revisionReason" TEXT,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PdpVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable PdpVersionApproval
CREATE TABLE IF NOT EXISTS "PdpVersionApproval" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "reviewerRole" "PdpReviewerRole" NOT NULL,
    "status" "PdpApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PdpVersionApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable PdpChangeRequest
CREATE TABLE IF NOT EXISTS "PdpChangeRequest" (
    "id" TEXT NOT NULL,
    "pdpId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "requesterRole" "PdpReviewerRole" NOT NULL,
    "message" TEXT NOT NULL,
    "status" "PdpChangeRequestStatus" NOT NULL DEFAULT 'OPEN',
    "supervisorResponse" TEXT,
    "supervisorAction" "PdpSupervisorChangeAction",
    "supervisorRespondedAt" TIMESTAMP(3),
    "supervisorId" TEXT,
    "hrDecision" "PdpHrChangeDecision",
    "hrDecisionNote" TEXT,
    "hrDecidedAt" TIMESTAMP(3),
    "hrDeciderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PdpChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable PdpActivity
CREATE TABLE IF NOT EXISTS "PdpActivity" (
    "id" TEXT NOT NULL,
    "pdpId" TEXT NOT NULL,
    "versionId" TEXT,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PdpActivity_pkey" PRIMARY KEY ("id")
);

-- AlterTable PdpGoal
ALTER TABLE "PdpGoal" ADD COLUMN IF NOT EXISTS "versionId" TEXT;

-- AlterTable PdpReviewComment — ensure id default + versionId
ALTER TABLE "PdpReviewComment" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "PdpReviewComment" ADD COLUMN IF NOT EXISTS "versionId" TEXT;

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "PdpVersion_pdpId_versionNumber_key" ON "PdpVersion"("pdpId", "versionNumber");
CREATE INDEX IF NOT EXISTS "PdpVersion_pdpId_isCurrent_idx" ON "PdpVersion"("pdpId", "isCurrent");
CREATE UNIQUE INDEX IF NOT EXISTS "PdpVersionApproval_versionId_reviewerRole_key" ON "PdpVersionApproval"("versionId", "reviewerRole");
CREATE INDEX IF NOT EXISTS "PdpVersionApproval_versionId_idx" ON "PdpVersionApproval"("versionId");
CREATE INDEX IF NOT EXISTS "PdpVersionApproval_reviewerId_idx" ON "PdpVersionApproval"("reviewerId");
CREATE INDEX IF NOT EXISTS "PdpChangeRequest_pdpId_status_idx" ON "PdpChangeRequest"("pdpId", "status");
CREATE INDEX IF NOT EXISTS "PdpChangeRequest_versionId_idx" ON "PdpChangeRequest"("versionId");
CREATE INDEX IF NOT EXISTS "PdpActivity_pdpId_createdAt_idx" ON "PdpActivity"("pdpId", "createdAt");
CREATE INDEX IF NOT EXISTS "PdpGoal_versionId_idx" ON "PdpGoal"("versionId");
CREATE INDEX IF NOT EXISTS "PdpReviewComment_versionId_idx" ON "PdpReviewComment"("versionId");

-- Foreign keys (ignore if already present)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PdpVersion_pdpId_fkey') THEN
    ALTER TABLE "PdpVersion" ADD CONSTRAINT "PdpVersion_pdpId_fkey" FOREIGN KEY ("pdpId") REFERENCES "PersonalDevelopmentPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PdpVersion_createdById_fkey') THEN
    ALTER TABLE "PdpVersion" ADD CONSTRAINT "PdpVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PdpVersionApproval_versionId_fkey') THEN
    ALTER TABLE "PdpVersionApproval" ADD CONSTRAINT "PdpVersionApproval_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "PdpVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PdpVersionApproval_reviewerId_fkey') THEN
    ALTER TABLE "PdpVersionApproval" ADD CONSTRAINT "PdpVersionApproval_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PdpChangeRequest_pdpId_fkey') THEN
    ALTER TABLE "PdpChangeRequest" ADD CONSTRAINT "PdpChangeRequest_pdpId_fkey" FOREIGN KEY ("pdpId") REFERENCES "PersonalDevelopmentPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PdpChangeRequest_versionId_fkey') THEN
    ALTER TABLE "PdpChangeRequest" ADD CONSTRAINT "PdpChangeRequest_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "PdpVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PdpChangeRequest_requestedById_fkey') THEN
    ALTER TABLE "PdpChangeRequest" ADD CONSTRAINT "PdpChangeRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PdpChangeRequest_supervisorId_fkey') THEN
    ALTER TABLE "PdpChangeRequest" ADD CONSTRAINT "PdpChangeRequest_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PdpChangeRequest_hrDeciderId_fkey') THEN
    ALTER TABLE "PdpChangeRequest" ADD CONSTRAINT "PdpChangeRequest_hrDeciderId_fkey" FOREIGN KEY ("hrDeciderId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PdpActivity_pdpId_fkey') THEN
    ALTER TABLE "PdpActivity" ADD CONSTRAINT "PdpActivity_pdpId_fkey" FOREIGN KEY ("pdpId") REFERENCES "PersonalDevelopmentPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PdpActivity_versionId_fkey') THEN
    ALTER TABLE "PdpActivity" ADD CONSTRAINT "PdpActivity_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "PdpVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PdpActivity_actorId_fkey') THEN
    ALTER TABLE "PdpActivity" ADD CONSTRAINT "PdpActivity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PdpGoal_versionId_fkey') THEN
    ALTER TABLE "PdpGoal" ADD CONSTRAINT "PdpGoal_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "PdpVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PdpReviewComment_versionId_fkey') THEN
    ALTER TABLE "PdpReviewComment" ADD CONSTRAINT "PdpReviewComment_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "PdpVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
