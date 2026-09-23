import { Router } from "express";
import { authenticateUser } from "../middlewares/authenticate.js";
import { requireRole } from "../middlewares/requireRole.js";
import { validateBody, validateParams } from "../middlewares/validate.js";
import { ROLES } from "../constants/roles.js";
import { getPromotion, getPromotions, postPromotion, postReject, postShortlist } from "../controllers/promotion.controller.js";
import { promotionIdParamSchema, promotionReasonSchema, promotionRecommendSchema } from "../validations/promotion.validation.js";

const promotionRouter = Router();
promotionRouter.use(authenticateUser);

promotionRouter.get("/", requireRole(ROLES.HR, ROLES.HR_MANAGER, ROLES.SUPERVISOR), getPromotions);
promotionRouter.get(
  "/:id",
  requireRole(ROLES.HR, ROLES.HR_MANAGER, ROLES.SUPERVISOR),
  validateParams(promotionIdParamSchema),
  getPromotion
);
promotionRouter.post("/", requireRole(ROLES.SUPERVISOR), validateBody(promotionRecommendSchema), postPromotion);
promotionRouter.post(
  "/:id/shortlist",
  requireRole(ROLES.HR),
  validateParams(promotionIdParamSchema),
  validateBody(promotionReasonSchema),
  postShortlist
);
promotionRouter.post(
  "/:id/reject",
  requireRole(ROLES.HR),
  validateParams(promotionIdParamSchema),
  validateBody(promotionReasonSchema),
  postReject
);

export default promotionRouter;
