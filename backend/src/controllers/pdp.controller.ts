import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/errors.js";
import type { AppRole } from "../constants/roles.js";
import { evidenceFilePath } from "../lib/uploads.js";
import {
  addActivePdpGoal,
  addActivePdpSubGoal,
  approveSubGoalCompletion,
  assignPdp,
  activatePdp,
  createPdp,
  employeeApprove,
  employeeRequestChanges,
  getPdp,
  getPdpByEmployeeId,
  getPdpOptions,
  getPdpVersion,
  hrApprove,
  hrDecision,
  hrRequestChanges,
  listMyPdps,
  listPendingSubGoalApprovals,
  listPdpVersions,
  listPdps,
  requestSubGoalChanges,
  sendForApproval,
  supervisorCannotChange,
  updatePdp,
  updateSubGoalProgress,
} from "../services/pdp.service.js";
import type {
  AddActiveGoalInput,
  AddActiveSubGoalInput,
  ApproveSubGoalInput,
  CreatePdpInput,
  HrDecisionInput,
  PdpListQuery,
  RequestChangesInput,
  SupervisorCannotChangeInput,
  UpdatePdpInput,
  UpdateSubGoalInput,
} from "../validations/pdp.validation.js";
import { prisma } from "../lib/prisma.js";
import fs from "node:fs";

function requireActor(req: Request): { id: string; role: AppRole } {
  if (!req.user?.id || !req.user.role) {
    throw new AppError("Authentication required", 401);
  }
  return { id: req.user.id, role: req.user.role };
}

export async function getPdpBoard(req: Request, res: Response, next: NextFunction) {
  try {
    const board = await listPdps(requireActor(req), req.query as PdpListQuery);
    res.status(200).json({ success: true, board });
  } catch (error) {
    next(error);
  }
}

export async function getMyPdps(req: Request, res: Response, next: NextFunction) {
  try {
    const payload = await listMyPdps(requireActor(req));
    res.status(200).json({ success: true, ...payload });
  } catch (error) {
    next(error);
  }
}

export async function getPdpCreateOptions(req: Request, res: Response, next: NextFunction) {
  try {
    const options = await getPdpOptions(requireActor(req));
    res.status(200).json({ success: true, options });
  } catch (error) {
    next(error);
  }
}

export async function getPdpById(req: Request, res: Response, next: NextFunction) {
  try {
    const payload = await getPdp(requireActor(req), req.params.pdpId as string);
    res.status(200).json({ success: true, ...payload });
  } catch (error) {
    next(error);
  }
}

export async function postCreatePdp(req: Request, res: Response, next: NextFunction) {
  try {
    const pdp = await createPdp(requireActor(req), req.body as CreatePdpInput);
    res.status(201).json({ success: true, pdp });
  } catch (error) {
    next(error);
  }
}

export async function putUpdatePdp(req: Request, res: Response, next: NextFunction) {
  try {
    const pdp = await updatePdp(
      requireActor(req),
      req.params.pdpId as string,
      req.body as UpdatePdpInput
    );
    res.status(200).json({ success: true, pdp });
  } catch (error) {
    next(error);
  }
}

export async function postSendForApproval(req: Request, res: Response, next: NextFunction) {
  try {
    const pdp = await sendForApproval(requireActor(req), req.params.pdpId as string);
    res.status(200).json({ success: true, pdp });
  } catch (error) {
    next(error);
  }
}

export async function postEmployeeApprove(req: Request, res: Response, next: NextFunction) {
  try {
    const pdp = await employeeApprove(requireActor(req), req.params.pdpId as string);
    res.status(200).json({ success: true, pdp });
  } catch (error) {
    next(error);
  }
}

export async function postEmployeeRequestChanges(req: Request, res: Response, next: NextFunction) {
  try {
    const pdp = await employeeRequestChanges(
      requireActor(req),
      req.params.pdpId as string,
      req.body as RequestChangesInput
    );
    res.status(200).json({ success: true, pdp });
  } catch (error) {
    next(error);
  }
}

