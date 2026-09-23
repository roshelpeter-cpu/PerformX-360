import { Router } from "express";
import { authenticateUser } from "../middlewares/authenticate.js";
import { requireRole } from "../middlewares/requireRole.js";
import { validateBody, validateParams } from "../middlewares/validate.js";
import { ROLES } from "../constants/roles.js";
import {
  getDirectory,
  getMine,
  getSelection,
  getTeam,
  postRecommendations,
  postSelection,
  postSubmit,
  putDraft,
} from "../controllers/peer-review.controller.js";
import {
  peerEmployeeParamSchema,
  peerReviewParamSchema,
  savePeerReviewSchema,
  selectPeersSchema,
} from "../validations/peer-review.validation.js";

const peerReviewRouter = Router();
peerReviewRouter.use(authenticateUser);

peerReviewRouter.get("/directory", requireRole(ROLES.HR), getDirectory);
peerReviewRouter.get("/team", requireRole(ROLES.SUPERVISOR), getTeam);
peerReviewRouter.get(
  "/employees/:employeeId",
  requireRole(ROLES.HR),
  validateParams(peerEmployeeParamSchema),
  getSelection
);
peerReviewRouter.post(
  "/employees/:employeeId/recommendations",
  requireRole(ROLES.HR),
  validateParams(peerEmployeeParamSchema),
  postRecommendations
);
peerReviewRouter.post(
  "/employees/:employeeId/select",
  requireRole(ROLES.HR),
  validateParams(peerEmployeeParamSchema),
  validateBody(selectPeersSchema),
  postSelection
);
peerReviewRouter.get("/mine", requireRole(ROLES.EMPLOYEE), getMine);
peerReviewRouter.put(
  "/assignments/:reviewId",
  requireRole(ROLES.EMPLOYEE),
  validateParams(peerReviewParamSchema),
  validateBody(savePeerReviewSchema),
  putDraft
);
peerReviewRouter.post(
  "/assignments/:reviewId/submit",
  requireRole(ROLES.EMPLOYEE),
  validateParams(peerReviewParamSchema),
  postSubmit
);

export default peerReviewRouter;
