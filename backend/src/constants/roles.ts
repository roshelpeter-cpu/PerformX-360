export const ROLES = {
  EMPLOYEE: "EMPLOYEE",
  SUPERVISOR: "SUPERVISOR",
  HR: "HR",
  HR_MANAGER: "HR_MANAGER",
  LEADERSHIP: "LEADERSHIP",
} as const;

export type AppRole = (typeof ROLES)[keyof typeof ROLES];

export const ALL_ROLES: AppRole[] = [
  ROLES.EMPLOYEE,
  ROLES.SUPERVISOR,
  ROLES.HR,
  ROLES.HR_MANAGER,
  ROLES.LEADERSHIP,
];

/** HR staff who can access existing HR appraisal-cycle functionality. */
export const HR_STAFF_ROLES: AppRole[] = [ROLES.HR, ROLES.HR_MANAGER];

export function isHrStaffRole(role: AppRole): boolean {
  return role === ROLES.HR || role === ROLES.HR_MANAGER;
}
