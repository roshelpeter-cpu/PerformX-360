import { Router } from "express";
import { authenticateUser } from "../middlewares/authenticate.js";
import { requireRole } from "../middlewares/requireRole.js";
import { validateBody, validateParams } from "../middlewares/validate.js";
import { ROLES } from "../constants/roles.js";
import {
  additionalFollowUpSchema,
  followUpEmployeeParamSchema,
  followUpMeetingParamSchema,
  rescheduleFollowUpSchema,
  supervisorRescheduleSchema,
} from "../validations/follow-up.validation.js";
import {
  getFollowUpBoard,
  getFollowUpSchedule,
  postAdditionalFollowUp,
  postConfirmFollowUp,
  postGenerateFollowUp,
  postRequestFollowUpReschedule,
  postSupervisorRescheduleFollowUp,
} from "../controllers/follow-up.controller.js";

const followUpRouter = Router();
const followUpRoles = [ROLES.EMPLOYEE, ROLES.SUPERVISOR, ROLES.HR, ROLES.HR_MANAGER];

followUpRouter.use(authenticateUser);
followUpRouter.use(requireRole(...followUpRoles));

followUpRouter.get("/", getFollowUpBoard);
followUpRouter.get(
  "/employees/:employeeId",
  validateParams(followUpEmployeeParamSchema),
  getFollowUpSchedule
);
followUpRouter.post(
  "/employees/:employeeId/generate",
  requireRole(ROLES.SUPERVISOR),
  validateParams(followUpEmployeeParamSchema),
  postGenerateFollowUp
);
followUpRouter.post(
  "/additional",
  requireRole(ROLES.SUPERVISOR),
  validateBody(additionalFollowUpSchema),
  postAdditionalFollowUp
);
followUpRouter.post(
  "/:meetingId/confirm",
  requireRole(ROLES.EMPLOYEE),
  validateParams(followUpMeetingParamSchema),
  postConfirmFollowUp
);
followUpRouter.post(
  "/:meetingId/reschedule-request",
  requireRole(ROLES.EMPLOYEE),
  validateParams(followUpMeetingParamSchema),
  validateBody(rescheduleFollowUpSchema),
  postRequestFollowUpReschedule
);
followUpRouter.post(
  "/:meetingId/reschedule",
  requireRole(ROLES.SUPERVISOR),
  validateParams(followUpMeetingParamSchema),
  validateBody(supervisorRescheduleSchema),
  postSupervisorRescheduleFollowUp
);

export default followUpRouter;
