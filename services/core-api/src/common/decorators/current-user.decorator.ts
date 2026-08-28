import { ExecutionContext, createParamDecorator } from "@nestjs/common";
import type { AccessTokenPayload } from "@nexora/types";

/** Extracts the authenticated principal attached by JwtAuthGuard/JwtAccessStrategy. */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AccessTokenPayload => {
  const request = ctx.switchToHttp().getRequest();
  return request.user;
});
