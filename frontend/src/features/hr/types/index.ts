export type AppraisalCycleStatus =
  | "DRAFT"
  | "UPCOMING"
  | "ACTIVE"
  | "COMPLETED";

export type StageDisplayStatus = "COMPLETED" | "CURRENT" | "UPCOMING";

export type EmployeeCycleProgressStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "OVERDUE";

export interface EmployeeRef {
  id: string;
  employeeId: string;
  name: string;
}

export interface DepartmentRef {
  id: string;
  name: string;
}

export interface CycleProgressStats {
  totalEmployees: number;
  completed: number;
  inProgress: number;
  overdue: number;
  notStarted: number;
  progressPercent: number;
}

export interface CycleStage {
  id: string;
  key: string;
  title: string;
  startDate: string;
  endDate: string;
  sortOrder: number;
  status: StageDisplayStatus;
}

export interface CycleActivity {
  id: string;
  date: string;
  user: EmployeeRef;
  action: string;
  details: string;
  cycle?: { id: string; name: string };
}

export interface AppraisalCycle {
  id: string;
  name: string;
  description: string | null;
  startDate: string;
  endDate: string;
  year: number;
  status: AppraisalCycleStatus;
  confirmedAt?: string | null;
  activatedAt?: string | null;
  completedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: EmployeeRef;
  stages: CycleStage[];
  currentPhase: CycleStage | null;
  progress: CycleProgressStats;
  employeeCount: number;
  recentActivity: CycleActivity[];
  summary?: {
    totalAssignableEmployees: number;
    completed?: number;
    inProgress?: number;
    overdue?: number;
    assignmentCompletionPercent?: number;
  };
  batches?: unknown[];
}

export interface CreateCyclePayload {
  name: string;
  description?: string | null;
  startDate: string;
  confirm?: boolean;
  stages?: Array<{
    key?: string;
    title?: string;
    startDate: string;
    endDate: string;
  }>;
}

export interface HrGroupSummary {
  id: string;
  label: string;
  employeeId: string;
  name: string;
  teamCount: number;
  employeeCount: number;
}

export interface HrTeamRow {
  id: string;
  name: string;
  department: DepartmentRef | null;
  supervisor: EmployeeRef | null;
  employeeCount: number;
  progressPercent: number;
  status: string;
}

export interface CycleEmployeeRow {
  id: string;
  employeeId: string;
  name: string;
  role: string;
  department: DepartmentRef | null;
  team: { id: string; name: string } | null;
  supervisor: EmployeeRef | null;
  progressPercent: number;
  status: EmployeeCycleProgressStatus | string;
  stageLabel?: string;
}

export interface ActivationReadiness {
  cycle: { id: string; name: string; status: AppraisalCycleStatus };
  canActivate: boolean;
  errors: string[];
  warnings?: string[];
  conflictingActiveCycle: { id: string; name: string } | null;
}
