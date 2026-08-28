import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthTokens } from "@nexora/types";

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  setTokens: (tokens: AuthTokens) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      setTokens: (tokens) => set({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken }),
      clear: () => set({ accessToken: null, refreshToken: null }),
    }),
    { name: "nexora-control-center-auth" },
  ),
);
