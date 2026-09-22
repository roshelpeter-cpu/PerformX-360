import { Router } from "express";
import { authenticateUser } from "../middlewares/authenticate.js";
import { requireRole } from "../middlewares/requireRole.js";
import { validateBody, validateParams, validateQuery } from "../middlewares/validate.js";
import { ROLES } from "../constants/roles.js";
import {
  getEligibleHrStaffList,
  getEligibleSupervisorsForEmployee,
  getEligibleTeams,
  getEmployeeProfile,
  getHierarchy,
  getMyTeam,
  postCreateAccount,
  postDeactivateEmployee,
  postReassignEmployee,
  postReassignSupervisorHr,
  postReassignTeamHr,
  getNextEmployeeId,
} from "../controllers/employee-management.controller.js";
import {
  createAccountSchema,
  employeeIdParamSchema,
  hierarchyQuerySchema,
  nextEmployeeIdQuerySchema,
  reassignEmployeeSchema,
  reassignTeamHrSchema,
  supervisorIdParamSchema,
  teamIdParamSchema,
  teamQuerySchema,
} from "../validations/employee-management.validation.js";

const employeeManagementRouter = Router();

employeeManagementRouter.use(authenticateUser);

employeeManagementRouter.get(
  "/my-team",
  requireRole(ROLES.SUPERVISOR),
  validateQuery(teamQuerySchema),
  getMyTeam
);

employeeManagementRouter.get(
  "/hierarchy",
  requireRole(ROLES.HR, ROLES.HR_MANAGER),
  validateQuery(hierarchyQuerySchema),
  getHierarchy
);

employeeManagementRouter.get(
  "/teams",
  requireRole(ROLES.HR, ROLES.HR_MANAGER),
  getEligibleTeams
);

employeeManagementRouter.get(
  "/hr-staff",
  requireRole(ROLES.HR_MANAGER),
  getEligibleHrStaffList
);

employeeManagementRouter.post(
  "/teams/:teamId/reassign-hr",
  requireRole(ROLES.HR_MANAGER),
  validateParams(teamIdParamSchema),
  validateBody(reassignTeamHrSchema),
  postReassignTeamHr
);

employeeManagementRouter.post(
  "/supervisors/:supervisorId/reassign-hr",
  requireRole(ROLES.HR_MANAGER),
  validateParams(supervisorIdParamSchema),
  validateBody(reassignTeamHrSchema),
  postReassignSupervisorHr
);

employeeManagementRouter.post(
  "/accounts",
  requireRole(ROLES.HR_MANAGER),
  validateBody(createAccountSchema),
  postCreateAccount
);

employeeManagementRouter.get(
  "/next-employee-id",
  requireRole(ROLES.HR_MANAGER),
  validateQuery(nextEmployeeIdQuerySchema),
  getNextEmployeeId
);

employeeManagementRouter.get(
  "/employees/:employeeId/eligible-supervisors",
  requireRole(ROLES.HR),
  validateParams(employeeIdParamSchema),
  getEligibleSupervisorsForEmployee
);

employeeManagementRouter.post(
  "/employees/:employeeId/reassign",
  requireRole(ROLES.HR),
  validateParams(employeeIdParamSchema),
  validateBody(reassignEmployeeSchema),
  postReassignEmployee
);

employeeManagementRouter.post(
  "/employees/:employeeId/deactivate",
  requireRole(ROLES.HR_MANAGER),
  validateParams(employeeIdParamSchema),
  postDeactivateEmployee
);

employeeManagementRouter.get(
  "/employees/:employeeId",
  requireRole(ROLES.SUPERVISOR, ROLES.HR, ROLES.HR_MANAGER),
  validateParams(employeeIdParamSchema),
  getEmployeeProfile
);

export default employeeManagementRouter;
