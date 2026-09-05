import type { AccessTokenPayload } from "@nexora/types";

/**
 * Client-side only, for UI gating (which nav items/actions to show). This is
 * never a security boundary — the API enforces permissions server-side on
 * every request regardless of what the UI renders — so no signature
 * verification is needed here, just reading the claims back out.
 */
export function decodeAccessToken(token: string): AccessTokenPayload | null {
  try {
    const payload = token.split(".")[1];
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`)
        .join(""),
    );
    return JSON.parse(json) as AccessTokenPayload;
  } catch {
    return null;
  }
}
