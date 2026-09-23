import type { NextFunction, Request, Response } from "express";
import { Role } from "../../generated/prisma/client.js";
import { AppError } from "../utils/errors.js";
import {
  getPromotionRecommendation,
  listPromotionRecommendations,
  recommendPromotion,
  rejectPromotion,
  shortlistPromotion,
} from "../services/promotion.service.js";

function actor(req: Request) {
  if (!req.user) throw new AppError("Authentication required", 401);
  return { id: req.user.id, role: req.user.role as Role };
}

export async function getPromotions(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await listPromotionRecommendations(actor(req));
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function getPromotion(req: Request, res: Response, next: NextFunction) {
  try {
    const recommendation = await getPromotionRecommendation(actor(req), String(req.params.id));
    res.status(200).json({ success: true, recommendation });
  } catch (error) {
    next(error);
  }
}

export async function postPromotion(req: Request, res: Response, next: NextFunction) {
  try {
    const body = req.body as { employeeId: string; reason: string };
    const recommendation = await recommendPromotion(actor(req), body.employeeId, body.reason);
    res.status(201).json({ success: true, recommendation });
  } catch (error) {
    next(error);
  }
}

export async function postShortlist(req: Request, res: Response, next: NextFunction) {
  try {
    const body = req.body as { reason: string };
    const recommendation = await shortlistPromotion(actor(req), String(req.params.id), body.reason);
    res.status(200).json({ success: true, recommendation });
  } catch (error) {
    next(error);
  }
}

export async function postReject(req: Request, res: Response, next: NextFunction) {
  try {
    const body = req.body as { reason: string };
    const recommendation = await rejectPromotion(actor(req), String(req.params.id), body.reason);
    res.status(200).json({ success: true, recommendation });
  } catch (error) {
    next(error);
  }
}