export async function postHrApprove(req: Request, res: Response, next: NextFunction) {
  try {
    const pdp = await hrApprove(requireActor(req), req.params.pdpId as string);
    res.status(200).json({ success: true, pdp });
  } catch (error) {
    next(error);
  }
}

export async function postHrRequestChanges(req: Request, res: Response, next: NextFunction) {
  try {
    const pdp = await hrRequestChanges(
      requireActor(req),
      req.params.pdpId as string,
      req.body as RequestChangesInput
    );
    res.status(200).json({ success: true, pdp });
  } catch (error) {
    next(error);
  }
}

export async function postSupervisorCannotChange(req: Request, res: Response, next: NextFunction) {
  try {
    const pdp = await supervisorCannotChange(
      requireActor(req),
      req.params.pdpId as string,
      req.body as SupervisorCannotChangeInput
    );
    res.status(200).json({ success: true, pdp });
  } catch (error) {
    next(error);
  }
}

export async function postHrDecision(req: Request, res: Response, next: NextFunction) {
  try {
    const pdp = await hrDecision(
      requireActor(req),
      req.params.pdpId as string,
      req.body as HrDecisionInput
    );
    res.status(200).json({ success: true, pdp });
  } catch (error) {
    next(error);
  }
}

export async function postAssignPdp(req: Request, res: Response, next: NextFunction) {
  try {
    const pdp = await assignPdp(requireActor(req), req.params.pdpId as string);
    res.status(200).json({ success: true, pdp });
  } catch (error) {
    next(error);
  }
}

export async function postActivatePdp(req: Request, res: Response, next: NextFunction) {
  try {
    const pdp = await activatePdp(requireActor(req), req.params.pdpId as string);
    res.status(200).json({ success: true, pdp });
  } catch (error) {
    next(error);
  }
}

export async function getPdpVersions(req: Request, res: Response, next: NextFunction) {
  try {
    const payload = await listPdpVersions(requireActor(req), req.params.pdpId as string);
    res.status(200).json({ success: true, ...payload });
  } catch (error) {
    next(error);
  }
}

export async function getPdpVersionByNumber(req: Request, res: Response, next: NextFunction) {
  try {
    const versionNumber = Number(req.params.versionNumber);
    const payload = await getPdpVersion(
      requireActor(req),
      req.params.pdpId as string,
      versionNumber
    );
    res.status(200).json({ success: true, ...payload });
  } catch (error) {
    next(error);
  }
}

export async function getPdpForEmployee(req: Request, res: Response, next: NextFunction) {
  try {
    const payload = await getPdpByEmployeeId(
      requireActor(req),
      req.params.employeeId as string
    );
    res.status(200).json({ success: true, ...payload });
  } catch (error) {
    next(error);
  }
}

export async function getPendingSubGoalApprovals(req: Request, res: Response, next: NextFunction) {
  try {
    const items = await listPendingSubGoalApprovals(requireActor(req));
    res.status(200).json({ success: true, items });
  } catch (error) {
    next(error);
  }
}

export async function patchSubGoal(req: Request, res: Response, next: NextFunction) {
  try {
    const body = req.body as UpdateSubGoalInput;
    const pdp = await updateSubGoalProgress(
      requireActor(req),
      req.params.pdpId as string,
      req.params.subGoalId as string,
      {
        ...(body.status ? { status: body.status } : {}),
        ...(body.comment !== undefined ? { comment: body.comment } : {}),
        ...(body.markComplete ? { markComplete: true } : {}),
      },
      req.file ?? null
    );
    res.status(200).json({ success: true, pdp });
  } catch (error) {
    next(error);
  }
}

