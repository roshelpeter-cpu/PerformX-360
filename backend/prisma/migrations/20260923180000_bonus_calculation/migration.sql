DO $$ BEGIN
  ALTER TYPE "NotificationType" ADD VALUE 'BONUS_AUTHORIZED';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "BonusAuthorizationStatus" AS ENUM ('CALCULATED', 'AUTHORIZED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "BonusCalculation" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "finalScore" DOUBLE PRECISION NOT NULL,
    "band" TEXT NOT NULL,
    "bonusMonths" DOUBLE PRECISION NOT NULL,
    "dailyAmount" DOUBLE PRECISION NOT NULL,
    "workingDaysPerMonth" INTEGER NOT NULL DEFAULT 22,
    "amount" DOUBLE PRECISION NOT NULL,
    "calculation" TEXT NOT NULL,
    "status" "BonusAuthorizationStatus" NOT NULL DEFAULT 'CALCULATED',
    "authorizedById" TEXT,
    "authorizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BonusCalculation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BonusCalculation_cycleId_employeeId_key" ON "BonusCalculation"("cycleId", "employeeId");
CREATE INDEX IF NOT EXISTS "BonusCalculation_status_idx" ON "BonusCalculation"("status");

DO $$ BEGIN
  ALTER TABLE "BonusCalculation" ADD CONSTRAINT "BonusCalculation_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "AppraisalCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "BonusCalculation" ADD CONSTRAINT "BonusCalculation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "BonusCalculation" ADD CONSTRAINT "BonusCalculation_authorizedById_fkey" FOREIGN KEY ("authorizedById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
