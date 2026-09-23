import type { NextFunction, Request, Response } from "express";
import { Role } from "../../generated/prisma/client.js";
import { AppError } from "../utils/errors.js";
import { listPipBoard } from "../services/pip.service.js";

function actor(req: Request) {
  if (!req.user) throw new AppError("Authentication required", 401);
  return { id: req.user.id, role: req.user.role as Role };
}

export async function getPipBoard(req: Request, res: Response, next: NextFunction) {
  try {
    const board = await listPipBoard(actor(req));
    res.status(200).json({ success: true, board });
  } catch (error) {
    next(error);
  }
}
