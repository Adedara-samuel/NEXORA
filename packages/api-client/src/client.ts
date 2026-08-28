import type { ApiResult, AuthTokens } from "@nexora/types";

export class NexoraApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "NexoraApiError";
  }
}

export interface NexoraApiClientOptions {
  baseUrl: string;
  getAccessToken?: () => string | null | undefined;
}

/**
 * Thin typed wrapper around the NEXORA Core API. Shared by the Control
 * Center (Next.js) and Organisation Desktop (Tauri) frontends so both
 * speak to /api/v1 the same way.
 */
export class NexoraApiClient {
  constructor(private readonly options: NexoraApiClientOptions) {}

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const accessToken = this.options.getAccessToken?.();
    const response = await fetch(`${this.options.baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...init.headers,
      },
    });

    const body = (await response.json()) as ApiResult<T>;

    if (!body.success) {
      throw new NexoraApiError(body.error.code, body.error.message, response.status, body.error.details);
    }

    return body.data;
  }

  health(): Promise<{ status: string; timestamp: string }> {
    return this.request("/api/v1/health");
  }

  auth = {
    platformLogin: (email: string, password: string): Promise<AuthTokens> =>
      this.request("/api/v1/auth/platform/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),

    refresh: (refreshToken: string): Promise<AuthTokens> =>
      this.request("/api/v1/auth/refresh", {
        method: "POST",
        body: JSON.stringify({ refreshToken }),
      }),

    logout: (refreshToken: string): Promise<void> =>
      this.request("/api/v1/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken }),
      }),
  };
}
