import {
  AppraisalCycleStatus,
  BatchWorkflowStage,
  MeetingStatus,
  MeetingType,
  PdpStatus,
} from "../../generated/prisma/client.js";

export const BATCH_STAGE_DEFINITIONS = [
  {
    id: BatchWorkflowStage.CONFIGURATION,
    title: "Performance Planning",
    description: "HR configures the organization-wide cycle and planning setup.",
  },
  {
    id: BatchWorkflowStage.PLANNING_MEETING,
    title: "Planning Meeting",
    description: "HR, supervisor, and employee complete the performance planning meeting.",
  },
  {
    id: BatchWorkflowStage.PDP_CREATION,
    title: "PDP Creation",
    description: "Supervisors create Personal Development Plans for employees.",
  },
  {
    id: BatchWorkflowStage.PDP_APPROVED,
    title: "PDP Approved",
    description: "PDPs for employees in this cycle have been approved.",
  },
  {
    id: BatchWorkflowStage.PROGRESS_PERIOD,
    title: "Performance Tracking",
    description: "Employees work against the approved PDP during the tracking window.",
  },
  {
    id: BatchWorkflowStage.SELF_REVIEW,
    title: "Self Review",
    description: "The self-review window is open for the organization-wide cycle.",
  },
  {
    id: BatchWorkflowStage.PEER_REVIEW,
    title: "Peer Review",
    description: "The peer-review window is open for the organization-wide cycle.",
  },
  {
    id: BatchWorkflowStage.SUPERVISOR_REVIEW,
    title: "Supervisor Review",
    description: "The supervisor-review window is open for the organization-wide cycle.",
  },
  {
    id: BatchWorkflowStage.HR_EVALUATION,
    title: "HR Evaluation",
    description: "HR staff perform final score calculation and HR evaluation.",
  },
  {
    id: BatchWorkflowStage.RECOGNITION_PIP,
    title: "Recognition & PIP",
    description: "Final appraisal is approved and recognition or PIP work begins.",
  },
  {
    id: BatchWorkflowStage.CLOSURE,
    title: "Closure",
    description: "The appraisal cycle has been closed.",
  },
] as const;

const STAGE_ORDER = BATCH_STAGE_DEFINITIONS.map((stage) => stage.id);

export function stageIndex(stage: BatchWorkflowStage) {
  return STAGE_ORDER.indexOf(stage);
}

export interface BatchActivitySnapshot {
  cycleStatus: AppraisalCycleStatus;
  employeeCount: number;
  completedPlanningMeetings: number;
  pdpCount: number;
  approvedPdpCount: number;
  selfReviewStartedAt: Date | null;
  peerReviewStartedAt: Date | null;
  supervisorReviewStartedAt: Date | null;
  hrEvaluationStartedAt: Date | null;
  recognitionStartedAt: Date | null;
  closedAt: Date | null;
}

export function deriveBatchStage(
  snapshot: BatchActivitySnapshot
): BatchWorkflowStage {
  if (
    snapshot.closedAt ||
    snapshot.cycleStatus === AppraisalCycleStatus.COMPLETED
  ) {
    return BatchWorkflowStage.CLOSURE;
  }
  if (snapshot.recognitionStartedAt) {
    return BatchWorkflowStage.RECOGNITION_PIP;
  }
  if (snapshot.hrEvaluationStartedAt) {
    return BatchWorkflowStage.HR_EVALUATION;
  }
  if (snapshot.supervisorReviewStartedAt) {
    return BatchWorkflowStage.SUPERVISOR_REVIEW;
  }
  if (snapshot.peerReviewStartedAt) {
    return BatchWorkflowStage.PEER_REVIEW;
  }
  if (snapshot.selfReviewStartedAt) {
    return BatchWorkflowStage.SELF_REVIEW;
  }

  const allPdpsApproved =
    snapshot.employeeCount > 0 &&
    snapshot.approvedPdpCount >= snapshot.employeeCount;
  if (allPdpsApproved) {
    return BatchWorkflowStage.PROGRESS_PERIOD;
  }

  const allPdpsCreated =
    snapshot.employeeCount > 0 && snapshot.pdpCount >= snapshot.employeeCount;
  if (allPdpsCreated) {
    return BatchWorkflowStage.PDP_APPROVED;
  }

  if (snapshot.pdpCount > 0 || snapshot.approvedPdpCount > 0) {
    return BatchWorkflowStage.PDP_CREATION;
  }

  const planningComplete =
    snapshot.employeeCount > 0 &&
    snapshot.completedPlanningMeetings >= snapshot.employeeCount;
  if (planningComplete) {
    return BatchWorkflowStage.PDP_CREATION;
  }

  if (snapshot.cycleStatus === AppraisalCycleStatus.DRAFT) {
    return BatchWorkflowStage.CONFIGURATION;
  }

  return BatchWorkflowStage.PLANNING_MEETING;
}

export function buildBatchTimeline(
  snapshot: BatchActivitySnapshot,
  dates: Partial<Record<BatchWorkflowStage, Date | null>> = {}
) {
  const current = deriveBatchStage(snapshot);
  const currentIndex = stageIndex(current);

  return {
    currentStage: current,
    currentStageLabel:
      BATCH_STAGE_DEFINITIONS[currentIndex]?.title ?? current,
    stages: BATCH_STAGE_DEFINITIONS.map((stage, index) => {
      let status: "completed" | "current" | "pending" = "pending";
      if (index < currentIndex) status = "completed";
      else if (index === currentIndex) status = "current";

      return {
        id: stage.id,
        title: stage.title,
        description: stage.description,
        status,
        date: dates[stage.id] ?? null,
        progress: status === "completed" ? 100 : status === "current" ? 40 : 0,
      };
    }),
  };
}

export const HR_STARTED_STAGES: BatchWorkflowStage[] = [
  BatchWorkflowStage.SELF_REVIEW,
  BatchWorkflowStage.PEER_REVIEW,
  BatchWorkflowStage.SUPERVISOR_REVIEW,
  BatchWorkflowStage.HR_EVALUATION,
  BatchWorkflowStage.RECOGNITION_PIP,
  BatchWorkflowStage.CLOSURE,
];

export const NEXT_HR_STAGE: Partial<Record<BatchWorkflowStage, BatchWorkflowStage>> = {
  [BatchWorkflowStage.PROGRESS_PERIOD]: BatchWorkflowStage.SELF_REVIEW,
  [BatchWorkflowStage.SELF_REVIEW]: BatchWorkflowStage.PEER_REVIEW,
  [BatchWorkflowStage.PEER_REVIEW]: BatchWorkflowStage.SUPERVISOR_REVIEW,
  [BatchWorkflowStage.SUPERVISOR_REVIEW]: BatchWorkflowStage.HR_EVALUATION,
  [BatchWorkflowStage.HR_EVALUATION]: BatchWorkflowStage.RECOGNITION_PIP,
  [BatchWorkflowStage.RECOGNITION_PIP]: BatchWorkflowStage.CLOSURE,
};

export { MeetingStatus, MeetingType, PdpStatus };
