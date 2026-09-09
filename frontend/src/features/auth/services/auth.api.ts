// Authentication API
// HTTP client helpers for login, session, password reset, and notifications.

import { apiRequest } from "@/services/api/client";
import type {
  AuthUser,
  ChangePasswordPayload,
  ForgotPasswordPayload,
  ForgotPasswordResponse,
  LoginCredentials,
  LoginResponse,
  MeResponse,
} from "@/features/auth/types";

export async function loginRequest(credentials: LoginCredentials) {
  return apiRequest<LoginResponse>("/auth/login", {
    method: "POST",
    body: credentials,
  });
}

export async function logoutRequest() {
  return apiRequest<{ success: true; message: string }>("/auth/logout", {
    method: "POST",
  });
}

export async function getCurrentUserRequest() {
  return apiRequest<MeResponse>("/auth/me");
}

export async function forgotPasswordRequest(payload: ForgotPasswordPayload) {
  return apiRequest<ForgotPasswordResponse>("/auth/forgot-password", {
    method: "POST",
    body: payload,
  });
}

export async function changePasswordRequest(payload: ChangePasswordPayload) {
  return apiRequest<LoginResponse>("/auth/change-password", {
    method: "POST",
    body: payload,
  });
}

export async function extendSessionRequest() {
  return apiRequest<LoginResponse>("/auth/extend-session", {
    method: "POST",
  });
}

export async function reportUnauthorizedAccessRequest(attemptedRoute: string) {
  return apiRequest<{
    success: true;
    attemptCount: number;
    maxAttempts: number;
  }>("/auth/report-unauthorized", {
    method: "POST",
    body: { attemptedRoute },
  });
}

export async function getMyNotificationsRequest() {
  return apiRequest<{
    success: true;
    notifications: Array<{
      id: string;
      type: string;
      title: string;
      message: string;
      status: "UNREAD" | "READ";
      metadata: Record<string, unknown> | null;
      createdAt: string;
    }>;
    unreadCount: number;
  }>("/auth/notifications");
}

export async function markNotificationReadRequest(id: string) {
  return apiRequest<{ success: true }>(`/auth/notifications/${id}/read`, {
    method: "POST",
  });
}

export type { AuthUser };
