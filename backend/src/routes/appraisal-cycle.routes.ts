// Appraisal Cycle Routes
// HR-only HTTP routes for cycle creation, lifecycle, assignments,
// and draft-only deletion. Confirmed cycles cannot be deleted.
import { Router } from "express";
import { authenticateUser } from "../middlewares/authenticate.js";
import { requireRole } from "../middlewares/requireRole.js";
import { optionalEvidenceUpload, requiredEvidenceUpload } from "../middlewares/upload.js";
import {
  activateCycle,
  changeBatch,
  changeSupervisor,
  completeCycle,
  confirmCycle,
  createCycle,
  deleteCycle,
  downloadEvidence,
  getActivationPreview,
  getBatch,
  getCreateDefaults,
  getCurrentCycle,
  getCycle,
  getCycleEmployees,
  getDepartments,
  getEligibleSupervisors,
  getHistory,
  getHistoryCycles,
  getHrGroupDetail,
  getHrGroups,
  getRecentActivity,
  getSupervisor,
  getSupervisors,
  getWorkforce,
  listCycles,
  reassignHr,
  startBatch,
  updateBatch,
  updateCycle,
} from "../controllers/appraisal-cycle.controller.js";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../middlewares/validate.js";
import { HR_STAFF_ROLES } from "../constants/roles.js";
import {
  assignmentHistoryQuerySchema,
  changeBatchSchema,
  changeSupervisorSchema,
  createCycleSchema,
  cycleBatchParamsSchema,
  cycleEmployeeParamsSchema,
  cycleIdParamsSchema,
  cycleListQuerySchema,
  cycleSupervisorParamsSchema,
  cycleTeamParamsSchema,
  employeeAssignmentQuerySchema,
  evidenceFilenameParamsSchema,
  hrEmployeeParamsSchema,
  reassignHrSchema,
  supervisorQuerySchema,
  updateBatchSchema,
  updateCycleSchema,
} from "../validations/appraisal-cycle.validation.js";
import { startBatchStageSchema } from "../validations/meeting.validation.js";

// ============================================================
// APPRAISAL CYCLE ROUTES
// Organization-wide cycle management for authenticated HR staff.
// ============================================================
const appraisalCycleRouter = Router();

appraisalCycleRouter.use(authenticateUser, requireRole(...HR_STAFF_ROLES));

appraisalCycleRouter.get("/departments", getDepartments);
appraisalCycleRouter.get("/workforce", getWorkforce);
appraisalCycleRouter.get("/activity", getRecentActivity);
appraisalCycleRouter.get("/create-defaults", getCreateDefaults);
appraisalCycleRouter.get(
  "/evidence/:filename",
  validateParams(evidenceFilenameParamsSchema),
  downloadEvidence
);

appraisalCycleRouter.get(
  "/",
  validateQuery(cycleListQuerySchema),
  listCycles
);
appraisalCycleRouter.post("/", validateBody(createCycleSchema), createCycle);
appraisalCycleRouter.get("/current", getCurrentCycle);
appraisalCycleRouter.get("/history", getHistoryCycles);

appraisalCycleRouter.get("/:id", validateParams(cycleIdParamsSchema), getCycle);
appraisalCycleRouter.patch(
  "/:id",
  validateParams(cycleIdParamsSchema),
  validateBody(updateCycleSchema),
  updateCycle
);
appraisalCycleRouter.post(
  "/:id/confirm",
  validateParams(cycleIdParamsSchema),
  confirmCycle
);
appraisalCycleRouter.get(
  "/:id/activation-readiness",
  validateParams(cycleIdParamsSchema),
  getActivationPreview
);
appraisalCycleRouter.post(
  "/:id/activate",
  validateParams(cycleIdParamsSchema),
  activateCycle
);
appraisalCycleRouter.post(
  "/:id/complete",
  validateParams(cycleIdParamsSchema),
  completeCycle
);
appraisalCycleRouter.delete(
  "/:id",
  validateParams(cycleIdParamsSchema),
  deleteCycle
);

appraisalCycleRouter.get(
  "/:id/hr-groups",
  validateParams(cycleIdParamsSchema),
  getHrGroups
);
appraisalCycleRouter.get(
  "/:id/hr-groups/:hrEmployeeId",
  validateParams(hrEmployeeParamsSchema),
  getHrGroupDetail
);
appraisalCycleRouter.post(
  "/:id/teams/:teamId/reassign-hr",
  validateParams(cycleTeamParamsSchema),
  requiredEvidenceUpload,
  validateBody(reassignHrSchema),
  reassignHr
);

appraisalCycleRouter.get(
  "/:id/batches/:batchId",
  validateParams(cycleBatchParamsSchema),
  getBatch
);
appraisalCycleRouter.patch(
  "/:id/batches/:batchId",
  validateParams(cycleBatchParamsSchema),
  validateBody(updateBatchSchema),
  updateBatch
);
appraisalCycleRouter.post(
  "/:id/batches/:batchId/start-stage",
  validateParams(cycleBatchParamsSchema),
  validateBody(startBatchStageSchema),
  startBatch
);

appraisalCycleRouter.get(
  "/:id/employees",
  validateParams(cycleIdParamsSchema),
  validateQuery(employeeAssignmentQuerySchema),
  getCycleEmployees
);
appraisalCycleRouter.post(
  "/:id/employees/:employeeId/batch",
  validateParams(cycleEmployeeParamsSchema),
  optionalEvidenceUpload,
  validateBody(changeBatchSchema),
  changeBatch
);
appraisalCycleRouter.post(
  "/:id/employees/:employeeId/supervisor",
  validateParams(cycleEmployeeParamsSchema),
  optionalEvidenceUpload,
  validateBody(changeSupervisorSchema),
  changeSupervisor
);
appraisalCycleRouter.get(
  "/:id/employees/:employeeId/eligible-supervisors",
  validateParams(cycleEmployeeParamsSchema),
  getEligibleSupervisors
);

appraisalCycleRouter.get(
  "/:id/supervisors",
  validateParams(cycleIdParamsSchema),
  validateQuery(supervisorQuerySchema),
  getSupervisors
);
appraisalCycleRouter.get(
  "/:id/supervisors/:supervisorId",
  validateParams(cycleSupervisorParamsSchema),
  getSupervisor
);

appraisalCycleRouter.get(
  "/:id/assignment-history",
  validateParams(cycleIdParamsSchema),
  validateQuery(assignmentHistoryQuerySchema),
  getHistory
);

export default appraisalCycleRouter;
