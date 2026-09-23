import { Router } from "express";
import { authenticateUser } from "../middlewares/authenticate.js";
import { requireRole } from "../middlewares/requireRole.js";
import { validateBody, validateParams } from "../middlewares/validate.js";
import { optionalEvidenceUpload } from "../middlewares/upload.js";
import { ROLES } from "../constants/roles.js";
import {
  getEvidenceFile,
  getForEmployee,
  getMine,
  postEvidence,
  postSubmit,
  putDraft,
} from "../controllers/self-review.controller.js";
import {
  saveSelfReviewSchema,
  selfReviewEmployeeParamSchema,
  selfReviewEvidenceParamSchema,
  selfReviewQuestionParamSchema,
} from "../validations/self-review.validation.js";

const selfReviewRouter = Router();

selfReviewRouter.use(authenticateUser);

selfReviewRouter.get("/mine", requireRole(ROLES.EMPLOYEE), getMine);
selfReviewRouter.put(
  "/mine",
  requireRole(ROLES.EMPLOYEE),
  validateBody(saveSelfReviewSchema),
  putDraft
);
selfReviewRouter.post(
  "/mine/responses/:questionKey/evidence",
  requireRole(ROLES.EMPLOYEE),
  validateParams(selfReviewQuestionParamSchema),
  optionalEvidenceUpload,
  postEvidence
);
selfReviewRouter.post("/mine/submit", requireRole(ROLES.EMPLOYEE), postSubmit);
selfReviewRouter.get(
  "/mine/responses/:questionKey/evidence/:storedName",
  requireRole(ROLES.EMPLOYEE),
  validateParams(selfReviewEvidenceParamSchema),
  getEvidenceFile
);

selfReviewRouter.get(
  "/employees/:employeeId",
  requireRole(ROLES.SUPERVISOR, ROLES.HR, ROLES.HR_MANAGER, ROLES.LEADERSHIP),
  validateParams(selfReviewEmployeeParamSchema),
  getForEmployee
);

export default selfReviewRouter;
