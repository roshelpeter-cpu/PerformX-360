import type { NextFunction, Request, Response } from "express";
import { Role } from "../../generated/prisma/client.js";
import { AppError } from "../utils/errors.js";
import { authorizeBonus, calculateBonus, getBonus, listBonuses } from "../services/bonus.service.js";

function actor(req: Request) {
  if (!req.user) throw new AppError("Authentication required", 401);
  return { id: req.user.id, role: req.user.role as Role };
}

export async function getBonuses(req: Request, res: Response, next: NextFunction) {
  try {
    const board = await listBonuses(actor(req));
    res.status(200).json({ success: true, board });
  } catch (error) {
    next(error);
  }
}

export async function getBonusDetail(req: Request, res: Response, next: NextFunction) {
  try {
    const bonus = await getBonus(actor(req), String(req.params.employeeId));
    res.status(200).json({ success: true, bonus });
  } catch (error) {
    next(error);
  }
}

export async function postCalculate(req: Request, res: Response, next: NextFunction) {
  try {
    const calculation = await calculateBonus(actor(req), String(req.params.employeeId));
    res.status(200).json({ success: true, calculation });
  } catch (error) {
    next(error);
  }
}

export async function postAuthorize(req: Request, res: Response, next: NextFunction) {
  try {
    const calculation = await authorizeBonus(actor(req), String(req.params.employeeId));
    res.status(200).json({ success: true, calculation });
  } catch (error) {
    next(error);
  }
}
