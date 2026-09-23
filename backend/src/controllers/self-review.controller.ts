import type { NextFunction, Request, Response } from "express";
import { Role } from "../../generated/prisma/client.js";
import { AppError } from "../utils/errors.js";
import {
  addSelfReviewEvidence,
  getEmployeeSelfReview,
  getMySelfReview,
  readSelfReviewEvidence,
  saveSelfReviewDraft,
  submitSelfReview,
} from "../services/self-review.service.js";
import type { SaveSelfReviewInput } from "../validations/self-review.validation.js";

function actor(req: Request) {
  if (!req.user) throw new AppError("Authentication required", 401);
  return { id: req.user.id, role: req.user.role as Role };
}

export async function getMine(req: Request, res: Response, next: NextFunction) {
  try {
    const selfReview = await getMySelfReview(actor(req));
    res.status(200).json({ success: true, selfReview });
  } catch (error) {
    next(error);
  }
}

export async function putDraft(req: Request, res: Response, next: NextFunction) {
  try {
    const body = req.body as SaveSelfReviewInput;
    const selfReview = await saveSelfReviewDraft(actor(req), body);
    res.status(200).json({ success: true, selfReview });
  } catch (error) {
    next(error);
  }
}

export async function postEvidence(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) throw new AppError("Please upload supporting evidence.", 400);
    const selfReview = await addSelfReviewEvidence(
      actor(req),
      String(req.params.questionKey),
      req.file
    );
    res.status(200).json({ success: true, selfReview });
  } catch (error) {
    next(error);
  }
}

export async function postSubmit(req: Request, res: Response, next: NextFunction) {
  try {
    const selfReview = await submitSelfReview(actor(req));
    res.status(200).json({ success: true, selfReview });
  } catch (error) {
    next(error);
  }
}

export async function getForEmployee(req: Request, res: Response, next: NextFunction) {
  try {
    const selfReview = await getEmployeeSelfReview(actor(req), String(req.params.employeeId));
    res.status(200).json({ success: true, selfReview });
  } catch (error) {
    next(error);
  }
}

export async function getEvidenceFile(req: Request, res: Response, next: NextFunction) {
  try {
    const file = await readSelfReviewEvidence(
      actor(req),
      req.user?.id ?? "",
      String(req.params.questionKey),
      String(req.params.storedName)
    );
    res.download(file.fullPath, file.fileName);
  } catch (error) {
    next(error);
  }
}
