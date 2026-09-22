import { create } from "zustand";
import type { AuthUser } from "@/features/auth/types";
import { clearAssignedPdp904Session } from "@/features/pdp/utils/demoPdpAccounts";

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  setUser: (user: AuthUser | null) => void;
  setInitialized: (value: boolean) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isInitialized: false,
  setUser: (user) =>
    set({
      user,
      isAuthenticated: Boolean(user),
    }),
  setInitialized: (value) => set({ isInitialized: value }),
  clearAuth: () => {
    clearAssignedPdp904Session();
    set({
      user: null,
      isAuthenticated: false,
    });
  },
}));
