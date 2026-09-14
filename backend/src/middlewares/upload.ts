import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import type { Request } from "express";
import { AppError } from "../utils/errors.js";
import { ensureUploadDirs, evidenceDir } from "../lib/uploads.js";

// ============================================================
// SUPPORTING EVIDENCE UPLOAD
// Used by batch and supervisor reassignment. Files are stored on disk
// and referenced from assignment history — binary content is not stored
// in ordinary database columns.
// ============================================================

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureUploadDirs();
    cb(null, evidenceDir);
  },
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^\w.\-]+/g, "_").slice(0, 80);
    cb(null, `${Date.now()}-${safe}`);
  },
});

function fileFilter(
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) {
  if (ALLOWED_MIME.has(file.mimetype)) {
    cb(null, true);
    return;
  }
  cb(new AppError("Unsupported evidence file type", 400, "INVALID_EVIDENCE"));
}

export const evidenceUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

export function optionalEvidenceUpload(
  req: Request,
  res: import("express").Response,
  next: import("express").NextFunction
) {
  evidenceUpload.single("evidence")(req, res, (error: unknown) => {
    if (!error) {
      next();
      return;
    }
    if (error instanceof AppError) {
      next(error);
      return;
    }
    next(new AppError("Failed to upload supporting evidence", 400, "UPLOAD_FAILED"));
  });
}

/** Mandatory evidence upload for HR reassignment and similar flows. */
export function requiredEvidenceUpload(
  req: Request,
  _res: import("express").Response,
  next: import("express").NextFunction
) {
  evidenceUpload.single("evidence")(req, _res, (error: unknown) => {
    if (error) {
      if (error instanceof AppError) {
        next(error);
        return;
      }
      next(
        new AppError("Failed to upload supporting evidence", 400, "UPLOAD_FAILED")
      );
      return;
    }
    if (!req.file) {
      next(
        new AppError(
          "Supporting evidence is required",
          400,
          "EVIDENCE_REQUIRED"
        )
      );
      return;
    }
    next();
  });
}

export function removeUploadedFile(filename: string | undefined) {
  if (!filename) return;
  const fullPath = path.join(evidenceDir, filename);
  fs.promises.unlink(fullPath).catch(() => undefined);
}
