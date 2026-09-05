import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import {
  createOrganisationUserSchema,
  listOrganisationUsersQuerySchema,
  updateOrganisationUserSchema,
  type CreateOrganisationUserInput,
  type ListOrganisationUsersQuery,
  type UpdateOrganisationUserInput,
} from "@nexora/validation";
import type { AccessTokenPayload } from "@nexora/types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { CurrentOrganisationId } from "../common/decorators/current-organisation-id.decorator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { OrganisationUsersService } from "./organisation-users.service";

@ApiTags("organisation-users")
@UseGuards(PermissionsGuard)
@Controller("organisation/users")
export class OrganisationUsersController {
  constructor(private readonly organisationUsers: OrganisationUsersService) {}

  @Get("me")
  getMe(@CurrentOrganisationId() organisationId: string, @CurrentUser() actor: AccessTokenPayload) {
    return this.organisationUsers.findById(organisationId, actor.sub);
  }

  @RequirePermissions("org_users:read")
  @Get()
  list(@CurrentOrganisationId() organisationId: string, @Query(new ZodValidationPipe(listOrganisationUsersQuerySchema)) query: ListOrganisationUsersQuery) {
    return this.organisationUsers.list(organisationId, query);
  }

  @RequirePermissions("org_users:read")
  @Get(":id")
  findById(@CurrentOrganisationId() organisationId: string, @Param("id") id: string) {
    return this.organisationUsers.findById(organisationId, id);
  }

  @RequirePermissions("org_users:create")
  @Post()
  create(
    @CurrentOrganisationId() organisationId: string,
    @Body(new ZodValidationPipe(createOrganisationUserSchema)) body: CreateOrganisationUserInput,
    @CurrentUser() actor: AccessTokenPayload,
  ) {
    return this.organisationUsers.create(organisationId, body, actor.sub);
  }

  @RequirePermissions("org_users:update")
  @Patch(":id")
  update(
    @CurrentOrganisationId() organisationId: string,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateOrganisationUserSchema)) body: UpdateOrganisationUserInput,
    @CurrentUser() actor: AccessTokenPayload,
  ) {
    return this.organisationUsers.update(organisationId, id, body, actor.sub);
  }
}
