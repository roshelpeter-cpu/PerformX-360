import type { NextFunction, Request, Response } from "express";
import { Role } from "../../generated/prisma/client.js";
import { AppError } from "../utils/errors.js";
import { approveAward, generateAwards, getAward, listAwards } from "../services/award.service.js";

function actor(req: Request) {
  if (!req.user) throw new AppError("Authentication required", 401);
  return { id: req.user.id, role: req.user.role as Role };
}

export async function getAwards(req: Request, res: Response, next: NextFunction) {
  try {
    const board = await listAwards(actor(req));
    res.status(200).json({ success: true, board });
  } catch (error) {
    next(error);
  }
}

export async function getAwardDetail(req: Request, res: Response, next: NextFunction) {
  try {
    const award = await getAward(actor(req), String(req.params.awardId));
    res.status(200).json({ success: true, award });
  } catch (error) {
    next(error);
  }
}

export async function postGenerateAwards(req: Request, res: Response, next: NextFunction) {
  try {
    const board = await generateAwards(actor(req));
    res.status(200).json({ success: true, board });
  } catch (error) {
    next(error);
  }
}

export async function postApproveAward(req: Request, res: Response, next: NextFunction) {
  try {
    const award = await approveAward(actor(req), String(req.params.awardId));
    res.status(200).json({ success: true, award });
  } catch (error) {
    next(error);
  }
}
