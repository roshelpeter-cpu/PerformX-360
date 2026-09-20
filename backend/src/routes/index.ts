import { Router } from "express";
import authRouter from "./auth.routes.js";
import appraisalCycleRouter from "./appraisal-cycle.routes.js";
import dashboardRouter from "./dashboard.routes.js";
import employeeManagementRouter from "./employee-management.routes.js";

const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/dashboard", dashboardRouter);
apiRouter.use("/employee-management", employeeManagementRouter);
apiRouter.use("/hr/appraisal-cycles", appraisalCycleRouter);

export default apiRouter;
