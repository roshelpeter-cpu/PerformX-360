// Appraisal Cycle Controller
// Organization-wide cycle lifecycle, HR groups, employees, and activity.

import fs from "node:fs";
import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/errors.js";
import { evidenceFilePath } from "../lib/uploads.js";
import {
  activateAppraisalCycle,
  completeAppraisalCycle,
  confirmAppraisalCycle,
  createAppraisalCycle,
  deleteDraftAppraisalCycle,
  getActivationReadiness,
  getAppraisalCycleById,
  getCurrentAppraisalCycle,
  getWorkforceSummary,
  listAppraisalCycles,
  listCycleEmployeesOrg,
  listCycleHrGroups,
  listDepartments,
  listHistoricalCycles,
  listHrGroupTeams,
  listRecentCycleActivities,
  reassignHrTeam,
  updateAppraisalCycle,
} from "../services/org-appraisal-cycle.service.js";
import {
  getBatchDetail,
  startBatchStage,
  updateAppraisalBatch,
} from "../services/appraisal-cycle.service.js";
import {
  getSupervisorDetail,
  listCycleSupervisors,
} from "../services/appraisal-assignment.service.js";
import type {
  CreateCycleInput,
  CycleListQuery,
  EmployeeAssignmentQuery,
  ReassignHrInput,
  SupervisorQuery,
  UpdateBatchInput,
  UpdateCycleInput,
} from "../validations/appraisal-cycle.validation.js";

function requireUserId(req: Request): string {
  if (!req.user?.id) {
    throw new AppError("Authentication required", 401);
  }
  return req.user.id;
}

export async function listCycles(req: Request, res: Response, next: NextFunction) {
  try {
    const cycles = await listAppraisalCycles(
      req.query as unknown as CycleListQuery
    );
    res.status(200).json({ success: true, cycles });
  } catch (error) {
    next(error);
  }
}

export async function getCurrentCycle(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const cycle = await getCurrentAppraisalCycle();
    res.status(200).json({ success: true, cycle });
  } catch (error) {
    next(error);
  }
}

export async function getHistoryCycles(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const cycles = await listHistoricalCycles();
    res.status(200).json({ success: true, cycles });
  } catch (error) {
    next(error);
  }
}

export async function getWorkforce(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const workforce = await getWorkforceSummary();
    res.status(200).json({ success: true, workforce });
  } catch (error) {
    next(error);
  }
}

export async function getRecentActivity(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const activities = await listRecentCycleActivities(20);
    res.status(200).json({ success: true, activities });
  } catch (error) {
    next(error);
  }
}

export async function getCycle(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as { id: string };
    const cycle = await getAppraisalCycleById(id);
    res.status(200).json({ success: true, cycle });
  } catch (error) {
    next(error);
  }
}

export async function createCycle(req: Request, res: Response, next: NextFunction) {
  try {
    const createdById = requireUserId(req);
    const cycle = await createAppraisalCycle(
      req.body as CreateCycleInput,
      createdById
    );
    res.status(201).json({ success: true, cycle });
  } catch (error) {
    next(error);
  }
}

export async function updateCycle(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as { id: string };
    const cycle = await updateAppraisalCycle(
      id,
      req.body as UpdateCycleInput,
      requireUserId(req)
    );
    res.status(200).json({ success: true, cycle });
  } catch (error) {
    next(error);
  }
}

export async function confirmCycle(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as { id: string };
    const cycle = await confirmAppraisalCycle(id, requireUserId(req));
    res.status(200).json({ success: true, cycle });
  } catch (error) {
    next(error);
  }
}

export async function getActivationPreview(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params as { id: string };
    const readiness = await getActivationReadiness(id);
    res.status(200).json({ success: true, readiness });
  } catch (error) {
    next(error);
  }
}

export async function activateCycle(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params as { id: string };
    const cycle = await activateAppraisalCycle(id, requireUserId(req));
    res.status(200).json({ success: true, cycle });
  } catch (error) {
    next(error);
  }
}

export async function completeCycle(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params as { id: string };
    const cycle = await completeAppraisalCycle(id, requireUserId(req));
    res.status(200).json({ success: true, cycle });
  } catch (error) {
    next(error);
  }
}

export async function deleteCycle(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params as { id: string };
    const result = await deleteDraftAppraisalCycle(id);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function getHrGroups(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as { id: string };
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const groups = await listCycleHrGroups(id, search);
    res.status(200).json({ success: true, groups });
  } catch (error) {
    next(error);
  }
}

