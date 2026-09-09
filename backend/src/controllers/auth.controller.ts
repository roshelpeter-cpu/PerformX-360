// Authentication Controller
// Login, session, password-reset, and notification HTTP handlers.

import type { Request, Response, NextFunction } from "express";
import {
  cookieName,
  getAuthCookieOptions,
  getClearCookieOptions,
} from "../lib/jwt.js";
import {
  createForgotPasswordRequest,
  extendUserSession,
  getCurrentUser,
  hrResetEmployeePassword,
  loginUser,
  reportUnauthorizedRouteAccess,
  setPermanentPassword,
} from "../services/auth.service.js";
import {
  getHrNotifications,
  getNotificationsForUser,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "../services/notification.service.js";
import { AppError } from "../utils/errors.js";

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { employeeId, password } = req.body as {
      employeeId: string;
      password: string;
    };

    const result = await loginUser(employeeId, password);

    // The JWT is stored in an HTTP-only cookie so JavaScript cannot directly read it.
    res.cookie(cookieName, result.token, getAuthCookieOptions());
    res.status(200).json({ success: true, user: result.user });
  } catch (error) {
    next(error);
  }
}

export function logout(_req: Request, res: Response) {
  res.clearCookie(cookieName, getClearCookieOptions());
  res.status(200).json({ success: true, message: "Logged out successfully" });
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw new AppError("Authentication required", 401);
    }

    const user = await getCurrentUser(req.user.id);
    res.status(200).json({ success: true, user });
  } catch (error) {
    next(error);
  }
}

export async function forgotPassword(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { employeeId } = req.body as { employeeId: string };
    const result = await createForgotPasswordRequest(employeeId);

    res.status(200).json({
      success: true,
      title: "One-time password created",
      message:
        "Use this password to sign in. You will be required to create a permanent password after signing in.",
      oneTimePassword: result.oneTimePassword,
      expiresAt: result.expiresAt,
    });
  } catch (error) {
    next(error);
  }
}

export async function changePassword(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      throw new AppError("Authentication required", 401);
    }

    const { newPassword } = req.body as { newPassword: string };
    const result = await setPermanentPassword(req.user.id, newPassword);

    res.cookie(cookieName, result.token, getAuthCookieOptions());
    res.status(200).json({ success: true, user: result.user });
  } catch (error) {
    next(error);
  }
}

export async function hrResetPassword(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { employeeId } = req.params as { employeeId: string };
    const result = await hrResetEmployeePassword(employeeId);

    res.status(200).json({
      success: true,
      message: "Password reset completed",
      data: {
        employeeId: result.employeeId,
        emailSent: result.emailSent,
        ...(result.emailReason ? { emailReason: result.emailReason } : {}),
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function extendSession(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      throw new AppError("Authentication required", 401);
    }

    const result = await extendUserSession(req.user.id);
    res.cookie(cookieName, result.token, getAuthCookieOptions());
    res.status(200).json({ success: true, user: result.user });
  } catch (error) {
    next(error);
  }
}

export async function reportUnauthorizedAccess(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      throw new AppError("Authentication required", 401);
    }

    const { attemptedRoute } = req.body as { attemptedRoute: string };
    const result = await reportUnauthorizedRouteAccess({
      employeeDbId: req.user.id,
      employeePublicId: req.user.employeeId,
      employeeName: req.user.name,
      attemptedRoute,
    });

    if (result.locked) {
      res.clearCookie(cookieName, getClearCookieOptions());
      res.status(403).json({
        success: false,
        code: "AUTH_LOCKED",
        message:
          "Repeated unauthorized access attempts detected. You have been signed out and temporarily locked for 5 minutes.",
        lockedUntil: result.lockedUntil.toISOString(),
      });
      return;
    }

    res.status(200).json({
      success: true,
      attemptCount: result.attemptCount,
      maxAttempts: result.maxAttempts,
    });
  } catch (error) {
    next(error);
  }
}

export async function hrNotifications(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const notifications = await getHrNotifications();
    res.status(200).json({ success: true, notifications });
  } catch (error) {
    next(error);
  }
}

export async function myNotifications(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user?.id) throw new AppError("Authentication required", 401);
    const [notifications, unreadCount] = await Promise.all([
      getNotificationsForUser(req.user.id),
      getUnreadNotificationCount(req.user.id),
    ]);
    res.status(200).json({ success: true, notifications, unreadCount });
  } catch (error) {
    next(error);
  }
}

export async function readNotification(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user?.id) throw new AppError("Authentication required", 401);
    const notification = await markNotificationRead(
      String(req.params.id),
      req.user.id
    );
    res.status(200).json({ success: true, notification });
  } catch (error) {
    next(error);
  }
}

export async function readAllNotifications(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user?.id) throw new AppError("Authentication required", 401);
    await markAllNotificationsRead(req.user.id);
    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
}
