import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import {
  createEmployeeSchema,
  listEmployeesQuerySchema,
  updateEmployeeSchema,
  type CreateEmployeeInput,
  type ListEmployeesQuery,
  type UpdateEmployeeInput,
} from "@nexora/validation";
import type { AccessTokenPayload } from "@nexora/types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { CurrentOrganisationId } from "../common/decorators/current-organisation-id.decorator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { RequireModule } from "../common/decorators/require-module.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { OrganisationAccessGuard } from "../common/guards/organisation-access.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { EmployeesService } from "./employees.service";

@ApiTags("employees")
@UseGuards(PermissionsGuard, OrganisationAccessGuard)
@RequireModule("employees")
@Controller("organisation/employees")
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @RequirePermissions("employees:read")
  @Get()
  list(@CurrentOrganisationId() organisationId: string, @Query(new ZodValidationPipe(listEmployeesQuerySchema)) query: ListEmployeesQuery) {
    return this.employees.list(organisationId, query);
  }

  @RequirePermissions("employees:read")
  @Get(":id")
  findById(@CurrentOrganisationId() organisationId: string, @Param("id") id: string) {
    return this.employees.findById(organisationId, id);
  }

  @RequirePermissions("employees:create")
  @Post()
  create(
    @CurrentOrganisationId() organisationId: string,
    @Body(new ZodValidationPipe(createEmployeeSchema)) body: CreateEmployeeInput,
    @CurrentUser() actor: AccessTokenPayload,
  ) {
    return this.employees.create(organisationId, body, actor.sub);
  }

  @RequirePermissions("employees:update")
  @Patch(":id")
  update(
    @CurrentOrganisationId() organisationId: string,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateEmployeeSchema)) body: UpdateEmployeeInput,
    @CurrentUser() actor: AccessTokenPayload,
  ) {
    return this.employees.update(organisationId, id, body, actor.sub);
  }
}
