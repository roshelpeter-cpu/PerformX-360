/** Session-scoped demo helpers for EMP000904 assigned-PDP gate. Isolated from other accounts. */

export const FROZEN_MY_PDP_EMPLOYEE_IDS = ["EMP000001", "EMP000903"] as const;

export const ACTIVE_DASHBOARD_EMPLOYEE_IDS = ["EMP000901", "EMP000902"] as const;

export const ASSIGNED_GATE_EMPLOYEE_ID = "EMP000904";

const VIEW_ASSIGNED_KEY = "performx:pdp:EMP000904:viewAssigned";

export function isFrozenMyPdpAccount(employeeId: string | undefined | null) {
  return Boolean(employeeId && (FROZEN_MY_PDP_EMPLOYEE_IDS as readonly string[]).includes(employeeId));
}

export function isActiveDashboardAccount(employeeId: string | undefined | null) {
  return Boolean(
    employeeId && (ACTIVE_DASHBOARD_EMPLOYEE_IDS as readonly string[]).includes(employeeId)
  );
}

export function isAssignedGateAccount(employeeId: string | undefined | null) {
  return employeeId === ASSIGNED_GATE_EMPLOYEE_ID;
}

export function hasViewedAssignedPdp904() {
  if (typeof sessionStorage === "undefined") return false;
  return sessionStorage.getItem(VIEW_ASSIGNED_KEY) === "1";
}

export function markAssignedPdp904Viewed() {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(VIEW_ASSIGNED_KEY, "1");
}

/** Clear only the EMP000904 demo gate flag. Safe to call on every logout. */
export function clearAssignedPdp904Session() {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(VIEW_ASSIGNED_KEY);
}
