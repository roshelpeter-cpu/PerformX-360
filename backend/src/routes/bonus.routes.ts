import { Router } from "express";
import { authenticateUser } from "../middlewares/authenticate.js";
import { requireRole } from "../middlewares/requireRole.js";
import { validateParams } from "../middlewares/validate.js";
import { ROLES } from "../constants/roles.js";
import { getBonusDetail, getBonuses, postAuthorize, postCalculate } from "../controllers/bonus.controller.js";
import { bonusEmployeeParamSchema } from "../validations/bonus.validation.js";

const bonusRouter = Router();
bonusRouter.use(authenticateUser);
bonusRouter.use(requireRole(ROLES.HR_MANAGER));

bonusRouter.get("/", getBonuses);
bonusRouter.get("/employees/:employeeId", validateParams(bonusEmployeeParamSchema), getBonusDetail);
bonusRouter.post("/employees/:employeeId/calculate", validateParams(bonusEmployeeParamSchema), postCalculate);
bonusRouter.post("/employees/:employeeId/authorize", validateParams(bonusEmployeeParamSchema), postAuthorize);

export default bonusRouter;
