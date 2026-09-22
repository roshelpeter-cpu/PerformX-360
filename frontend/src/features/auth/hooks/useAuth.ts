// Authentication hooks
// Session bootstrap, login/logout, password reset, and notification queries
// for the role-based authentication feature.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  extendSessionRequest,
  forgotPasswordRequest,
  changePasswordRequest,
  getCurrentUserRequest,
  getMyNotificationsRequest,
  loginRequest,
  logoutRequest,
  markAllNotificationsReadRequest,
  markNotificationReadRequest,
  reportUnauthorizedAccessRequest,
} from "@/features/auth/services/auth.api";
import type {
  ChangePasswordPayload,
  ForgotPasswordPayload,
  LoginCredentials,
} from "@/features/auth/types";
import { getDashboardPathForRole } from "@/constants/roles";
import { useAuthStore } from "@/store/authStore";
import { ApiClientError } from "@/services/api/client";
import { clearAssignedPdp904Session } from "@/features/pdp/utils/demoPdpAccounts";

export function useAuthBootstrap() {
  const setUser = useAuthStore((state) => state.setUser);

  return useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      const response = await getCurrentUserRequest();
      setUser(response.user);
      return response.user;
    },
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useLogin() {
  const navigate = useNavigate();
  const setUser = useAuthStore((state) => state.setUser);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (credentials: LoginCredentials) => loginRequest(credentials),
    onSuccess: (response) => {
      queryClient.clear();
      setUser(response.user);
      queryClient.setQueryData(["auth", "me"], response.user);
      if (response.user.mustChangePassword) {
        toast.success("Please create a permanent password to continue.");
        navigate("/set-password", { replace: true });
        return;
      }
      toast.success(`Welcome back, ${response.user.name}`);
      navigate(getDashboardPathForRole(response.user.role), { replace: true });
    },
  });
}

export function useLogout() {
  const navigate = useNavigate();
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logoutRequest,
    onSettled: () => {
      clearAssignedPdp904Session();
      clearAuth();
      queryClient.clear();
      navigate("/login", { replace: true });
      toast.success("Signed out successfully");
    },
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (payload: ForgotPasswordPayload) => forgotPasswordRequest(payload),
  });
}

export function useChangePassword() {
  const navigate = useNavigate();
  const setUser = useAuthStore((state) => state.setUser);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ChangePasswordPayload) => changePasswordRequest(payload),
    onSuccess: (response) => {
      setUser(response.user);
      queryClient.setQueryData(["auth", "me"], response.user);
      toast.success("Permanent password saved. You can continue.");
      navigate(getDashboardPathForRole(response.user.role), { replace: true });
    },
  });
}

export function useExtendSession() {
  const setUser = useAuthStore((state) => state.setUser);

  return useMutation({
    mutationFn: extendSessionRequest,
    onSuccess: (response) => {
      setUser(response.user);
    },
  });
}

export function useReportUnauthorizedAccess() {
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (attemptedRoute: string) =>
      reportUnauthorizedAccessRequest(attemptedRoute),
    onError: (error) => {
      if (error instanceof ApiClientError && error.code === "AUTH_LOCKED") {
        clearAuth();
        toast.error(error.message);
        navigate("/login", { replace: true });
      }
    },
  });
}

export function useMyNotifications(enabled = true) {
  const userId = useAuthStore((state) => state.user?.id);
  return useQuery({
    queryKey: ["auth", "notifications", userId],
    queryFn: getMyNotificationsRequest,
    enabled: enabled && Boolean(userId),
    refetchInterval: 60_000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markNotificationReadRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "notifications"] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markAllNotificationsReadRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "notifications"] });
      toast.success("All notifications marked as read.");
    },
  });
}
