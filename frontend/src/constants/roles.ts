import type { UserRole } from "@/features/auth/types";

export const ROLE_DASHBOARD_PATHS: Record<UserRole, string> = {
  EMPLOYEE: "/employee/dashboard",
  SUPERVISOR: "/supervisor/dashboard",
  HR: "/hr/dashboard",
  HR_MANAGER: "/hr/dashboard",
  LEADERSHIP: "/leadership/dashboard",
};

export const HR_STAFF_ROLES: UserRole[] = ["HR", "HR_MANAGER"];

export function isHrStaffRole(role: UserRole): boolean {
  return role === "HR" || role === "HR_MANAGER";
}

export function getDashboardPathForRole(role: UserRole): string {
  return ROLE_DASHBOARD_PATHS[role];
}

export function getProfilePathForRole(role: UserRole): string {
  switch (role) {
    case "EMPLOYEE":
      return "/employee/profile";
    case "SUPERVISOR":
      return "/supervisor/profile";
    case "HR":
    case "HR_MANAGER":
      return "/hr/profile";
    case "LEADERSHIP":
      return "/leadership/dashboard";
    default:
      return "/";
  }
}

export function getEmployeeManagementPathForRole(role: UserRole): string {
  if (role === "SUPERVISOR") return "/supervisor/employee-management";
  if (role === "HR" || role === "HR_MANAGER") return "/hr/employee-management";
  return "/";
}

export function formatRoleLabel(role: UserRole): string {
  switch (role) {
    case "EMPLOYEE":
      return "Employee";
    case "SUPERVISOR":
      return "Immediate Supervisor";
    case "HR":
      return "HR";
    case "HR_MANAGER":
      return "HR Manager";
    case "LEADERSHIP":
      return "Leadership";
    default:
      return role;
  }
}
