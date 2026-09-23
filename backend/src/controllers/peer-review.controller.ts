import type { NextFunction, Request, Response } from "express";
import { Role } from "../../generated/prisma/client.js";
import { AppError } from "../utils/errors.js";
import {
  generatePeerRecommendations,
  getMyPeerReviews,
  getPeerDirectory,
  getPeerSelection,
  getTeamPeerBoard,
  savePeerReviewDraft,
  selectPeers,
  submitPeerReview,
} from "../services/peer-review.service.js";
import type { SavePeerReviewInput } from "../validations/peer-review.validation.js";

function actor(req: Request) {
  if (!req.user) throw new AppError("Authentication required", 401);
  return { id: req.user.id, role: req.user.role as Role };
}

export async function getTeam(req: Request, res: Response, next: NextFunction) {
  try {
    const board = await getTeamPeerBoard(actor(req));
    res.status(200).json({ success: true, board });
  } catch (error) {
    next(error);
  }
}

export async function getDirectory(req: Request, res: Response, next: NextFunction) {
  try {
    const directory = await getPeerDirectory(actor(req));
    res.status(200).json({ success: true, directory });
  } catch (error) {
    next(error);
  }
}

export async function getSelection(req: Request, res: Response, next: NextFunction) {
  try {
    const selection = await getPeerSelection(actor(req), String(req.params.employeeId));
    res.status(200).json({ success: true, selection });
  } catch (error) {
    next(error);
  }
}

export async function postRecommendations(req: Request, res: Response, next: NextFunction) {
  try {
    const selection = await generatePeerRecommendations(actor(req), String(req.params.employeeId));
    res.status(200).json({ success: true, selection });
  } catch (error) {
    next(error);
  }
}

export async function postSelection(req: Request, res: Response, next: NextFunction) {
  try {
    const body = req.body as { peerIds: string[] };
    const selection = await selectPeers(actor(req), String(req.params.employeeId), body.peerIds);
    res.status(200).json({ success: true, selection });
  } catch (error) {
    next(error);
  }
}

export async function getMine(req: Request, res: Response, next: NextFunction) {
  try {
    const peerReview = await getMyPeerReviews(actor(req));
    res.status(200).json({ success: true, peerReview });
  } catch (error) {
    next(error);
  }
}

export async function putDraft(req: Request, res: Response, next: NextFunction) {
  try {
    const peerReview = await savePeerReviewDraft(actor(req), String(req.params.reviewId), req.body as SavePeerReviewInput);
    res.status(200).json({ success: true, peerReview });
  } catch (error) {
    next(error);
  }
}

export async function postSubmit(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await submitPeerReview(actor(req), String(req.params.reviewId));
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}
