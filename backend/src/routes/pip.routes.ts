import { Router } from "express";
import { authenticateUser } from "../middlewares/authenticate.js";
import { requireRole } from "../middlewares/requireRole.js";
import { ROLES } from "../constants/roles.js";
import { getPipBoard } from "../controllers/pip.controller.js";

const pipRouter = Router();

pipRouter.use(authenticateUser);
pipRouter.use(requireRole(ROLES.SUPERVISOR, ROLES.HR, ROLES.HR_MANAGER));
pipRouter.get("/", getPipBoard);

export default pipRouter;
