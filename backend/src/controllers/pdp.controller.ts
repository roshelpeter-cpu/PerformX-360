import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/errors.js";
import type { AppRole } from "../constants/roles.js";
import {
  assignPdp,
  createPdp,
  employeeApprove,
  employeeRequestChanges,
  getPdp,
  getPdpOptions,
  getPdpVersion,
  hrApprove,
  hrDecision,
  hrRequestChanges,
  listMyPdps,
  listPdpVersions,
  listPdps,
  sendForApproval,
  supervisorCannotChange,
  updatePdp,
} from "../services/pdp.service.js";
import type {
  CreatePdpInput,
  HrDecisionInput,
  PdpListQuery,
  RequestChangesInput,
  SupervisorCannotChangeInput,
  UpdatePdpInput,
} from "../validations/pdp.validation.js";

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
