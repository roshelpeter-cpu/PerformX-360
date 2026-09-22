-- AlterTable
ALTER TABLE "PdpSubGoal" ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3);
ALTER TABLE "PdpSubGoal" ADD COLUMN IF NOT EXISTS "reviewedById" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PdpSubGoal_reviewedById_idx" ON "PdpSubGoal"("reviewedById");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PdpSubGoal_reviewedById_fkey'
  ) THEN
    ALTER TABLE "PdpSubGoal"
      ADD CONSTRAINT "PdpSubGoal_reviewedById_fkey"
      FOREIGN KEY ("reviewedById") REFERENCES "Employee"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
