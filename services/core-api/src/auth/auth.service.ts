import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";
import type { AccessTokenPayload, AuthTokens, RefreshTokenPayload } from "@nexora/types";
import { PrismaService } from "../prisma/prisma.service";
import { ForbiddenApiException, UnauthorizedApiException } from "../common/exceptions/api.exception";
import { durationToSeconds } from "../common/utils/duration";
import { RbacService } from "../rbac/rbac.service";
import { OrganisationRbacService } from "../organisation-rbac/organisation-rbac.service";

/**
 * Bcrypt hash of an arbitrary fixed string, never a real password. Compared
 * against on a "no such user" login attempt purely to burn roughly the same
 * CPU time as a real bcrypt.compare — otherwise "unknown email" responses
 * return measurably faster than "wrong password" ones, which is itself a
 * (timing-based) user-enumeration side channel.
 */
const TIMING_SAFE_DUMMY_HASH = "$2b$12$A32ZipC6u3YQv8hIx/a0RexVV3ya3GTJp2wWX8TJ.OFSbdupesTg6";

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly rbac: RbacService,
    private readonly organisationRbac: OrganisationRbacService,
  ) {}

  async platformLogin(email: string, password: string, meta: { ip?: string; userAgent?: string }): Promise<AuthTokens> {
    const user = await this.prisma.platformUser.findUnique({ where: { email } });

    // Deliberately generic: whether the email doesn't exist or the password
    // is wrong, the caller sees the same message/code. Differentiating them
    // (or letting response time differentiate them) lets an attacker
    // enumerate which emails have platform accounts — see auth docs.
    const passwordMatches = await bcrypt.compare(password, user?.passwordHash ?? TIMING_SAFE_DUMMY_HASH);
    if (!user || !passwordMatches) {
      throw new UnauthorizedApiException("Incorrect email or password", "INVALID_CREDENTIALS");
    }

    // Only reached with a *correct* password, so revealing account status
    // here doesn't leak anything an attacker didn't already prove they know.
    if (user.status !== "ACTIVE") {
      throw new ForbiddenApiException(
        "This account has been disabled. Contact your administrator.",
        "ACCOUNT_DISABLED",
      );
    }

    await this.prisma.platformUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    await this.prisma.auditLog.create({
      data: {
        actorId: user.id,
        actorType: "PLATFORM_USER",
        action: "PLATFORM_LOGIN_SUCCESS",
        resourceType: "PlatformUser",
        resourceId: user.id,
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
      },
    });

    return this.issueTokens({ sub: user.id, scope: "platform" });
  }

  /**
   * Email is unique PER-ORGANISATION, not globally, so login needs the
   * organisation's slug too — otherwise there's no way to know which of
   * potentially many "hr@company.com" accounts across different tenants is
   * meant.
   */
  async organisationLogin(organisationSlug: string, email: string, password: string): Promise<AuthTokens> {
    const organisation = await this.prisma.organisation.findUnique({ where: { slug: organisationSlug } });

    // Deliberately still runs a bcrypt compare even when the organisation
    // itself doesn't exist — same timing-safe-enumeration reasoning as
    // platformLogin, just one level up (unknown org, unknown user, and
    // wrong password all take the same amount of time and look identical).
    const user = organisation
      ? await this.prisma.organisationUser.findUnique({
          where: { organisationId_email: { organisationId: organisation.id, email } },
        })
      : null;
    const passwordMatches = await bcrypt.compare(password, user?.passwordHash ?? TIMING_SAFE_DUMMY_HASH);
    if (!organisation || !user || !passwordMatches) {
      throw new UnauthorizedApiException("Incorrect organisation, email or password", "INVALID_CREDENTIALS");
    }

    if (user.status !== "ACTIVE") {
      throw new ForbiddenApiException("This account has been disabled. Contact your administrator.", "ACCOUNT_DISABLED");
    }

    await this.prisma.organisationUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    await this.prisma.auditLog.create({
      data: {
        actorId: user.id,
        actorType: "ORGANISATION_USER",
        organisationId: organisation.id,
        action: "ORGANISATION_LOGIN_SUCCESS",
        resourceType: "OrganisationUser",
        resourceId: user.id,
      },
    });

    return this.issueTokens({ sub: user.id, scope: "organisation", organisationId: organisation.id });
  }

  async refresh(rawRefreshToken: string): Promise<AuthTokens> {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshTokenPayload>(rawRefreshToken, {
        secret: this.config.getOrThrow<string>("JWT_REFRESH_SECRET"),
      });
    } catch {
      throw new UnauthorizedApiException("Invalid or expired refresh token", "INVALID_REFRESH_TOKEN");
    }

    const stored = await this.prisma.refreshToken.findUnique({ where: { jti: payload.jti } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedApiException("Invalid or expired refresh token", "INVALID_REFRESH_TOKEN");
    }

    const tokenMatches = await bcrypt.compare(rawRefreshToken, stored.tokenHash);
    if (!tokenMatches) {
      // Presented token doesn't match the hash on record for this jti: possible token
      // reuse/leak. Revoke the whole family defensively.
      await this.prisma.refreshToken.update({ where: { jti: payload.jti }, data: { revokedAt: new Date() } });
      throw new UnauthorizedApiException("Invalid or expired refresh token", "INVALID_REFRESH_TOKEN");
    }

    await this.prisma.refreshToken.update({ where: { jti: payload.jti }, data: { revokedAt: new Date() } });

    return this.issueTokens({ sub: payload.sub, scope: payload.scope, organisationId: payload.organisationId });
  }

  async logout(rawRefreshToken: string): Promise<void> {
    try {
      const payload = await this.jwt.verifyAsync<RefreshTokenPayload>(rawRefreshToken, {
        secret: this.config.getOrThrow<string>("JWT_REFRESH_SECRET"),
      });
      await this.prisma.refreshToken.updateMany({
        where: { jti: payload.jti, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } catch {
      // Logging out with an already-invalid token is a no-op, not an error.
    }
  }

  private async issueTokens(claims: { sub: string; scope: "platform" | "organisation"; organisationId?: string }): Promise<AuthTokens> {
    const accessExpiresIn = this.config.get<string>("JWT_ACCESS_EXPIRES_IN", "15m");
    const refreshExpiresIn = this.config.get<string>("JWT_REFRESH_EXPIRES_IN", "7d");
    const jti = randomUUID();

    // Roles/permissions are snapshotted into the access token at issuance time
    // (login or refresh), not re-checked per-request — a role change takes
    // effect on the user's next refresh, at most one access-token lifetime
    // later. Revisit if Phase 11 needs tighter revocation guarantees.
    const rbac =
      claims.scope === "platform"
        ? await this.rbac.getUserRbac(claims.sub)
        : await this.organisationRbac.getUserRbac(claims.sub);

    const accessPayload: AccessTokenPayload = {
      sub: claims.sub,
      scope: claims.scope,
      organisationId: claims.organisationId,
      roles: rbac?.roles,
      permissions: rbac?.permissions,
      tokenType: "access",
    };
    const refreshPayload: RefreshTokenPayload = {
      sub: claims.sub,
      scope: claims.scope,
      organisationId: claims.organisationId,
      tokenType: "refresh",
      jti,
    };

    const accessToken = await this.jwt.signAsync(accessPayload, {
      secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
      expiresIn: accessExpiresIn,
    });
    const refreshToken = await this.jwt.signAsync(refreshPayload, {
      secret: this.config.getOrThrow<string>("JWT_REFRESH_SECRET"),
      expiresIn: refreshExpiresIn,
    });

    const tokenHash = await bcrypt.hash(refreshToken, this.config.get<number>("BCRYPT_SALT_ROUNDS", 12));
    const expiresAt = new Date(Date.now() + durationToSeconds(refreshExpiresIn) * 1000);

    await this.prisma.refreshToken.create({
      data: {
        jti,
        tokenHash,
        scope: claims.scope === "platform" ? "PLATFORM" : "ORGANISATION",
        platformUserId: claims.scope === "platform" ? claims.sub : undefined,
        organisationUserId: claims.scope === "organisation" ? claims.sub : undefined,
        organisationId: claims.organisationId,
        expiresAt,
      },
    });

    return { accessToken, refreshToken, expiresIn: durationToSeconds(accessExpiresIn) };
  }
}
