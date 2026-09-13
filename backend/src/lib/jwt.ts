import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env.js";
import type { AppRole } from "../constants/roles.js";

export interface JwtPayload {
  sub: string;
  employeeId: string;
  role: AppRole;
}

const cookieName = "performx_token";

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  } as SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.jwtSecret) as JwtPayload;
}

export function getAuthCookieOptions() {
  return {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: "none" as const,
    maxAge: 30 * 60 * 1000, // 30 minutes — aligned with session timeout policy
    path: "/",
  };
}

export function getClearCookieOptions() {
  return {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: "none" as const,
    path: "/",
  };
}

export { cookieName };
