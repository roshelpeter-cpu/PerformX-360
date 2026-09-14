-- HR responsibility reassignment audit trail (evidence-backed).
CREATE TABLE "HrTeamReassignmentHistory" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "previousHrId" TEXT,
    "newHrId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "evidenceName" TEXT NOT NULL,
    "changedById" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrTeamReassignmentHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HrTeamReassignmentHistory_cycleId_changedAt_idx" ON "HrTeamReassignmentHistory"("cycleId", "changedAt");
CREATE INDEX "HrTeamReassignmentHistory_teamId_idx" ON "HrTeamReassignmentHistory"("teamId");

ALTER TABLE "HrTeamReassignmentHistory" ADD CONSTRAINT "HrTeamReassignmentHistory_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "AppraisalCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HrTeamReassignmentHistory" ADD CONSTRAINT "HrTeamReassignmentHistory_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HrTeamReassignmentHistory" ADD CONSTRAINT "HrTeamReassignmentHistory_previousHrId_fkey" FOREIGN KEY ("previousHrId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HrTeamReassignmentHistory" ADD CONSTRAINT "HrTeamReassignmentHistory_newHrId_fkey" FOREIGN KEY ("newHrId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrTeamReassignmentHistory" ADD CONSTRAINT "HrTeamReassignmentHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
