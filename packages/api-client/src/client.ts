import type {
  ApiResult,
  AuthTokens,
  Organisation,
  PaginatedResult,
  Permission,
  PlatformUser,
  Role,
} from "@nexora/types";
import type {
  CreateOrganisationInput,
  CreatePlatformUserInput,
  CreateRoleInput,
  ListOrganisationsQuery,
  ListPlatformUsersQuery,
  UpdateOrganisationInput,
  UpdateOrganisationStatusInput,
  UpdatePlatformUserInput,
  UpdateRoleInput,
} from "@nexora/validation";

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

  private toQueryString(query: Record<string, unknown> | undefined): string {
    if (!query) return "";
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
    }
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }

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

  rbac = {
    listRoles: (): Promise<Role[]> => this.request("/api/v1/platform/roles"),

    listPermissions: (): Promise<Permission[]> => this.request("/api/v1/platform/permissions"),

    createRole: (input: CreateRoleInput): Promise<Role> =>
      this.request("/api/v1/platform/roles", { method: "POST", body: JSON.stringify(input) }),

    updateRole: (id: string, input: UpdateRoleInput): Promise<Role> =>
      this.request(`/api/v1/platform/roles/${id}`, { method: "PATCH", body: JSON.stringify(input) }),

    deleteRole: (id: string): Promise<{ deleted: true }> =>
      this.request(`/api/v1/platform/roles/${id}`, { method: "DELETE" }),
  };

  platformUsers = {
    me: (): Promise<PlatformUser> => this.request("/api/v1/platform/users/me"),

    list: (query: Partial<ListPlatformUsersQuery> = {}): Promise<PaginatedResult<PlatformUser>> =>
      this.request(`/api/v1/platform/users${this.toQueryString(query)}`),

    findById: (id: string): Promise<PlatformUser> => this.request(`/api/v1/platform/users/${id}`),

    create: (input: CreatePlatformUserInput): Promise<PlatformUser> =>
      this.request("/api/v1/platform/users", { method: "POST", body: JSON.stringify(input) }),

    update: (id: string, input: UpdatePlatformUserInput): Promise<PlatformUser> =>
      this.request(`/api/v1/platform/users/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  };

  organisations = {
    list: (query: Partial<ListOrganisationsQuery> = {}): Promise<PaginatedResult<Organisation>> =>
      this.request(`/api/v1/organisations${this.toQueryString(query)}`),

    findById: (id: string): Promise<Organisation> => this.request(`/api/v1/organisations/${id}`),

    create: (input: CreateOrganisationInput): Promise<Organisation> =>
      this.request("/api/v1/organisations", { method: "POST", body: JSON.stringify(input) }),

    update: (id: string, input: UpdateOrganisationInput): Promise<Organisation> =>
      this.request(`/api/v1/organisations/${id}`, { method: "PATCH", body: JSON.stringify(input) }),

    updateStatus: (id: string, input: UpdateOrganisationStatusInput): Promise<Organisation> =>
      this.request(`/api/v1/organisations/${id}/status`, { method: "PATCH", body: JSON.stringify(input) }),
  };
}
