import { apiRequest } from "@/services/api/client";

export interface EvaluationPackage {
  employee: {
    id: string;
    employeeId: string;
    name: string;
    jobTitle: string | null;
    department: string;
    team: string;
    supervisor: string;
  };
  cycle: { id: string; name: string };
  pdp: {
    id: string;
    title: string;
    status: string;
    progress: number;
    earnedPoints: number;
    pendingReviews: number;
    evidenceCount: number;
  } | null;
  selfReview: {
    status: string;
    score: number;
    maxScore: number;
    percentage: number;
    submittedAt: string | null;
    responses?: Array<{ question: string; rating: number | null; score: number; reason: string }>;
  };
  peerReview: {
    score: number;
    maxScore: number;
    status: string;
    reviewers: Array<{
      name: string;
      employeeId: string;
      status: string;
      score: number;
      comment: string;
      responses: Array<{ question: string; rating: number | null; score: number; reason: string }>;
    }>;
  };
  supervisorReview: { decision: string; comment: string; supervisor: string; decidedAt: string | null };
  scores: { self: number; peer: number; supervisorPdp: number; total: number; band: string };
  status: string;
  finalApproval: { status: string; approvedAt: string | null };
}

export interface PeerAssignment {
  id: string;
  status: "DRAFT" | "SUBMITTED";
  editableSubmitted?: boolean;
  totalScore: number;
  comment: string;
  subject: { id: string; employeeId: string; name: string; jobTitle: string | null; department: string; team: string };
  responses: Array<{ questionKey: string; question: string; sortOrder: number; rating: number | null; score: number; reason: string }>;
}

export interface MyPeerReview {
  received: { status: string; score: number | null; maxScore: number; label: string | null };
  assignments: PeerAssignment[];
}

export interface PeerCandidate {
  id: string;
  employeeId: string;
  name: string;
  jobTitle: string | null;
  department: string;
  team: string;
  selected?: boolean;
}

export interface PeerSelection {
  subject: PeerCandidate;
  status: string;
  recommendations: PeerCandidate[];
  reviews: Array<{ id: string; status: string; totalScore: number; comment: string; reviewer: PeerCandidate }>;
}

export interface EmployeeFinalEvaluation {
  started: boolean;
  employee?: EvaluationPackage["employee"];
  cycle?: { id: string; name: string };
  pdp?: {
    earnedPoints: number;
    progress: number;
    supervisorScore: number;
    maxSupervisorScore: number;
  } | null;
  selfReview?: { score: number; maxScore: number; status: string };
  peerReview?: { score: number; maxScore: number; status: string };
  supervisorReview?: {
    score: number;
    maxScore: number;
    decision: string;
    comment: string;
    supervisor: string;
  };
  hrReview?: { status: string; comment: string; approvedAt: string | null };
  finalScore?: {
    self: number;
    peer: number;
    supervisorPdp: number;
    total: number;
    band: string;
  };
  bonus?: {
    finalScore: number;
    band: string;
    eligible: boolean;
    amount: number;
    status: string;
    calculation: string;
  } | null;
  promotion?: {
    recommendedPosition: string | null;
    reason: string;
    status: string;
    hrReason: string | null;
  } | null;
  awards?: Array<{ title: string; category: string; reason: string }>;
  pip?: { required: boolean; status: string | null; title: string | null; summary: string | null };
}

export const reviewsApi = {
  getPackage(employeeId: string) {
    return apiRequest<{ success: true; evaluation: EvaluationPackage }>(`/evaluations/employees/${employeeId}`);
  },
  myFinalEvaluation() {
    return apiRequest<{ success: true; evaluation: EmployeeFinalEvaluation }>(`/evaluations/mine`);
  },
  decide(employeeId: string, body: { decision: "APPROVED" | "DECLINED"; comment: string }) {
    return apiRequest<{ success: true; package: EvaluationPackage }>(
      `/evaluations/employees/${employeeId}/supervisor-decision`,
      { method: "POST", body }
    );
  },
  approveFinal(employeeId: string) {
    return apiRequest<{ success: true; evaluation: EvaluationPackage }>(
      `/evaluations/employees/${employeeId}/final-approval`,
      { method: "POST" }
    );
  },
  myPeerReview() {
    return apiRequest<{ success: true; peerReview: MyPeerReview }>(`/peer-reviews/mine`);
  },
  savePeerReview(reviewId: string, body: { comment: string; responses: Array<{ questionKey: string; rating: number | null; reason: string }> }) {
    return apiRequest<{ success: true; peerReview: MyPeerReview }>(`/peer-reviews/assignments/${reviewId}`, {
      method: "PUT",
      body,
    });
  },
  submitPeerReview(reviewId: string) {
    return apiRequest<{ success: true; message: string; peerReview: MyPeerReview }>(
      `/peer-reviews/assignments/${reviewId}/submit`,
      { method: "POST" }
    );
  },
  peerDirectory() {
    return apiRequest<{
      success: true;
      directory: {
        cycle: { id: string; name: string };
        departments: Array<{
          name: string;
          teams: Array<{
            name: string;
            employees: Array<PeerCandidate & { selectionStatus: string; selectedPeers: PeerCandidate[] }>;
          }>;
        }>;
      };
    }>(`/peer-reviews/directory`);
  },
  peerSelection(employeeId: string) {
    return apiRequest<{ success: true; selection: PeerSelection }>(`/peer-reviews/employees/${employeeId}`);
  },
  generatePeers(employeeId: string) {
    return apiRequest<{ success: true; selection: PeerSelection }>(
      `/peer-reviews/employees/${employeeId}/recommendations`,
      { method: "POST" }
    );
  },
  selectPeers(employeeId: string, peerIds: string[]) {
    return apiRequest<{ success: true; selection: PeerSelection }>(`/peer-reviews/employees/${employeeId}/select`, {
      method: "POST",
      body: { peerIds },
    });
  },
  teamPeerBoard() {
    return apiRequest<{
      success: true;
      board: {
        cycle: { id: string; name: string };
        employees: Array<{
          id: string;
          employeeId: string;
          name: string;
          team: string;
          peer1: { name: string; employeeId: string; status: string; score: number | null };
          peer2: { name: string; employeeId: string; status: string; score: number | null };
          reviewStatus: string;
        }>;
      };
    }>(`/peer-reviews/team`);
  },
};

