import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/errors.js";
import type { AppRole } from "../constants/roles.js";
import {
  completePlanningMeeting,
  getPlanningMeeting,
  getPlanningOptions,
  getPreviousAppraisal,
  listEmployeePlanningMeetings,
  listPlanningMeetings,
  reschedulePlanningMeeting,
  respondToPlanningMeeting,
  savePlanningNotes,
  schedulePlanningMeeting,
} from "../services/meeting.service.js";
import type {
  PlanningListQuery,
  PlanningNotesInput,
  ReschedulePlanningMeetingInput,
  RespondPlanningMeetingInput,
  SchedulePlanningMeetingInput,
} from "../validations/meeting.validation.js";

function requireActor(req: Request): { id: string; role: AppRole } {
  if (!req.user?.id || !req.user.role) {
    throw new AppError("Authentication required", 401);
  }
  return { id: req.user.id, role: req.user.role };
}

export async function getPlanningBoard(req: Request, res: Response, next: NextFunction) {
  try {
    const board = await listPlanningMeetings(requireActor(req), req.query as PlanningListQuery);
    res.status(200).json({ success: true, board });
  } catch (error) {
    next(error);
  }
}

export async function getMyPlanningMeetings(req: Request, res: Response, next: NextFunction) {
  try {
    const meetings = await listEmployeePlanningMeetings(requireActor(req));
    res.status(200).json({ success: true, meetings });
  } catch (error) {
    next(error);
  }
}

export async function getPlanningMeetingOptions(req: Request, res: Response, next: NextFunction) {
  try {
    const options = await getPlanningOptions(requireActor(req));
    res.status(200).json({ success: true, options });
  } catch (error) {
    next(error);
  }
}

export async function getPlanningMeetingById(req: Request, res: Response, next: NextFunction) {
  try {
    const payload = await getPlanningMeeting(requireActor(req), req.params.meetingId as string);
    res.status(200).json({ success: true, ...payload });
  } catch (error) {
    next(error);
  }
}

export async function getEmployeePreviousAppraisal(req: Request, res: Response, next: NextFunction) {
  try {
    const payload = await getPreviousAppraisal(requireActor(req), req.params.employeeId as string);
    res.status(200).json({ success: true, ...payload });
  } catch (error) {
    next(error);
  }
}

export async function postSchedulePlanningMeeting(req: Request, res: Response, next: NextFunction) {
  try {
    const meeting = await schedulePlanningMeeting(
      requireActor(req),
      req.body as SchedulePlanningMeetingInput
    );
    res.status(201).json({ success: true, meeting });
  } catch (error) {
    next(error);
  }
}

export async function postReschedulePlanningMeeting(req: Request, res: Response, next: NextFunction) {
  try {
    const meeting = await reschedulePlanningMeeting(
      requireActor(req),
      req.params.meetingId as string,
      req.body as ReschedulePlanningMeetingInput
    );
    res.status(200).json({ success: true, meeting });
  } catch (error) {
    next(error);
  }
}

export async function postRespondPlanningMeeting(req: Request, res: Response, next: NextFunction) {
  try {
    const meeting = await respondToPlanningMeeting(
      requireActor(req),
      req.params.meetingId as string,
      req.body as RespondPlanningMeetingInput
    );
    res.status(200).json({ success: true, meeting });
  } catch (error) {
    next(error);
  }
}

export async function putPlanningNotes(req: Request, res: Response, next: NextFunction) {
  try {
    const payload = await savePlanningNotes(
      requireActor(req),
      req.params.meetingId as string,
      req.body as PlanningNotesInput
    );
    res.status(200).json({ success: true, ...payload });
  } catch (error) {
    next(error);
  }
}

export async function postCompletePlanningMeeting(req: Request, res: Response, next: NextFunction) {
  try {
    const meeting = await completePlanningMeeting(
      requireActor(req),
      req.params.meetingId as string
    );
    res.status(200).json({ success: true, meeting });
  } catch (error) {
    next(error);
  }
}
