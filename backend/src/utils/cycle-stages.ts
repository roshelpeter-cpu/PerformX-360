import { AppraisalStageKey } from "../../generated/prisma/client.js";
import { addOneYear } from "./cycle-dates.js";

export const ORG_STAGE_DEFINITIONS: Array<{
  key: AppraisalStageKey;
  title: string;
  /** Month offset from cycle start (0-based), day of month for start. */
  startOffsetMonths: number;
  startDay: number;
  endOffsetMonths: number;
  endDay: number;
}> = [
  {
    key: AppraisalStageKey.PERFORMANCE_PLANNING,
    title: "Performance Planning",
    startOffsetMonths: 0,
    startDay: 1,
    endOffsetMonths: 1,
    endDay: 28,
  },
  {
    key: AppraisalStageKey.PERFORMANCE_TRACKING,
    title: "Performance Tracking",
    startOffsetMonths: 2,
    startDay: 1,
    endOffsetMonths: 7,
    endDay: 31,
  },
  {
    key: AppraisalStageKey.SELF_REVIEW,
    title: "Self Review",
    startOffsetMonths: 8,
    startDay: 1,
    endOffsetMonths: 8,
    endDay: 30,
  },
  {
    key: AppraisalStageKey.PEER_REVIEW,
    title: "Peer Review",
    startOffsetMonths: 9,
    startDay: 1,
    endOffsetMonths: 9,
    endDay: 15,
  },
  {
    key: AppraisalStageKey.SUPERVISOR_REVIEW,
    title: "Supervisor Review",
    startOffsetMonths: 9,
    startDay: 16,
    endOffsetMonths: 10,
    endDay: 30,
  },
  {
    key: AppraisalStageKey.HR_EVALUATION,
    title: "HR Evaluation",
    startOffsetMonths: 11,
    startDay: 1,
    endOffsetMonths: 11,
    endDay: 31,
  },
];

function dateInYear(cycleStart: Date, monthOffset: number, day: number): Date {
  const year = cycleStart.getUTCFullYear();
  const month = cycleStart.getUTCMonth() + monthOffset;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, lastDay)));
}

export function buildDefaultStages(cycleStart: Date) {
  return ORG_STAGE_DEFINITIONS.map((stage, index) => ({
    key: stage.key,
    title: stage.title,
    sortOrder: index + 1,
    startDate: dateInYear(cycleStart, stage.startOffsetMonths, stage.startDay),
    endDate: dateInYear(cycleStart, stage.endOffsetMonths, stage.endDay),
  }));
}

export type StageDisplayStatus = "COMPLETED" | "CURRENT" | "UPCOMING";

export function deriveStageStatus(
  startDate: Date,
  endDate: Date,
  cycleStatus: string,
  now = new Date()
): StageDisplayStatus {
  if (cycleStatus === "COMPLETED") return "COMPLETED";
  if (cycleStatus === "DRAFT" || cycleStatus === "UPCOMING") return "UPCOMING";
  if (now < startDate) return "UPCOMING";
  if (now > endDate) return "COMPLETED";
  return "CURRENT";
}

export function currentPhaseFromStages(
  stages: Array<{ title: string; startDate: Date; endDate: Date; status: StageDisplayStatus }>
) {
  const current = stages.find((stage) => stage.status === "CURRENT");
  if (current) return current;
  const upcoming = stages.find((stage) => stage.status === "UPCOMING");
  if (upcoming) return upcoming;
  return stages[stages.length - 1] ?? null;
}

export { addOneYear };
