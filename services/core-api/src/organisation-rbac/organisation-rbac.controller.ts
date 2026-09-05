import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import {
  createOrganisationRoleSchema,
  updateOrganisationRoleSchema,
  type CreateOrganisationRoleInput,
  type UpdateOrganisationRoleInput,
} from "@nexora/validation";
import type { AccessTokenPayload } from "@nexora/types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { CurrentOrganisationId } from "../common/decorators/current-organisation-id.decorator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { OrganisationRbacService } from "./organisation-rbac.service";

@ApiTags("organisation-rbac")
@UseGuards(PermissionsGuard)
@Controller("organisation")
export class OrganisationRbacController {
  constructor(private readonly rbac: OrganisationRbacService) {}

  @RequirePermissions("org_roles:read")
  @Get("roles")
  listRoles(@CurrentOrganisationId() organisationId: string) {
    return this.rbac.listRoles(organisationId);
  }

  @RequirePermissions("org_roles:read")
  @Get("permissions")
  listPermissions() {
    return this.rbac.listPermissions();
  }

  @RequirePermissions("org_roles:manage")
  @Post("roles")
  createRole(
    @CurrentOrganisationId() organisationId: string,
    @Body(new ZodValidationPipe(createOrganisationRoleSchema)) body: CreateOrganisationRoleInput,
    @CurrentUser() actor: AccessTokenPayload,
  ) {
    return this.rbac.createRole(organisationId, body, actor.sub);
  }

  @RequirePermissions("org_roles:manage")
  @Patch("roles/:id")
  updateRole(
    @CurrentOrganisationId() organisationId: string,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateOrganisationRoleSchema)) body: UpdateOrganisationRoleInput,
    @CurrentUser() actor: AccessTokenPayload,
  ) {
    return this.rbac.updateRole(organisationId, id, body, actor.sub);
  }

  @RequirePermissions("org_roles:manage")
  @Delete("roles/:id")
  async deleteRole(
    @CurrentOrganisationId() organisationId: string,
    @Param("id") id: string,
    @CurrentUser() actor: AccessTokenPayload,
  ) {
    await this.rbac.deleteRole(organisationId, id, actor.sub);
    return { deleted: true };
  }
}
