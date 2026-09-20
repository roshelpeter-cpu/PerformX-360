ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "profileDetails" JSONB;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'NotificationType' AND e.enumlabel = 'PROFILE_CHANGE_REQUEST'
  ) THEN
    ALTER TYPE "NotificationType" ADD VALUE 'PROFILE_CHANGE_REQUEST';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProfileChangeRequestType') THEN
    CREATE TYPE "ProfileChangeRequestType" AS ENUM (
      'PERSONAL_INFORMATION',
      'CONTACT_INFORMATION',
      'EMERGENCY_CONTACT',
      'EMPLOYMENT_INFORMATION',
      'OTHER'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProfileChangeRequestStatus') THEN
    CREATE TYPE "ProfileChangeRequestStatus" AS ENUM (
      'PENDING',
      'APPROVED',
      'REJECTED'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "ProfileChangeRequest" (
  "id" TEXT NOT NULL,
  "requesterId" TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  "requestType" "ProfileChangeRequestType" NOT NULL,
  "summary" TEXT NOT NULL,
  "currentValue" TEXT NOT NULL,
  "requestedValue" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "evidence" TEXT,
  "evidenceName" TEXT,
  "evidenceMime" TEXT,
  "evidenceSize" INTEGER,
  "status" "ProfileChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProfileChangeRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProfileChangeRequest_recipientId_status_idx"
  ON "ProfileChangeRequest"("recipientId", "status");
CREATE INDEX IF NOT EXISTS "ProfileChangeRequest_requesterId_createdAt_idx"
  ON "ProfileChangeRequest"("requesterId", "createdAt");

ALTER TABLE "ProfileChangeRequest"
  DROP CONSTRAINT IF EXISTS "ProfileChangeRequest_requesterId_fkey";
ALTER TABLE "ProfileChangeRequest"
  ADD CONSTRAINT "ProfileChangeRequest_requesterId_fkey"
  FOREIGN KEY ("requesterId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProfileChangeRequest"
  DROP CONSTRAINT IF EXISTS "ProfileChangeRequest_recipientId_fkey";
ALTER TABLE "ProfileChangeRequest"
  ADD CONSTRAINT "ProfileChangeRequest_recipientId_fkey"
  FOREIGN KEY ("recipientId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProfileChangeRequest"
  DROP CONSTRAINT IF EXISTS "ProfileChangeRequest_reviewedById_fkey";
ALTER TABLE "ProfileChangeRequest"
  ADD CONSTRAINT "ProfileChangeRequest_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
