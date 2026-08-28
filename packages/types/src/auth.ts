/**
 * The two independent identity spaces in NEXORA. A platform user (Control
 * Center) and an organisation user (Organisation Desktop) are never the same
 * principal — see architecture docs section "Platform vs Organisation auth".
 */
export type AuthScope = "platform" | "organisation";

export interface AccessTokenPayload {
  sub: string;
  scope: AuthScope;
  /** Present only for scope = "organisation" */
  organisationId?: string;
  tokenType: "access";
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload {
  sub: string;
  scope: AuthScope;
  organisationId?: string;
  tokenType: "refresh";
  /** Refresh token family id, used to detect reuse/rotation. */
  jti: string;
  iat?: number;
  exp?: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}
