import { apiRequest } from "@/services/api/client";

export interface AwardRow {
  id: string;
  category: string;
  title: string;
  reason: string;
  finalScore: number;
  performanceBand: string;
  status: "PENDING" | "APPROVED";
  approvedAt: string | null;
  createdAt: string;
  employee: {
    id: string;
    employeeId: string;
    name: string;
    department: string;
  };
  approvedBy: { id: string; name: string; employeeId: string } | null;
}

export const awardsApi = {
  list() {
    return apiRequest<{ success: true; board: { cycle: { id: string; name: string }; awards: AwardRow[] } }>(
      "/awards"
    );
  },
  generate() {
    return apiRequest<{ success: true; board: { cycle: { id: string; name: string }; awards: AwardRow[] } }>(
      "/awards/generate",
      { method: "POST" }
    );
  },
  get(awardId: string) {
    return apiRequest<{ success: true; award: AwardRow }>(`/awards/${awardId}`);
  },
  approve(awardId: string) {
    return apiRequest<{ success: true; award: AwardRow }>(`/awards/${awardId}/approve`, { method: "POST" });
  },
};
