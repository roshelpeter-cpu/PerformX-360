import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/errors.js";
import type { AppRole } from "../constants/roles.js";
import { evidenceFilePath } from "../lib/uploads.js";
import {
  getEvidenceFile,
  getProfileChangeRequest,
  listInbox,
  reviewProfileChangeRequest,
  submitProfileChangeRequest,
} from "../services/profile-request.service.js";
import type { ProfileChangeRequestInput } from "../validations/employee-management.validation.js";
import type { ProfileChangeRequestType } from "../../generated/prisma/client.js";

function requireActor(req: Request): { id: string; role: AppRole } {
  if (!req.user?.id || !req.user.role) {
    throw new AppError("Authentication required", 401);
  }
  return { id: req.user.id, role: req.user.role };
}

export async function postProfileChangeRequest(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const body = req.body as ProfileChangeRequestInput;
    const file = req.file;
    const request = await submitProfileChangeRequest(
      requireActor(req),
      {
        ...(body.summary ? { summary: body.summary } : {}),
        requestType: body.requestType as ProfileChangeRequestType,
        currentValue: body.currentValue,
        requestedValue: body.requestedValue,
        reason: body.reason,
      },
      file
        ? {
            filename: file.filename,
            originalName: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
          }
        : undefined
    );
    res.status(201).json({ success: true, request });
  } catch (error) {
    next(error);
  }
}

export async function getProfileChangeInbox(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const requests = await listInbox(requireActor(req), status);
    res.status(200).json({ success: true, requests });
  } catch (error) {
    next(error);
  }
}

export async function getProfileChangeRequestById(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const request = await getProfileChangeRequest(
      requireActor(req),
      req.params.requestId as string
    );
    res.status(200).json({ success: true, request });
  } catch (error) {
    next(error);
  }
}

export async function postReviewProfileChangeRequest(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const request = await reviewProfileChangeRequest(
      requireActor(req),
      req.params.requestId as string,
      req.body.decision
    );
    res.status(200).json({ success: true, request });
  } catch (error) {
    next(error);
  }
}

export async function downloadProfileChangeEvidence(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const file = await getEvidenceFile(requireActor(req), req.params.requestId as string);
    res.download(evidenceFilePath(file.filename), file.originalName);
  } catch (error) {
    next(error);
  }
}
