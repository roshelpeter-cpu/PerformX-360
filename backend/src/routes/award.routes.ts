import { Router } from "express";
import { authenticateUser } from "../middlewares/authenticate.js";
import { requireRole } from "../middlewares/requireRole.js";
import { validateParams } from "../middlewares/validate.js";
import { ROLES } from "../constants/roles.js";
import { awardIdParamSchema } from "../validations/award.validation.js";
import {
  getAwardDetail,
  getAwards,
  postApproveAward,
  postGenerateAwards,
} from "../controllers/award.controller.js";

const awardRouter = Router();

awardRouter.use(authenticateUser);
awardRouter.use(requireRole(ROLES.HR_MANAGER));

awardRouter.get("/", getAwards);
awardRouter.post("/generate", postGenerateAwards);
awardRouter.get("/:awardId", validateParams(awardIdParamSchema), getAwardDetail);
awardRouter.post("/:awardId/approve", validateParams(awardIdParamSchema), postApproveAward);

export default awardRouter;
