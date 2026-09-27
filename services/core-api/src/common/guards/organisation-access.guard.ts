import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { AccessTokenPayload } from "@nexora/types";
import { EntitlementsService } from "../../billing/entitlements.service";
import { PaymentRequiredApiException, ForbiddenApiException } from "../exceptions/api.exception";
import { ALLOW_WHEN_INACTIVE_KEY } from "../decorators/allow-when-inactive.decorator";
import { REQUIRE_MODULE_KEY } from "../decorators/require-module.decorator";

/**
 * Applied via @UseGuards(..., OrganisationAccessGuard) on every
 * organisation-scoped controller — same "runs after the global JwtAuthGuard"
 * guarantee PermissionsGuard relies on, so request.user is already
 * populated. Two independent checks, both driven by EntitlementsService:
 *
 * 1. Is this organisation even allowed to use the platform right now? A
 *    non-ACTIVE organisation status (the platform's own suspend/archive
 *    lever) or a non-usable subscription blocks EVERY route below this
 *    guard except @AllowWhenInactive() ones — regardless of @RequireModule.
 * 2. If the route is tagged @RequireModule(key), does this organisation's
 *    plan (as fine-tuned by any override) actually include that module?
 *
 * Deliberately NOT a global APP_GUARD: this codebase's own convention
 * (see PermissionsGuard) is that per-controller @UseGuards() is what's
 * guaranteed to run after the global JwtAuthGuard — a second global guard's
 * ordering relative to another module's global guard is not something Nest
 * documents, so this follows the pattern already proven correct here.
 */
@Injectable()
export class OrganisationAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly entitlements: EntitlementsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AccessTokenPayload | undefined;
    if (user?.scope !== "organisation" || !user.organisationId) return true;

    const allowWhenInactive = this.reflector.getAllAndOverride<boolean>(ALLOW_WHEN_INACTIVE_KEY, [context.getHandler(), context.getClass()]);
    const requiredModule = this.reflector.getAllAndOverride<string>(REQUIRE_MODULE_KEY, [context.getHandler(), context.getClass()]);

    const entitlements = await this.entitlements.getEntitlements(user.organisationId);

    if (!allowWhenInactive) {
      if (entitlements.organisationStatus !== "ACTIVE") {
        throw new PaymentRequiredApiException(
          "This organisation's access has been suspended. Contact your platform administrator.",
          "ORGANISATION_INACTIVE",
          { organisationStatus: entitlements.organisationStatus },
        );
      }
      if (entitlements.subscriptionStatus === null || entitlements.subscriptionStatus === "SUSPENDED" || entitlements.subscriptionStatus === "CANCELLED") {
        throw new PaymentRequiredApiException(
          "This organisation's subscription is not active. Renew to restore access.",
          "SUBSCRIPTION_INACTIVE",
          { subscriptionStatus: entitlements.subscriptionStatus },
        );
      }
    }

    if (requiredModule && !entitlements.effectiveModuleKeys.includes(requiredModule)) {
      throw new ForbiddenApiException(`Your organisation's plan (${entitlements.planName ?? "none"}) does not include this module.`, "MODULE_NOT_IN_PLAN", {
        moduleKey: requiredModule,
        planName: entitlements.planName,
      });
    }

    return true;
  }
}
