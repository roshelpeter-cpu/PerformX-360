import { apiRequest } from "@/services/api/client";

export interface AwardRow {
  id: string;
  category: string;
  title: string;
  reason: string;
  finalScore: number;
  performanceBand: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  approvedAt: string | null;
  createdAt: string;
  nominatedBy?: string;
  employee: {
    id: string;
    employeeId: string;
    name: string;
    department: string;
  };
  approvedBy: { id: string; name: string; employeeId: string } | null;
}

export interface AwardBoardItem {
  id: string;
  kind: "AWARD" | "BONUS" | "PROMOTION";
  type: string;
  title: string;
  reason: string;
  amount?: number | null;
  finalScore: number;
  performanceBand: string | null;
  status: string;
  nominatedBy?: string;
  employee: AwardRow["employee"];
  approvedBy?: AwardRow["approvedBy"];
  approvedAt?: string | null;
  createdAt?: string;
  category?: string;
}

export interface AwardBoard {
  cycle: { id: string; name: string; startDate?: string; endDate?: string };
  cycles?: Array<{ id: string; name: string; status: string }>;
  summary?: {
    awardNominations: number;
    pendingAwards: number;
    bonusRecommendations: number;
    promotionRecommendations: number;
    recognitionsThisMonth: number;
  };
  awards: AwardRow[];
  bonuses?: Array<{
    id: string;
    type: "BONUS";
    title: string;
    reason: string;
    amount: number;
    finalScore: number;
    performanceBand: string;
    status: string;
    nominatedBy?: string;
    employee: AwardRow["employee"];
  }>;
  promotions?: Array<{
    id: string;
    type: "PROMOTION";
    title: string;
    reason: string;
    amount: number;
    finalScore: number;
    performanceBand: string | null;
    status: string;
    nominatedBy?: string;
    hrReason?: string | null;
    employee: AwardRow["employee"];
  }>;
}

export const awardsApi = {
  list() {
    return apiRequest<{ success: true; board: AwardBoard }>("/awards");
  },
  generate() {
    return apiRequest<{ success: true; board: AwardBoard }>("/awards/generate", { method: "POST" });
  },
  get(awardId: string) {
    return apiRequest<{ success: true; award: AwardRow }>(`/awards/${awardId}`);
  },
  approve(awardId: string) {
    return apiRequest<{ success: true; award: AwardRow }>(`/awards/${awardId}/approve`, { method: "POST" });
  },
};
