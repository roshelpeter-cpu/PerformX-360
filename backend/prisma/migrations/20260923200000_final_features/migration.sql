DO $$ BEGIN
  CREATE TYPE "PlanType" AS ENUM ('PDP', 'PIP');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AwardCategory" AS ENUM ('OUTSTANDING_PERFORMER', 'EMPLOYEE_OF_THE_YEAR', 'EMPLOYEE_OF_THE_MONTH');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AwardStatus" AS ENUM ('PENDING', 'APPROVED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "NotificationType" ADD VALUE 'AWARD_RECOMMENDED';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "NotificationType" ADD VALUE 'AWARD_APPROVED';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "NotificationType" ADD VALUE 'PIP_ASSIGNED';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "NotificationType" ADD VALUE 'PIP_SUBMITTED';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "PersonalDevelopmentPlan" ADD COLUMN IF NOT EXISTS "planType" "PlanType" NOT NULL DEFAULT 'PDP';

DROP INDEX IF EXISTS "PersonalDevelopmentPlan_cycleId_employeeId_key";

CREATE UNIQUE INDEX IF NOT EXISTS "PersonalDevelopmentPlan_cycleId_employeeId_planType_key"
  ON "PersonalDevelopmentPlan"("cycleId", "employeeId", "planType");

CREATE INDEX IF NOT EXISTS "PersonalDevelopmentPlan_planType_idx"
  ON "PersonalDevelopmentPlan"("planType");

CREATE TABLE IF NOT EXISTS "RecognitionAward" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "category" "AwardCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "finalScore" DOUBLE PRECISION NOT NULL,
    "performanceBand" TEXT NOT NULL,
    "status" "AwardStatus" NOT NULL DEFAULT 'PENDING',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RecognitionAward_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RecognitionAward_cycleId_employeeId_category_key"
  ON "RecognitionAward"("cycleId", "employeeId", "category");

CREATE INDEX IF NOT EXISTS "RecognitionAward_status_idx" ON "RecognitionAward"("status");
CREATE INDEX IF NOT EXISTS "RecognitionAward_category_idx" ON "RecognitionAward"("category");

DO $$ BEGIN
  ALTER TABLE "RecognitionAward"
    ADD CONSTRAINT "RecognitionAward_cycleId_fkey"
    FOREIGN KEY ("cycleId") REFERENCES "AppraisalCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "RecognitionAward"
    ADD CONSTRAINT "RecognitionAward_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "RecognitionAward"
    ADD CONSTRAINT "RecognitionAward_approvedById_fkey"
    FOREIGN KEY ("approvedById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
