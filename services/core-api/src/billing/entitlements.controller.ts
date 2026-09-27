import { Body, Controller, Get, Param, Put, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { setModuleOverrideSchema, type SetModuleOverrideInput } from "@nexora/validation";
import type { AccessTokenPayload } from "@nexora/types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { EntitlementsService } from "./entitlements.service";

/**
 * The Control Center's "what can this organisation actually do, and can we
 * change it" surface — reads and writes the SAME EntitlementsService the
 * guard enforces with, so this preview is never out of sync with reality.
 */
@ApiTags("billing")
@UseGuards(PermissionsGuard)
@Controller("organisations/:organisationId/entitlements")
export class EntitlementsController {
  constructor(private readonly entitlements: EntitlementsService) {}

  @RequirePermissions("billing:read")
  @Get()
  get(@Param("organisationId") organisationId: string) {
    return this.entitlements.getEntitlements(organisationId);
  }

  @RequirePermissions("billing:manage_overrides")
  @Put(":moduleKey")
  setOverride(
    @Param("organisationId") organisationId: string,
    @Param("moduleKey") moduleKey: string,
    @Body(new ZodValidationPipe(setModuleOverrideSchema)) body: SetModuleOverrideInput,
    @CurrentUser() actor: AccessTokenPayload,
  ) {
    return this.entitlements.setOverride(organisationId, moduleKey, body.granted, body.reason, actor.sub);
  }
}
