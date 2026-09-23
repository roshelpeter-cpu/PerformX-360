import { apiRequest } from "@/services/api/client";

export interface PipBoardRow {
  employee: {
    id: string;
    employeeId: string;
    name: string;
    department: string;
    team: string;
    supervisor: string;
  };
  finalScore: number;
  performanceBand: string;
  currentPdp: string;
  currentPdpStatus: string;
  appraisalStatus: string;
  pipId: string | null;
  pipStatus: string;
  pipRawStatus: string | null;
  createdAt: string | null;
}

export const pipApi = {
  getBoard() {
    return apiRequest<{ success: true; board: { cycle: { id: string; name: string }; items: PipBoardRow[] } }>(
      "/pips"
    );
  },
};
