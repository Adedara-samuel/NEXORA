import { ExecutionContext, createParamDecorator } from "@nestjs/common";
import type { AccessTokenPayload } from "@nexora/types";
import { ForbiddenApiException } from "../exceptions/api.exception";

/**
 * The tenant-isolation boundary for every org-scoped endpoint: derives
 * organisationId from the caller's OWN JWT, never from a URL param or
 * request body. An org-scoped controller should never accept an
 * organisationId the client supplies — see schema.prisma's Phase 4 header
 * comment for why.
 */
export const CurrentOrganisationId = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest();
  const user: AccessTokenPayload | undefined = request.user;
  if (user?.scope !== "organisation" || !user.organisationId) {
    throw new ForbiddenApiException("This endpoint is restricted to organisation accounts", "ORGANISATION_ONLY");
  }
  return user.organisationId;
});
