import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import {
  createOrganisationSchema,
  listOrganisationsQuerySchema,
  updateOrganisationSchema,
  updateOrganisationStatusSchema,
  type CreateOrganisationInput,
  type ListOrganisationsQuery,
  type UpdateOrganisationInput,
  type UpdateOrganisationStatusInput,
} from "@nexora/validation";
import type { AccessTokenPayload } from "@nexora/types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { OrganisationsService } from "./organisations.service";

@ApiTags("organisations")
@UseGuards(PermissionsGuard)
@Controller("organisations")
export class OrganisationsController {
  constructor(private readonly organisations: OrganisationsService) {}

  @RequirePermissions("organisations:read")
  @Get()
  list(@Query(new ZodValidationPipe(listOrganisationsQuerySchema)) query: ListOrganisationsQuery) {
    return this.organisations.list(query);
  }

  @RequirePermissions("organisations:read")
  @Get(":id")
  findById(@Param("id") id: string) {
    return this.organisations.findById(id);
  }

  @RequirePermissions("organisations:create")
  @Post()
  create(
    @Body(new ZodValidationPipe(createOrganisationSchema)) body: CreateOrganisationInput,
    @CurrentUser() actor: AccessTokenPayload,
  ) {
    return this.organisations.create(body, actor.sub);
  }

  @RequirePermissions("organisations:update")
  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateOrganisationSchema)) body: UpdateOrganisationInput,
    @CurrentUser() actor: AccessTokenPayload,
  ) {
    return this.organisations.update(id, body, actor.sub);
  }

  @RequirePermissions("organisations:manage_status")
  @Patch(":id/status")
  updateStatus(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateOrganisationStatusSchema)) body: UpdateOrganisationStatusInput,
    @CurrentUser() actor: AccessTokenPayload,
  ) {
    return this.organisations.updateStatus(id, body, actor.sub);
  }
}
