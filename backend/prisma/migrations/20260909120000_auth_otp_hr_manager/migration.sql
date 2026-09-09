-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'HR_MANAGER';

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Employee" ADD COLUMN "oneTimePasswordHash" TEXT;
ALTER TABLE "Employee" ADD COLUMN "oneTimePasswordExpiresAt" TIMESTAMP(3);
