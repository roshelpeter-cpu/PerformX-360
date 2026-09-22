import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/errors.js";
import type { AppRole } from "../constants/roles.js";
import {
  getManagedEmployeeProfile,
  getOrgHierarchy,
  getSupervisorTeam,
  listEligibleHrStaff,
  listEligibleSupervisors,
  listEligibleTeams,
  reassignEmployee,
  reassignSupervisorHr,
  reassignTeamHr,
  createAccount,
  deactivateEmployeeAccount,
  nextEmployeeId,
} from "../services/employee-management.service.js";
import type {
  CreateAccountInput,
  HierarchyQuery,
  ReassignEmployeeInput,
  ReassignTeamHrInput,
  TeamQuery,
} from "../validations/employee-management.validation.js";
import { Role } from "../../generated/prisma/client.js";

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

export async function getEligibleTeams(req: Request, res: Response, next: NextFunction) {
  try {
    const teams = await listEligibleTeams(
      requireActor(req),
      typeof req.query.departmentId === "string" ? req.query.departmentId : undefined
    );
    res.status(200).json({ success: true, teams });
  } catch (error) {
    next(error);
  }
}

export async function getEligibleHrStaffList(req: Request, res: Response, next: NextFunction) {
  try {
    requireActor(req);
    const hrStaff = await listEligibleHrStaff();
    res.status(200).json({ success: true, hrStaff });
  } catch (error) {
    next(error);
  }
}

export async function postReassignTeamHr(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const body = req.body as ReassignTeamHrInput;
    const result = await reassignTeamHr(
      requireActor(req),
      req.params.teamId as string,
      body.hrEmployeeId,
      body.reason
    );
    res.status(200).json({ success: true, result });
  } catch (error) {
    next(error);
  }
}

export async function postReassignSupervisorHr(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const body = req.body as ReassignTeamHrInput;
    const result = await reassignSupervisorHr(
      requireActor(req),
      req.params.supervisorId as string,
      body.hrEmployeeId,
      body.reason
    );
    res.status(200).json({ success: true, result });
  } catch (error) {
    next(error);
  }
}

export async function postCreateAccount(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const result = await createAccount(requireActor(req), req.body as CreateAccountInput);
    res.status(201).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function getNextEmployeeId(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    requireActor(req);
    const role = req.query.role as Role;
    const employeeId = await nextEmployeeId(role);
    res.status(200).json({ success: true, employeeId });
  } catch (error) {
    next(error);
  }
}

export async function postDeactivateEmployee(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const result = await deactivateEmployeeAccount(
      requireActor(req),
      req.params.employeeId as string
    );
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}
