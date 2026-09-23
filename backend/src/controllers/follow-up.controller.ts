import type { NextFunction, Request, Response } from "express";
import { Role } from "../../generated/prisma/client.js";
import { AppError } from "../utils/errors.js";
import {
  confirmFollowUp,
  generateFollowUpSchedule,
  getEmployeeFollowUps,
  listFollowUpBoard,
  requestFollowUpReschedule,
  scheduleAdditionalFollowUp,
  supervisorRescheduleFollowUp,
} from "../services/follow-up.service.js";
import type {
  AdditionalFollowUpInput,
  RescheduleFollowUpInput,
  SupervisorRescheduleInput,
} from "../validations/follow-up.validation.js";

function actor(req: Request) {
  if (!req.user) throw new AppError("Authentication required", 401);
  return { id: req.user.id, role: req.user.role as Role };
}

export async function getFollowUpBoard(req: Request, res: Response, next: NextFunction) {
  try {
    const board = await listFollowUpBoard(actor(req));
    res.status(200).json({ success: true, board });
  } catch (error) {
    next(error);
  }
}

export async function getFollowUpSchedule(req: Request, res: Response, next: NextFunction) {
  try {
    const schedule = await getEmployeeFollowUps(actor(req), String(req.params.employeeId));
    res.status(200).json({ success: true, schedule });
  } catch (error) {
    next(error);
  }
}

export async function postGenerateFollowUp(req: Request, res: Response, next: NextFunction) {
  try {
    const schedule = await generateFollowUpSchedule(actor(req), String(req.params.employeeId));
    res.status(200).json({ success: true, schedule });
  } catch (error) {
    next(error);
  }
}

export async function postAdditionalFollowUp(req: Request, res: Response, next: NextFunction) {
  try {
    const schedule = await scheduleAdditionalFollowUp(actor(req), req.body as AdditionalFollowUpInput);
    res.status(201).json({ success: true, schedule });
  } catch (error) {
    next(error);
  }
}

export async function postConfirmFollowUp(req: Request, res: Response, next: NextFunction) {
  try {
    const schedule = await confirmFollowUp(actor(req), String(req.params.meetingId));
    res.status(200).json({ success: true, schedule });
  } catch (error) {
    next(error);
  }
}

export async function postRequestFollowUpReschedule(req: Request, res: Response, next: NextFunction) {
  try {
    const schedule = await requestFollowUpReschedule(
      actor(req),
      String(req.params.meetingId),
      req.body as RescheduleFollowUpInput
    );
    res.status(200).json({ success: true, schedule });
  } catch (error) {
    next(error);
  }
}

export async function postSupervisorRescheduleFollowUp(req: Request, res: Response, next: NextFunction) {
  try {
    const schedule = await supervisorRescheduleFollowUp(
      actor(req),
      String(req.params.meetingId),
      req.body as SupervisorRescheduleInput
    );
    res.status(200).json({ success: true, schedule });
  } catch (error) {
    next(error);
  }
}
