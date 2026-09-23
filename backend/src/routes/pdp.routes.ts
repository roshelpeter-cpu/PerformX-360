import { Router } from "express";
import { authenticateUser } from "../middlewares/authenticate.js";
import { requireRole } from "../middlewares/requireRole.js";
import { validateBody, validateParams, validateQuery } from "../middlewares/validate.js";
import { optionalMultipartEvidence } from "../middlewares/upload.js";
import { ROLES } from "../constants/roles.js";
import {
  getMyPdps,
  getPdpBoard,
  getPdpById,
  getPdpCreateOptions,
  getPdpForEmployee,
  getPdpVersionByNumber,
  getPdpVersions,
  getPendingSubGoalApprovals,
  getEvaluationOverview,
  getSubGoalEvidenceFile,
  patchSubGoal,
  postAddActiveGoal,
  postAddActiveSubGoal,
  postApproveSubGoal,
  postAssignPdp,
  postActivatePdp,
  postCreatePdp,
  postEmployeeApprove,
  postEmployeeRequestChanges,
  postHrApprove,
  postHrDecision,
  postHrRequestChanges,
  postRequestSubGoalChanges,
  postSendForApproval,
  postSupervisorCannotChange,
  putUpdatePdp,
} from "../controllers/pdp.controller.js";
import {
  addActiveGoalSchema,
  addActiveSubGoalSchema,
  approveSubGoalSchema,
  createPdpSchema,
  hrDecisionSchema,
  pdpEmployeeIdParamSchema,
  pdpGoalParamSchema,
  pdpIdParamSchema,
  pdpListQuerySchema,
  pdpSubGoalParamSchema,
  pdpVersionParamSchema,
  pdpEvidenceParamSchema,
  requestChangesSchema,
  supervisorCannotChangeSchema,
  updatePdpSchema,
  updateSubGoalSchema,
} from "../validations/pdp.validation.js";

const pdpRouter = Router();
const pdpRoles = [ROLES.EMPLOYEE, ROLES.SUPERVISOR, ROLES.HR, ROLES.HR_MANAGER, ROLES.LEADERSHIP];

pdpRouter.use(authenticateUser);
pdpRouter.use(requireRole(...pdpRoles));

pdpRouter.get("/", validateQuery(pdpListQuerySchema), getPdpBoard);
pdpRouter.get("/mine", getMyPdps);
pdpRouter.get(
  "/options",
  requireRole(ROLES.SUPERVISOR, ROLES.HR, ROLES.HR_MANAGER, ROLES.LEADERSHIP),
  getPdpCreateOptions
);
pdpRouter.get(
  "/pending-approvals",
  requireRole(ROLES.SUPERVISOR, ROLES.HR, ROLES.HR_MANAGER),
  getPendingSubGoalApprovals
);
pdpRouter.get(
  "/evaluation-overview",
  requireRole(ROLES.HR_MANAGER),
  getEvaluationOverview
);
pdpRouter.get(
  "/by-employee/:employeeId",
  requireRole(ROLES.SUPERVISOR, ROLES.HR, ROLES.HR_MANAGER, ROLES.LEADERSHIP),
  validateParams(pdpEmployeeIdParamSchema),
  getPdpForEmployee
);

pdpRouter.post("/", requireRole(ROLES.SUPERVISOR), validateBody(createPdpSchema), postCreatePdp);

pdpRouter.get("/:pdpId", validateParams(pdpIdParamSchema), getPdpById);
pdpRouter.put(
  "/:pdpId",
  requireRole(ROLES.SUPERVISOR),
  validateParams(pdpIdParamSchema),
  validateBody(updatePdpSchema),
  putUpdatePdp
);

pdpRouter.post(
  "/:pdpId/send-for-approval",
  requireRole(ROLES.SUPERVISOR),
  validateParams(pdpIdParamSchema),
  postSendForApproval
);

pdpRouter.post(
  "/:pdpId/employee/approve",
  requireRole(ROLES.EMPLOYEE),
  validateParams(pdpIdParamSchema),
  postEmployeeApprove
);
pdpRouter.post(
  "/:pdpId/employee/request-changes",
  requireRole(ROLES.EMPLOYEE),
  validateParams(pdpIdParamSchema),
  validateBody(requestChangesSchema),
  postEmployeeRequestChanges
);

pdpRouter.post(
  "/:pdpId/hr/approve",
  requireRole(ROLES.HR, ROLES.HR_MANAGER),
  validateParams(pdpIdParamSchema),
  postHrApprove
);
pdpRouter.post(
  "/:pdpId/hr/request-changes",
  requireRole(ROLES.HR, ROLES.HR_MANAGER),
  validateParams(pdpIdParamSchema),
  validateBody(requestChangesSchema),
  postHrRequestChanges
);

pdpRouter.post(
  "/:pdpId/supervisor/cannot-change",
  requireRole(ROLES.SUPERVISOR),
  validateParams(pdpIdParamSchema),
  validateBody(supervisorCannotChangeSchema),
  postSupervisorCannotChange
);

pdpRouter.post(
  "/:pdpId/hr/decision",
  requireRole(ROLES.HR, ROLES.HR_MANAGER),
  validateParams(pdpIdParamSchema),
  validateBody(hrDecisionSchema),
  postHrDecision
);

pdpRouter.post(
  "/:pdpId/assign",
  requireRole(ROLES.SUPERVISOR),
  validateParams(pdpIdParamSchema),
  postAssignPdp
);

pdpRouter.post(
  "/:pdpId/activate",
  requireRole(ROLES.EMPLOYEE),
  validateParams(pdpIdParamSchema),
  postActivatePdp
);

pdpRouter.post(
  "/:pdpId/goals",
  requireRole(ROLES.SUPERVISOR),
  validateParams(pdpIdParamSchema),
  validateBody(addActiveGoalSchema),
  postAddActiveGoal
);

pdpRouter.post(
  "/:pdpId/goals/:goalId/sub-goals",
  requireRole(ROLES.SUPERVISOR),
  validateParams(pdpGoalParamSchema),
  validateBody(addActiveSubGoalSchema),
  postAddActiveSubGoal
);

pdpRouter.patch(
  "/:pdpId/sub-goals/:subGoalId",
  requireRole(ROLES.EMPLOYEE),
  validateParams(pdpSubGoalParamSchema),
  optionalMultipartEvidence,
  validateBody(updateSubGoalSchema),
  patchSubGoal
);

pdpRouter.post(
  "/:pdpId/sub-goals/:subGoalId/approve",
  requireRole(ROLES.SUPERVISOR),
  validateParams(pdpSubGoalParamSchema),
  validateBody(approveSubGoalSchema),
  postApproveSubGoal
);

pdpRouter.post(
  "/:pdpId/sub-goals/:subGoalId/request-changes",
  requireRole(ROLES.SUPERVISOR),
  validateParams(pdpSubGoalParamSchema),
  validateBody(requestChangesSchema),
  postRequestSubGoalChanges
);

pdpRouter.get(
  "/:pdpId/sub-goals/:subGoalId/evidence/:storedName",
  validateParams(pdpEvidenceParamSchema),
  getSubGoalEvidenceFile
);

pdpRouter.get("/:pdpId/versions", validateParams(pdpIdParamSchema), getPdpVersions);
pdpRouter.get(
  "/:pdpId/versions/:versionNumber",
  validateParams(pdpVersionParamSchema),
  getPdpVersionByNumber
);

export default pdpRouter;
