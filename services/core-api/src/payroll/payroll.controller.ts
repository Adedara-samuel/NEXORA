import { Body, Controller, Get, Param, Patch, Post, Put, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import {
  paginationQuerySchema,
  runPayrollSchema,
  updateTaxSettingsSchema,
  type PaginationQuery,
  type RunPayrollInput,
  type UpdateTaxSettingsInput,
} from "@nexora/validation";
import type { AccessTokenPayload } from "@nexora/types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { CurrentOrganisationId } from "../common/decorators/current-organisation-id.decorator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { PayrollService } from "./payroll.service";

@ApiTags("payroll")
@UseGuards(PermissionsGuard)
@Controller("organisation/payroll")
export class PayrollController {
  constructor(private readonly payroll: PayrollService) {}

  @RequirePermissions("payroll:read")
  @Get("tax-settings")
  getTaxSettings(@CurrentOrganisationId() organisationId: string) {
    return this.payroll.getTaxSettings(organisationId);
  }

  @RequirePermissions("payroll:manage_settings")
  @Put("tax-settings")
  updateTaxSettings(
    @CurrentOrganisationId() organisationId: string,
    @Body(new ZodValidationPipe(updateTaxSettingsSchema)) body: UpdateTaxSettingsInput,
    @CurrentUser() actor: AccessTokenPayload,
  ) {
    return this.payroll.updateTaxSettings(organisationId, body, actor.sub);
  }

  @RequirePermissions("payroll:read")
  @Get("runs")
  listRuns(@CurrentOrganisationId() organisationId: string, @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery) {
    return this.payroll.listRuns(organisationId, query);
  }

  @RequirePermissions("payroll:read")
  @Get("runs/:id")
  getRun(@CurrentOrganisationId() organisationId: string, @Param("id") id: string) {
    return this.payroll.getRun(organisationId, id);
  }

  @RequirePermissions("payroll:create")
  @Post("runs")
  run(
    @CurrentOrganisationId() organisationId: string,
    @Body(new ZodValidationPipe(runPayrollSchema)) body: RunPayrollInput,
    @CurrentUser() actor: AccessTokenPayload,
  ) {
    return this.payroll.run(organisationId, body, actor.sub);
  }

  @RequirePermissions("payroll:create")
  @Patch("runs/:id/cancel")
  cancel(@CurrentOrganisationId() organisationId: string, @Param("id") id: string, @CurrentUser() actor: AccessTokenPayload) {
    return this.payroll.cancel(organisationId, id, actor.sub);
  }
}
