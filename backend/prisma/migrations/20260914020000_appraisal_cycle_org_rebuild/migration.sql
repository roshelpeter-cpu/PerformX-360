-- Organization-wide appraisal cycle support: teams, HR assignments,
-- cycle stages, activity history, and employee participation progress.

CREATE TYPE "AppraisalStageKey" AS ENUM (
  'PERFORMANCE_PLANNING',
  'PERFORMANCE_TRACKING',
  'SELF_REVIEW',
  'PEER_REVIEW',
  'SUPERVISOR_REVIEW',
  'HR_EVALUATION'
);

CREATE TYPE "EmployeeCycleProgressStatus" AS ENUM (
  'NOT_STARTED',
  'IN_PROGRESS',
  'COMPLETED',
  'OVERDUE'
);

CREATE TABLE "Team" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "departmentId" TEXT NOT NULL,
  "supervisorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HrTeamAssignment" (
  "id" TEXT NOT NULL,
  "hrEmployeeId" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HrTeamAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AppraisalCycleStage" (
  "id" TEXT NOT NULL,
  "cycleId" TEXT NOT NULL,
  "key" "AppraisalStageKey" NOT NULL,
  "title" TEXT NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AppraisalCycleStage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AppraisalCycleActivity" (
  "id" TEXT NOT NULL,
  "cycleId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "details" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AppraisalCycleActivity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmployeeCycleParticipation" (
  "id" TEXT NOT NULL,
  "cycleId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "status" "EmployeeCycleProgressStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "progressPercent" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmployeeCycleParticipation_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Employee" ADD COLUMN "teamId" TEXT;

CREATE UNIQUE INDEX "Team_departmentId_name_key" ON "Team"("departmentId", "name");
CREATE INDEX "Team_departmentId_idx" ON "Team"("departmentId");
CREATE INDEX "Team_supervisorId_idx" ON "Team"("supervisorId");

CREATE UNIQUE INDEX "HrTeamAssignment_teamId_key" ON "HrTeamAssignment"("teamId");
CREATE INDEX "HrTeamAssignment_hrEmployeeId_idx" ON "HrTeamAssignment"("hrEmployeeId");

CREATE UNIQUE INDEX "AppraisalCycleStage_cycleId_key_key" ON "AppraisalCycleStage"("cycleId", "key");
CREATE INDEX "AppraisalCycleStage_cycleId_sortOrder_idx" ON "AppraisalCycleStage"("cycleId", "sortOrder");

CREATE INDEX "AppraisalCycleActivity_cycleId_createdAt_idx" ON "AppraisalCycleActivity"("cycleId", "createdAt");

CREATE UNIQUE INDEX "EmployeeCycleParticipation_cycleId_employeeId_key" ON "EmployeeCycleParticipation"("cycleId", "employeeId");
CREATE INDEX "EmployeeCycleParticipation_cycleId_status_idx" ON "EmployeeCycleParticipation"("cycleId", "status");
CREATE INDEX "EmployeeCycleParticipation_employeeId_idx" ON "EmployeeCycleParticipation"("employeeId");

CREATE INDEX "Employee_teamId_idx" ON "Employee"("teamId");

ALTER TABLE "Team" ADD CONSTRAINT "Team_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Team" ADD CONSTRAINT "Team_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "HrTeamAssignment" ADD CONSTRAINT "HrTeamAssignment_hrEmployeeId_fkey" FOREIGN KEY ("hrEmployeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HrTeamAssignment" ADD CONSTRAINT "HrTeamAssignment_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Employee" ADD CONSTRAINT "Employee_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AppraisalCycleStage" ADD CONSTRAINT "AppraisalCycleStage_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "AppraisalCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AppraisalCycleActivity" ADD CONSTRAINT "AppraisalCycleActivity_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "AppraisalCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppraisalCycleActivity" ADD CONSTRAINT "AppraisalCycleActivity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EmployeeCycleParticipation" ADD CONSTRAINT "EmployeeCycleParticipation_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "AppraisalCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeCycleParticipation" ADD CONSTRAINT "EmployeeCycleParticipation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
