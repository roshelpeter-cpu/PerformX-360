import { Router } from "express";
import { authenticateUser } from "../middlewares/authenticate.js";
import { requireRole } from "../middlewares/requireRole.js";
import { optionalEvidenceUpload } from "../middlewares/upload.js";
import { validateBody, validateParams } from "../middlewares/validate.js";
import { ROLES } from "../constants/roles.js";
import {
  downloadProfileChangeEvidence,
  getProfileChangeInbox,
  getProfileChangeRequestById,
  postProfileChangeRequest,
  postReviewProfileChangeRequest,
} from "../controllers/profile-request.controller.js";
import {
  profileChangeRequestSchema,
  requestIdParamSchema,
  reviewRequestSchema,
} from "../validations/employee-management.validation.js";

const profileRequestRouter = Router();
profileRequestRouter.use(authenticateUser);

profileRequestRouter.post(
  "/",
  optionalEvidenceUpload,
  validateBody(profileChangeRequestSchema),
  postProfileChangeRequest
);
profileRequestRouter.get("/", getProfileChangeInbox);
profileRequestRouter.get(
  "/:requestId/evidence",
  validateParams(requestIdParamSchema),
  downloadProfileChangeEvidence
);
profileRequestRouter.get(
  "/:requestId",
  validateParams(requestIdParamSchema),
  getProfileChangeRequestById
);
profileRequestRouter.post(
  "/:requestId/review",
  requireRole(ROLES.HR, ROLES.HR_MANAGER),
  validateParams(requestIdParamSchema),
  validateBody(reviewRequestSchema),
  postReviewProfileChangeRequest
);

export default profileRequestRouter;
