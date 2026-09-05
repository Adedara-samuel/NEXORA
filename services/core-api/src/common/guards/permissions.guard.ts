import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { AccessTokenPayload } from "@nexora/types";
import { ForbiddenApiException } from "../exceptions/api.exception";
import { PERMISSIONS_KEY } from "../decorators/require-permissions.decorator";

/**
 * Applied via @UseGuards(PermissionsGuard) at the controller/method level, so
 * it always runs after the global JwtAuthGuard (Nest guarantees global
 * guards execute before controller/method-scoped ones) and can trust
 * request.user is populated.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const user = context.switchToHttp().getRequest().user as AccessTokenPayload | undefined;
    const granted = new Set(user?.permissions ?? []);
    const hasAll = required.every((permission) => granted.has(permission));
    if (!hasAll) {
      throw new ForbiddenApiException("You do not have permission to perform this action", "MISSING_PERMISSION");
    }
    return true;
  }
}
