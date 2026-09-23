import type { NextFunction, Request, Response } from "express";
import { Role } from "../../generated/prisma/client.js";
import { AppError } from "../utils/errors.js";
import {
  buildLeadershipDocx,
  buildLeadershipPdf,
  getLeadershipOverview,
  getLeadershipReport,
  recordLeadershipReport,
} from "../services/leadership.service.js";
import type { LeadershipReportQuery } from "../validations/leadership.validation.js";

function actor(req: Request) {
  if (!req.user) throw new AppError("Authentication required", 401);
  return { id: req.user.id, role: req.user.role as Role };
}

export async function getOverview(req: Request, res: Response, next: NextFunction) {
  try {
    const cycleId = typeof req.query.cycleId === "string" ? req.query.cycleId : undefined;
    const overview = await getLeadershipOverview(actor(req), cycleId);
    res.status(200).json({ success: true, overview });
  } catch (error) {
    next(error);
  }
}

export async function getReports(req: Request, res: Response, next: NextFunction) {
  try {
    const query = req.query as LeadershipReportQuery;
    if (query.format === "pdf") {
      const buffer = await buildLeadershipPdf(actor(req), query);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", 'attachment; filename="performx-leadership-report.pdf"');
      res.status(200).send(buffer);
      return;
    }
    if (query.format === "docx") {
      const buffer = await buildLeadershipDocx(actor(req), query);
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );
      res.setHeader("Content-Disposition", 'attachment; filename="performx-leadership-report.docx"');
      res.status(200).send(buffer);
      return;
    }
    const report = await getLeadershipReport(actor(req), query);
    res.status(200).json({ success: true, report });
  } catch (error) {
    next(error);
  }
}

export async function postGenerateReport(req: Request, res: Response, next: NextFunction) {
  try {
    const query = req.query as LeadershipReportQuery;
    const report = await recordLeadershipReport(actor(req), { ...query, ...(req.body ?? {}) });
    res.status(200).json({ success: true, report });
  } catch (error) {
    next(error);
  }
}