export async function postApproveSubGoal(req: Request, res: Response, next: NextFunction) {
  try {
    const body = req.body as ApproveSubGoalInput;
    const pdp = await approveSubGoalCompletion(
      requireActor(req),
      req.params.pdpId as string,
      req.params.subGoalId as string,
      body.comment !== undefined ? { comment: body.comment } : undefined
    );
    res.status(200).json({ success: true, pdp });
  } catch (error) {
    next(error);
  }
}

export async function postRequestSubGoalChanges(req: Request, res: Response, next: NextFunction) {
  try {
    const pdp = await requestSubGoalChanges(
      requireActor(req),
      req.params.pdpId as string,
      req.params.subGoalId as string,
      (req.body as RequestChangesInput).reason
    );
    res.status(200).json({ success: true, pdp });
  } catch (error) {
    next(error);
  }
}

export async function postAddActiveGoal(req: Request, res: Response, next: NextFunction) {
  try {
    const body = req.body as AddActiveGoalInput;
    const pdp = await addActivePdpGoal(requireActor(req), req.params.pdpId as string, {
      title: body.title,
      ...(body.objective !== undefined ? { objective: body.objective } : {}),
      ...(body.expectedOutcome !== undefined ? { expectedOutcome: body.expectedOutcome } : {}),
      ...(body.successCriteria !== undefined ? { successCriteria: body.successCriteria } : {}),
      ...(body.category !== undefined ? { category: body.category } : {}),
      ...(body.subGoals
        ? {
            subGoals: body.subGoals.map((sub) => ({
              title: sub.title,
              ...(sub.description !== undefined ? { description: sub.description } : {}),
              ...(sub.dueDate !== undefined ? { dueDate: sub.dueDate } : {}),
              ...(sub.expectedOutcome !== undefined
                ? { expectedOutcome: sub.expectedOutcome }
                : {}),
              ...(sub.successCriteria !== undefined
                ? { successCriteria: sub.successCriteria }
                : {}),
            })),
          }
        : {}),
    });
    res.status(201).json({ success: true, pdp });
  } catch (error) {
    next(error);
  }
}

export async function postAddActiveSubGoal(req: Request, res: Response, next: NextFunction) {
  try {
    const body = req.body as AddActiveSubGoalInput;
    const pdp = await addActivePdpSubGoal(
      requireActor(req),
      req.params.pdpId as string,
      req.params.goalId as string,
      {
        title: body.title,
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.dueDate !== undefined ? { dueDate: body.dueDate } : {}),
        ...(body.expectedOutcome !== undefined ? { expectedOutcome: body.expectedOutcome } : {}),
        ...(body.successCriteria !== undefined ? { successCriteria: body.successCriteria } : {}),
      }
    );
    res.status(201).json({ success: true, pdp });
  } catch (error) {
    next(error);
  }
}

export async function getSubGoalEvidenceFile(req: Request, res: Response, next: NextFunction) {
  try {
    const storedName = String(req.params.storedName ?? "");
    if (!/^[\w.\-]+$/.test(storedName)) {
      throw new AppError("Invalid evidence filename", 400);
    }
    const subGoal = await prisma.pdpSubGoal.findUnique({
      where: { id: req.params.subGoalId as string },
      include: { goal: { include: { pdp: true } } },
    });
    if (!subGoal || subGoal.goal.pdpId !== req.params.pdpId) {
      throw new AppError("Evidence not found", 404);
    }
    await getPdp(requireActor(req), subGoal.goal.pdpId);

    const files = Array.isArray(subGoal.evidenceFiles) ? subGoal.evidenceFiles : [];
    const match = files.find(
      (item) =>
        item &&
        typeof item === "object" &&
        "storedName" in item &&
        String((item as { storedName: string }).storedName) === storedName
    ) as { fileName?: string; storedName: string } | undefined;

    const fullPath = evidenceFilePath(storedName);
    if (!fs.existsSync(fullPath)) {
      throw new AppError("Evidence file is not available on disk", 404);
    }
    res.download(fullPath, match?.fileName ?? storedName);
  } catch (error) {
    next(error);
  }
}
