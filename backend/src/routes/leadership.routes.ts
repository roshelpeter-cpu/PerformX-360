import { Router } from "express";
import { authenticateUser } from "../middlewares/authenticate.js";
import { requireRole } from "../middlewares/requireRole.js";
import { validateQuery } from "../middlewares/validate.js";
import { ROLES } from "../constants/roles.js";
import { leadershipReportQuerySchema } from "../validations/leadership.validation.js";
import { getOverview, getReports } from "../controllers/leadership.controller.js";

const leadershipRouter = Router();

leadershipRouter.use(authenticateUser);
leadershipRouter.use(requireRole(ROLES.LEADERSHIP));

leadershipRouter.get("/overview", getOverview);
leadershipRouter.get("/reports", validateQuery(leadershipReportQuerySchema), getReports);

export default leadershipRouter;
