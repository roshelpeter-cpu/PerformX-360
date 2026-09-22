-- AlterTable
ALTER TABLE "PdpSubGoal" ADD COLUMN IF NOT EXISTS "submittedStatus" "PdpSubGoalStatus";

-- Existing pending submissions were completion requests.
UPDATE "PdpSubGoal"
SET "submittedStatus" = 'COMPLETED'
WHERE "status" = 'PENDING_APPROVAL' AND "submittedStatus" IS NULL;
