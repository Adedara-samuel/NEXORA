import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthTokens } from "@nexora/types";
import { decodeAccessToken } from "../lib/jwt";

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  organisationSlug: string | null;
  roles: string[];
  permissions: string[];
  setTokens: (tokens: AuthTokens, organisationSlug: string) => void;
  clear: () => void;
  hasPermission: (permission: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      organisationSlug: null,
      roles: [],
      permissions: [],
      setTokens: (tokens, organisationSlug) => {
        const payload = decodeAccessToken(tokens.accessToken);
        set({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          organisationSlug,
          roles: payload?.roles ?? [],
          permissions: payload?.permissions ?? [],
        });
      },
      clear: () => set({ accessToken: null, refreshToken: null, organisationSlug: null, roles: [], permissions: [] }),
      hasPermission: (permission) => get().permissions.includes(permission),
    }),
    { name: "nexora-organisation-desktop-auth" },
  ),
);
