import type { NextFunction, Request, Response } from "express";
import { Role } from "../../generated/prisma/client.js";
import { AppError } from "../utils/errors.js";
import {
  getDiscussionOptions,
  listDiscussionMeetings,
  rescheduleDiscussionMeeting,
  respondToDiscussionMeeting,
  scheduleDiscussionMeeting,
} from "../services/discussion-meeting.service.js";

function actor(req: Request) {
  if (!req.user) throw new AppError("Authentication required", 401);
  return { id: req.user.id, role: req.user.role as Role };
}

export async function getDiscussions(req: Request, res: Response, next: NextFunction) {
  try {
    const meetings = await listDiscussionMeetings(actor(req));
    res.status(200).json({ success: true, meetings });
  } catch (error) {
    next(error);
  }
}

export async function getDiscussionMeetingOptions(req: Request, res: Response, next: NextFunction) {
  try {
    const options = await getDiscussionOptions(actor(req));
    res.status(200).json({ success: true, options });
  } catch (error) {
    next(error);
  }
}

export async function postDiscussion(req: Request, res: Response, next: NextFunction) {
  try {
    const meeting = await scheduleDiscussionMeeting(actor(req), req.body);
    res.status(201).json({ success: true, meeting });
  } catch (error) {
    next(error);
  }
}

export async function postDiscussionRespond(req: Request, res: Response, next: NextFunction) {
  try {
    const meeting = await respondToDiscussionMeeting(actor(req), String(req.params.meetingId), req.body);
    res.status(200).json({ success: true, meeting });
  } catch (error) {
    next(error);
  }
}

export async function postDiscussionReschedule(req: Request, res: Response, next: NextFunction) {
  try {
    const meeting = await rescheduleDiscussionMeeting(actor(req), String(req.params.meetingId), req.body);
    res.status(200).json({ success: true, meeting });
  } catch (error) {
    next(error);
  }
}
