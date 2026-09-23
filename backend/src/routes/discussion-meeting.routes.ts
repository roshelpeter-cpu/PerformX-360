import { Router } from "express";
import { authenticateUser } from "../middlewares/authenticate.js";
import { requireRole } from "../middlewares/requireRole.js";
import { validateBody, validateParams } from "../middlewares/validate.js";
import { ROLES } from "../constants/roles.js";
import {
  getDiscussionMeetingOptions,
  getDiscussions,
  postDiscussion,
  postDiscussionReschedule,
  postDiscussionRespond,
} from "../controllers/discussion-meeting.controller.js";
import {
  discussionIdParamSchema,
  discussionRescheduleSchema,
  discussionRespondSchema,
  scheduleDiscussionSchema,
} from "../validations/discussion-meeting.validation.js";

const discussionRouter = Router();
discussionRouter.use(authenticateUser);
discussionRouter.use(requireRole(ROLES.EMPLOYEE, ROLES.SUPERVISOR, ROLES.HR, ROLES.HR_MANAGER));

discussionRouter.get("/", getDiscussions);
discussionRouter.get("/options", requireRole(ROLES.SUPERVISOR), getDiscussionMeetingOptions);
discussionRouter.post("/", requireRole(ROLES.SUPERVISOR), validateBody(scheduleDiscussionSchema), postDiscussion);
discussionRouter.post(
  "/:meetingId/respond",
  validateParams(discussionIdParamSchema),
  validateBody(discussionRespondSchema),
  postDiscussionRespond
);
discussionRouter.post(
  "/:meetingId/reschedule",
  requireRole(ROLES.SUPERVISOR),
  validateParams(discussionIdParamSchema),
  validateBody(discussionRescheduleSchema),
  postDiscussionReschedule
);

export default discussionRouter;
