import { apiDownload, apiRequest } from "@/services/api/client";

export interface LeadershipOverview {
  cycle: { id: string; name: string; startDate: string; endDate: string };
  cycles?: Array<{ id: string; name: string; status: string; startDate: string; endDate: string }>;
  kpis: {
    employees: number;
    pdpCompletion: number;
    activePips: number;
    awards: number;
    pdps: number;
    promotions: number;
    followUps: number;
    completedAppraisals?: number;
    awardsGiven?: number;
    totalBonusesAllocated?: number;
    promotionRecommendations?: number;
  };
  progress: { overall: number; completed: number; inProgress: number; notStarted: number };
  departments: Array<{ name: string; employees: number; completion: number }>;
  bands: Array<{ name: string; value: number; percent?: number }>;
  bandDistribution?: Array<{ name: string; value: number; percent: number }>;
  bonusByDepartment?: Array<{ name: string; amount: number }>;
  awardsOverview?: { total: number; categories: Array<{ name: string; value: number }> };
  promotionPipeline?: { recommended: number; underReview: number; approved: number; notApproved: number };
  cycleProgress?: {
    goalSetting: number;
    selfReviews: number;
    managerReviews: number;
    finalEvaluation: number;
    overall: number;
  };
  keyDates?: Array<{ label: string; date: string }>;
  statuses: Array<{ label: string; value: number }>;
  developmentAreas: Array<{ name: string; count: number }>;
  milestones: Array<{ id: string; title: string; employee: string; date: string; status: string }>;
  activity: Array<{ id: string; title: string; detail: string; actor: string; date: string }>;
}

export interface LeadershipReport {
  cycle: { id: string; name: string; startDate?: string; endDate?: string };
  cycles: Array<{ id: string; name: string; status: string; startDate?: string; endDate?: string }>;
  filters: {
    departments: Array<{ id: string; name: string; teams: Array<{ id: string; name: string }> }>;
    employees: Array<{ id: string; name: string; employeeId: string }>;
    bands: string[];
    employeeTypes?: string[];
    reportTypes?: Array<{ value: string; label: string }>;
  };
  summary: {
    employees: number;
    completedAppraisals?: number;
    averageScore: number;
    averagePdp: number;
    pips: number;
    awards: number;
    awardsGiven?: number;
    totalBonusesAllocated?: number;
  };
  preview?: {
    bandDistribution: Array<{ name: string; value: number; percent: number }>;
    bonusByDepartment: Array<{ name: string; amount: number }>;
    awardsByCategory: Array<{ name: string; value: number }>;
  };
  recentReports?: Array<{
    id: string;
    name: string;
    type: string;
    generatedOn: string;
    generatedBy: string;
    status: string;
  }>;
  rows: Array<{
    employee: { id: string; employeeId: string; name: string; department: string; team: string };
    finalScore: number;
    band: string;
    pdpProgress: number;
    pdpStatus: string;
    completedGoals?: number;
    pendingGoals?: number;
    selfReview: string;
    peerReviews: number;
    supervisorReview: string;
    finalEvaluation: string;
    pipStatus: string;
    award: string;
    promotion: string;
  }>;
}

export type LeadershipFilters = {
  departmentId?: string;
  teamId?: string;
  employeeId?: string;
  band?: string;
  cycleId?: string;
  status?: string;
  from?: string;
  to?: string;
  employeeType?: string;
  reportType?: string;
};

function queryString(filters: LeadershipFilters & { format?: string }) {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  const suffix = query.toString();
  return suffix ? `?${suffix}` : "";
}

export const leadershipApi = {
  overview(cycleId?: string) {
    return apiRequest<{ success: true; overview: LeadershipOverview }>(
      `/leadership/overview${cycleId ? `?cycleId=${cycleId}` : ""}`
    );
  },
  reports(filters: LeadershipFilters) {
    return apiRequest<{ success: true; report: LeadershipReport }>(`/leadership/reports${queryString(filters)}`);
  },
  generate(filters: LeadershipFilters) {
    return apiRequest<{ success: true; report: LeadershipReport }>(
      `/leadership/reports/generate${queryString(filters)}`,
      { method: "POST" }
    );
  },
  download(filters: LeadershipFilters, format: "pdf" | "docx") {
    const type = filters.reportType ?? "PERFORMANCE_SUMMARY";
    const filename =
      format === "pdf" ? `performx-${type.toLowerCase()}.pdf` : `performx-${type.toLowerCase()}.docx`;
    return apiDownload(`/leadership/reports${queryString({ ...filters, format })}`, filename);
  },
};