export interface PromotionItem {
  id: string;
  reason: string;
  pdpScore: number;
  pdpProgress: number | null;
  status: "PENDING" | "SHORTLISTED" | "REJECTED";
  hrReason: string | null;
  decidedAt: string | null;
  createdAt: string;
  band: string | null;
  employee: { id: string; employeeId: string; name: string; department: string; team: string };
  supervisor: { id: string; employeeId: string; name: string };
  decidedBy: { id: string; name: string } | null;
  scores: { self: number; peer: number; supervisorPdp: number; total: number; band: string } | null;
}

export const promotionsApi = {
  list() {
    return apiRequest<{ success: true; cycle: { id: string; name: string }; items: PromotionItem[] }>(`/promotions`);
  },
  get(id: string) {
    return apiRequest<{ success: true; recommendation: PromotionItem }>(`/promotions/${id}`);
  },
  recommend(body: { employeeId: string; reason: string }) {
    return apiRequest<{ success: true; recommendation: PromotionItem }>(`/promotions`, { method: "POST", body });
  },
  shortlist(id: string, reason: string) {
    return apiRequest<{ success: true; recommendation: PromotionItem }>(`/promotions/${id}/shortlist`, {
      method: "POST",
      body: { reason },
    });
  },
  reject(id: string, reason: string) {
    return apiRequest<{ success: true; recommendation: PromotionItem }>(`/promotions/${id}/reject`, {
      method: "POST",
      body: { reason },
    });
  },
};

export interface FinalBoardItem {
  employee: EvaluationPackage["employee"];
  pdp: {
    id: string;
    status: string;
    progress: number;
    earnedPoints: number;
    pendingReviews: number;
    updatedAt: string;
  } | null;
  selfStatus: string;
  peerCount: number;
  supervisorDecision: string;
  supervisorComment: string;
  finalStatus: string;
  approvedAt: string | null;
  scores: EvaluationPackage["scores"];
}

export interface BonusRow {
  id: string;
  finalScore: number;
  band: string;
  bonusMonths: number;
  dailyAmount: number;
  workingDaysPerMonth: number;
  amount: number;
  calculation: string;
  status: string;
  authorizedAt: string | null;
  employee: { id: string; employeeId: string; name: string };
}

export const evaluationsApi = {
  performanceBoard() {
    return apiRequest<{
      success: true;
      board: { cycle: { id: string; name: string }; assigned: FinalBoardItem[]; notAssigned: FinalBoardItem[] };
    }>(`/evaluations/performance-board`);
  },
  finalBoard() {
    return apiRequest<{
      success: true;
      board: { cycle: { id: string; name: string }; items: FinalBoardItem[] };
    }>(`/evaluations/final-board`);
  },
};

export const bonusesApi = {
  list() {
    return apiRequest<{
      success: true;
      board: {
        cycle: { id: string; name: string };
        formula: {
          dailyAmount: number;
          workingDaysPerMonth: number;
          months: Record<string, number>;
          interpretation: string;
        };
        needsCalculation: Array<{
          employee: { id: string; employeeId: string; name: string };
          finalScore: number;
          band: string;
          bonusStatus: string;
          calculation: BonusRow | null;
        }>;
        completed: BonusRow[];
      };
    }>(`/bonuses`);
  },
  calculate(employeeId: string) {
    return apiRequest<{ success: true; calculation: BonusRow }>(`/bonuses/employees/${employeeId}/calculate`, {
      method: "POST",
    });
  },
  authorize(employeeId: string) {
    return apiRequest<{ success: true; calculation: BonusRow }>(`/bonuses/employees/${employeeId}/authorize`, {
      method: "POST",
    });
  },
};

export const PEER_RATINGS = [
  { value: 1, label: "1 — Needs significant improvement" },
  { value: 2, label: "2 — Needs improvement" },
  { value: 3, label: "3 — Meets expectations" },
  { value: 4, label: "4 — Exceeds expectations" },
  { value: 5, label: "5 — Outstanding" },
];
