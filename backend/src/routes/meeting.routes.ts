import { Router } from "express";
import { authenticateUser } from "../middlewares/authenticate.js";
import { requireRole } from "../middlewares/requireRole.js";
import { validateBody, validateParams, validateQuery } from "../middlewares/validate.js";
import { ROLES } from "../constants/roles.js";
import {
  getEmployeePreviousAppraisal,
  getMyPlanningMeetings,
  getPlanningBoard,
  getPlanningMeetingById,
  getPlanningMeetingOptions,
  postCompletePlanningMeeting,
  postReschedulePlanningMeeting,
  postRespondPlanningMeeting,
  postSchedulePlanningMeeting,
  putPlanningNotes,
} from "../controllers/meeting.controller.js";
import {
  meetingEmployeeParamSchema,
  meetingIdParamSchema,
  planningListQuerySchema,
  planningNotesSchema,
  reschedulePlanningMeetingSchema,
  respondPlanningMeetingSchema,
  schedulePlanningMeetingSchema,
} from "../validations/meeting.validation.js";

const meetingRouter = Router();
const meetingRoles = [ROLES.EMPLOYEE, ROLES.SUPERVISOR, ROLES.HR, ROLES.HR_MANAGER, ROLES.LEADERSHIP];

meetingRouter.use(authenticateUser);
meetingRouter.use(requireRole(...meetingRoles));

meetingRouter.get("/planning", validateQuery(planningListQuerySchema), getPlanningBoard);
meetingRouter.get("/planning/mine", getMyPlanningMeetings);
meetingRouter.get("/planning/options", getPlanningMeetingOptions);
meetingRouter.get(
  "/planning/employees/:employeeId/previous-appraisal",
  validateParams(meetingEmployeeParamSchema),
  getEmployeePreviousAppraisal
);
meetingRouter.get("/planning/:meetingId", validateParams(meetingIdParamSchema), getPlanningMeetingById);
meetingRouter.post(
  "/planning",
  requireRole(ROLES.SUPERVISOR),
  validateBody(schedulePlanningMeetingSchema),
  postSchedulePlanningMeeting
);
meetingRouter.post(
  "/planning/:meetingId/reschedule",
  requireRole(ROLES.SUPERVISOR),
  validateParams(meetingIdParamSchema),
  validateBody(reschedulePlanningMeetingSchema),
  postReschedulePlanningMeeting
);
meetingRouter.post(
  "/planning/:meetingId/respond",
  validateParams(meetingIdParamSchema),
  validateBody(respondPlanningMeetingSchema),
  postRespondPlanningMeeting
);
meetingRouter.put(
  "/planning/:meetingId/notes",
  requireRole(ROLES.SUPERVISOR),
  validateParams(meetingIdParamSchema),
  validateBody(planningNotesSchema),
  putPlanningNotes
);
meetingRouter.post(
  "/planning/:meetingId/complete",
  requireRole(ROLES.SUPERVISOR),
  validateParams(meetingIdParamSchema),
  postCompletePlanningMeeting
);

export default meetingRouter;
