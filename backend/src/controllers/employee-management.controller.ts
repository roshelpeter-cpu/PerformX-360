import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/errors.js";
import type { AppRole } from "../constants/roles.js";
import {
  getManagedEmployeeProfile,
  getOrgHierarchy,
  getSupervisorTeam,
  listEligibleSupervisors,
  reassignEmployee,
} from "../services/employee-management.service.js";
import type {
  HierarchyQuery,
  ReassignEmployeeInput,
  TeamQuery,
} from "../validations/employee-management.validation.js";

function requireActor(req: Request): { id: string; role: AppRole } {
  if (!req.user?.id || !req.user.role) {
    throw new AppError("Authentication required", 401);
  }
  return { id: req.user.id, role: req.user.role };
}

export async function getMyTeam(req: Request, res: Response, next: NextFunction) {
  try {
    const team = await getSupervisorTeam(requireActor(req), req.query as TeamQuery);
    res.status(200).json({ success: true, team });
  } catch (error) {
    next(error);
  }
}

export async function getHierarchy(req: Request, res: Response, next: NextFunction) {
  try {
    const hierarchy = await getOrgHierarchy(
      requireActor(req),
      req.query as HierarchyQuery
    );
    res.status(200).json({ success: true, hierarchy });
  } catch (error) {
    next(error);
  }
}

export async function getEmployeeProfile(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const profile = await getManagedEmployeeProfile(
      requireActor(req),
      req.params.employeeId as string
    );
    res.status(200).json({ success: true, profile });
  } catch (error) {
    next(error);
  }
}

export async function getEligibleSupervisorsForEmployee(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const supervisors = await listEligibleSupervisors(
      requireActor(req),
      req.params.employeeId as string
    );
    res.status(200).json({ success: true, supervisors });
  } catch (error) {
    next(error);
  }
}

export async function postReassignEmployee(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const profile = await reassignEmployee(
      requireActor(req),
      req.params.employeeId as string,
      req.body as ReassignEmployeeInput
    );
    res.status(200).json({ success: true, profile });
  } catch (error) {
    next(error);
  }
}
