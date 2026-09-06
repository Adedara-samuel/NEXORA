import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import {
  createComplianceRecordSchema,
  listComplianceRecordsQuerySchema,
  updateComplianceRecordSchema,
  type CreateComplianceRecordInput,
  type ListComplianceRecordsQuery,
  type UpdateComplianceRecordInput,
} from "@nexora/validation";
import type { AccessTokenPayload } from "@nexora/types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { CurrentOrganisationId } from "../common/decorators/current-organisation-id.decorator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { ComplianceService } from "./compliance.service";

@ApiTags("compliance")
@UseGuards(PermissionsGuard)
@Controller("organisation/compliance")
export class ComplianceController {
  constructor(private readonly compliance: ComplianceService) {}

  @RequirePermissions("compliance:read")
  @Get()
  list(@CurrentOrganisationId() organisationId: string, @Query(new ZodValidationPipe(listComplianceRecordsQuerySchema)) query: ListComplianceRecordsQuery) {
    return this.compliance.list(organisationId, query);
  }

  @RequirePermissions("compliance:read")
  @Get(":id")
  findById(@CurrentOrganisationId() organisationId: string, @Param("id") id: string) {
    return this.compliance.findById(organisationId, id);
  }

  @RequirePermissions("compliance:create")
  @Post()
  create(
    @CurrentOrganisationId() organisationId: string,
    @Body(new ZodValidationPipe(createComplianceRecordSchema)) body: CreateComplianceRecordInput,
    @CurrentUser() actor: AccessTokenPayload,
  ) {
    return this.compliance.create(organisationId, body, actor.sub);
  }

  @RequirePermissions("compliance:update")
  @Patch(":id")
  update(
    @CurrentOrganisationId() organisationId: string,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateComplianceRecordSchema)) body: UpdateComplianceRecordInput,
    @CurrentUser() actor: AccessTokenPayload,
  ) {
    return this.compliance.update(organisationId, id, body, actor.sub);
  }
}
