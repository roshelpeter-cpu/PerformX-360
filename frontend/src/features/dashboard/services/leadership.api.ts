import { apiDownload, apiRequest } from "@/services/api/client";

export interface LeadershipOverview {
  cycle: { id: string; name: string; startDate: string; endDate: string };
  kpis: {
    employees: number;
    pdpCompletion: number;
    activePips: number;
    awards: number;
    pdps: number;
    promotions: number;
    followUps: number;
  };
  progress: { overall: number; completed: number; inProgress: number; notStarted: number };
  departments: Array<{ name: string; employees: number; completion: number }>;
  bands: Array<{ name: string; value: number }>;
  statuses: Array<{ label: string; value: number }>;
  developmentAreas: Array<{ name: string; count: number }>;
  milestones: Array<{ id: string; title: string; employee: string; date: string; status: string }>;
  activity: Array<{ id: string; title: string; detail: string; actor: string; date: string }>;
}

export interface LeadershipReport {
  cycle: { id: string; name: string };
  cycles: Array<{ id: string; name: string; status: string }>;
  filters: {
    departments: Array<{ id: string; name: string; teams: Array<{ id: string; name: string }> }>;
    employees: Array<{ id: string; name: string; employeeId: string }>;
    bands: string[];
  };
  summary: { employees: number; averageScore: number; averagePdp: number; pips: number; awards: number };
  rows: Array<{
    employee: { id: string; employeeId: string; name: string; department: string; team: string };
    finalScore: number;
    band: string;
    pdpProgress: number;
    pdpStatus: string;
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
  overview() {
    return apiRequest<{ success: true; overview: LeadershipOverview }>("/leadership/overview");
  },
  reports(filters: LeadershipFilters) {
    return apiRequest<{ success: true; report: LeadershipReport }>(`/leadership/reports${queryString(filters)}`);
  },
  download(filters: LeadershipFilters, format: "pdf" | "docx") {
    const filename =
      format === "pdf" ? "performx-leadership-report.pdf" : "performx-leadership-report.docx";
    return apiDownload(`/leadership/reports${queryString({ ...filters, format })}`, filename);
  },
};