export async function getHrGroupDetail(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id, hrEmployeeId } = req.params as {
      id: string;
      hrEmployeeId: string;
    };
    const detail = await listHrGroupTeams(id, hrEmployeeId);
    res.status(200).json({ success: true, ...detail });
  } catch (error) {
    next(error);
  }
}

export async function reassignHr(req: Request, res: Response, next: NextFunction) {
  try {
    const { id, teamId } = req.params as { id: string; teamId: string };
    const body = req.body as ReassignHrInput;
    const detail = await reassignHrTeam(
      id,
      teamId,
      body.newHrEmployeeId,
      requireUserId(req),
      body.reason ?? undefined
    );
    res.status(200).json({ success: true, ...detail });
  } catch (error) {
    next(error);
  }
}

export async function getOrgCycleEmployees(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params as { id: string };
    const query = req.query as unknown as EmployeeAssignmentQuery;
    const result = await listCycleEmployeesOrg(id, {
      ...(query.search ? { search: query.search } : {}),
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.page !== undefined ? { page: query.page } : {}),
      ...(query.pageSize !== undefined ? { pageSize: query.pageSize } : {}),
    });
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function updateBatch(req: Request, res: Response, next: NextFunction) {
  try {
    const { id, batchId } = req.params as { id: string; batchId: string };
    const batch = await updateAppraisalBatch(
      id,
      batchId,
      req.body as UpdateBatchInput
    );
    res.status(200).json({ success: true, batch });
  } catch (error) {
    next(error);
  }
}

export async function getBatch(req: Request, res: Response, next: NextFunction) {
  try {
    const { id, batchId } = req.params as { id: string; batchId: string };
    const batch = await getBatchDetail(id, batchId);
    res.status(200).json({ success: true, batch });
  } catch (error) {
    next(error);
  }
}

export async function startBatch(req: Request, res: Response, next: NextFunction) {
  try {
    const { id, batchId } = req.params as { id: string; batchId: string };
    const { stage } = req.body as { stage: string };
    const cycle = await startBatchStage(id, batchId, stage as never);
    res.status(200).json({ success: true, cycle });
  } catch (error) {
    next(error);
  }
}

export async function getCycleEmployees(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params as { id: string };
    // Prefer organization-wide employee listing.
    const query = req.query as unknown as EmployeeAssignmentQuery;
    const result = await listCycleEmployeesOrg(id, {
      ...(query.search ? { search: query.search } : {}),
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.page !== undefined ? { page: query.page } : {}),
      ...(query.pageSize !== undefined ? { pageSize: query.pageSize } : {}),
    });
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function changeBatch(req: Request, res: Response, next: NextFunction) {
  try {
    throw new AppError(
      "Employee reassignment is not available inside Appraisal Cycles.",
      400,
      "REASSIGNMENT_DISABLED"
    );
  } catch (error) {
    next(error);
  }
}

export async function changeSupervisor(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    throw new AppError(
      "Employee reassignment is not available inside Appraisal Cycles.",
      400,
      "REASSIGNMENT_DISABLED"
    );
  } catch (error) {
    next(error);
  }
}

export async function getEligibleSupervisors(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    res.status(200).json({ success: true, supervisors: [] });
  } catch (error) {
    next(error);
  }
}

export async function getSupervisors(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params as { id: string };
    const result = await listCycleSupervisors(
      id,
      req.query as unknown as SupervisorQuery
    );
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function getSupervisor(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id, supervisorId } = req.params as {
      id: string;
      supervisorId: string;
    };
    const result = await getSupervisorDetail(id, supervisorId);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function getHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as { id: string };
    const cycle = await getAppraisalCycleById(id);
    res.status(200).json({
      success: true,
      entries: cycle.recentActivity.map((item) => ({
        id: item.id,
        changedAt: item.date,
        changeType: "CYCLE",
        employee: { id: "", employeeId: "", name: "—" },
        previousLabel: "—",
        newLabel: "—",
        reason: item.details,
        changedBy: item.user,
        evidence: null,
        evidenceName: null,
      })),
      total: cycle.recentActivity.length,
      page: 1,
      pageSize: cycle.recentActivity.length,
      totalPages: 1,
    });
  } catch (error) {
    next(error);
  }
}

export async function getDepartments(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const departments = await listDepartments();
    res.status(200).json({ success: true, departments });
  } catch (error) {
    next(error);
  }
}

export async function downloadEvidence(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { filename } = req.params as { filename: string };
    const path = evidenceFilePath(filename);
    if (!fs.existsSync(path)) {
      throw new AppError("Evidence file not found", 404);
    }
    res.download(path, filename);
  } catch (error) {
    next(error);
  }
}
