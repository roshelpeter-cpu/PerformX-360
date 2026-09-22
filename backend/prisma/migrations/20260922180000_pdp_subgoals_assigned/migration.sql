-- Add ASSIGNED status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'PdpStatus' AND e.enumlabel = 'ASSIGNED'
  ) THEN
    ALTER TYPE "PdpStatus" ADD VALUE 'ASSIGNED';
  END IF;
END $$;

ALTER TABLE "PersonalDevelopmentPlan" ADD COLUMN IF NOT EXISTS "activatedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "PdpSubGoal" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "dueDate" TIMESTAMP(3),
    "expectedOutcome" TEXT,
    "successCriteria" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PdpSubGoal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PdpSubGoal_goalId_idx" ON "PdpSubGoal"("goalId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PdpSubGoal_goalId_fkey'
  ) THEN
    ALTER TABLE "PdpSubGoal"
      ADD CONSTRAINT "PdpSubGoal_goalId_fkey"
      FOREIGN KEY ("goalId") REFERENCES "PdpGoal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
