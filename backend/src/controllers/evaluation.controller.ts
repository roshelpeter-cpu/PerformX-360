import type { NextFunction, Request, Response } from "express";
import { Role } from "../../generated/prisma/client.js";
import { AppError } from "../utils/errors.js";
import {
  approveFinalEvaluation,
  decideSupervisorReview,
  getEvaluationPackage,
  getMyFinalEvaluation,
} from "../services/evaluation.service.js";
import { listFinalEvaluationBoard, listHrPerformanceBoard } from "../services/evaluation-board.service.js";
import type { SupervisorDecisionInput } from "../validations/peer-review.validation.js";

function actor(req: Request) {
  if (!req.user) throw new AppError("Authentication required", 401);
  return { id: req.user.id, role: req.user.role as Role };
}

export async function getPerformanceBoard(req: Request, res: Response, next: NextFunction) {
  try {
    const board = await listHrPerformanceBoard(actor(req));
    res.status(200).json({ success: true, board });
  } catch (error) {
    next(error);
  }
}

export async function getFinalBoard(req: Request, res: Response, next: NextFunction) {
  try {
    const board = await listFinalEvaluationBoard(actor(req));
    res.status(200).json({ success: true, board });
  } catch (error) {
    next(error);
  }
}

export async function getMine(req: Request, res: Response, next: NextFunction) {
  try {
    const evaluation = await getMyFinalEvaluation(actor(req));
    res.status(200).json({ success: true, evaluation });
  } catch (error) {
    next(error);
  }
}

export async function getPackage(req: Request, res: Response, next: NextFunction) {
  try {
    const evaluation = await getEvaluationPackage(actor(req), String(req.params.employeeId));
    res.status(200).json({ success: true, evaluation });
  } catch (error) {
    next(error);
  }
}

export async function postSupervisorDecision(req: Request, res: Response, next: NextFunction) {
  try {
    const body = req.body as SupervisorDecisionInput;
    const result = await decideSupervisorReview(actor(req), String(req.params.employeeId), body);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function postFinalApproval(req: Request, res: Response, next: NextFunction) {
  try {
    const evaluation = await approveFinalEvaluation(actor(req), String(req.params.employeeId));
    res.status(200).json({ success: true, evaluation });
  } catch (error) {
    next(error);
  }
}
