import { Router } from "express";
import { authenticateUser } from "../middlewares/authenticate.js";
import { requireRole } from "../middlewares/requireRole.js";
import { validateBody, validateParams } from "../middlewares/validate.js";
import { ROLES } from "../constants/roles.js";
import { getPackage, postFinalApproval, postSupervisorDecision } from "../controllers/evaluation.controller.js";
import { peerEmployeeParamSchema, supervisorDecisionSchema } from "../validations/peer-review.validation.js";

const evaluationRouter = Router();
evaluationRouter.use(authenticateUser);

evaluationRouter.get(
  "/employees/:employeeId",
  requireRole(ROLES.EMPLOYEE, ROLES.SUPERVISOR, ROLES.HR, ROLES.HR_MANAGER, ROLES.LEADERSHIP),
  validateParams(peerEmployeeParamSchema),
  getPackage
);
evaluationRouter.post(
  "/employees/:employeeId/supervisor-decision",
  requireRole(ROLES.SUPERVISOR),
  validateParams(peerEmployeeParamSchema),
  validateBody(supervisorDecisionSchema),
  postSupervisorDecision
);
evaluationRouter.post(
  "/employees/:employeeId/final-approval",
  requireRole(ROLES.HR),
  validateParams(peerEmployeeParamSchema),
  postFinalApproval
);

export default evaluationRouter;
