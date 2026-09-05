import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { createBranchSchema, createDepartmentSchema, type CreateBranchInput, type CreateDepartmentInput } from "@nexora/validation";
import type { AccessTokenPayload } from "@nexora/types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { CurrentOrganisationId } from "../common/decorators/current-organisation-id.decorator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { OrganisationStructureService } from "./organisation-structure.service";

@ApiTags("organisation-structure")
@UseGuards(PermissionsGuard)
@Controller("organisation")
export class OrganisationStructureController {
  constructor(private readonly structure: OrganisationStructureService) {}

  @RequirePermissions("departments:read")
  @Get("departments")
  listDepartments(@CurrentOrganisationId() organisationId: string) {
    return this.structure.listDepartments(organisationId);
  }

  @RequirePermissions("departments:manage")
  @Post("departments")
  createDepartment(
    @CurrentOrganisationId() organisationId: string,
    @Body(new ZodValidationPipe(createDepartmentSchema)) body: CreateDepartmentInput,
    @CurrentUser() actor: AccessTokenPayload,
  ) {
    return this.structure.createDepartment(organisationId, body, actor.sub);
  }

  @RequirePermissions("branches:read")
  @Get("branches")
  listBranches(@CurrentOrganisationId() organisationId: string) {
    return this.structure.listBranches(organisationId);
  }

  @RequirePermissions("branches:manage")
  @Post("branches")
  createBranch(
    @CurrentOrganisationId() organisationId: string,
    @Body(new ZodValidationPipe(createBranchSchema)) body: CreateBranchInput,
    @CurrentUser() actor: AccessTokenPayload,
  ) {
    return this.structure.createBranch(organisationId, body, actor.sub);
  }
}
