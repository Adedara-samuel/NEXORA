import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import {
  createRoleSchema,
  updateRoleSchema,
  type CreateRoleInput,
  type UpdateRoleInput,
} from "@nexora/validation";
import type { AccessTokenPayload } from "@nexora/types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { RbacService } from "./rbac.service";

@ApiTags("rbac")
@UseGuards(PermissionsGuard)
@Controller("platform")
export class RbacController {
  constructor(private readonly rbac: RbacService) {}

  @RequirePermissions("platform_roles:read")
  @Get("roles")
  listRoles() {
    return this.rbac.listRoles();
  }

  @RequirePermissions("platform_roles:read")
  @Get("permissions")
  listPermissions() {
    return this.rbac.listPermissions();
  }

  @RequirePermissions("platform_roles:manage")
  @Post("roles")
  createRole(
    @Body(new ZodValidationPipe(createRoleSchema)) body: CreateRoleInput,
    @CurrentUser() actor: AccessTokenPayload,
  ) {
    return this.rbac.createRole(body, actor.sub);
  }

  @RequirePermissions("platform_roles:manage")
  @Patch("roles/:id")
  updateRole(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateRoleSchema)) body: UpdateRoleInput,
    @CurrentUser() actor: AccessTokenPayload,
  ) {
    return this.rbac.updateRole(id, body, actor.sub);
  }

  @RequirePermissions("platform_roles:manage")
  @Delete("roles/:id")
  async deleteRole(@Param("id") id: string, @CurrentUser() actor: AccessTokenPayload) {
    await this.rbac.deleteRole(id, actor.sub);
    return { deleted: true };
  }
}
