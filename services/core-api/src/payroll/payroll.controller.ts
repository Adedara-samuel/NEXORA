import { Body, Controller, Get, Headers, Param, Patch, Post, Put, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import {
  depositToPayrollWalletSchema,
  linkPayrollBankAccountSchema,
  paginationQuerySchema,
  runPayrollSchema,
  updateTaxSettingsSchema,
  type DepositToPayrollWalletInput,
  type LinkPayrollBankAccountInput,
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
import { ValidationApiException } from "../common/exceptions/api.exception";
import { PayrollService } from "./payroll.service";
import { PayoutsService } from "../payouts/payouts.service";

@ApiTags("payroll")
@UseGuards(PermissionsGuard)
@Controller("organisation/payroll")
export class PayrollController {
  constructor(
    private readonly payroll: PayrollService,
    private readonly payouts: PayoutsService,
  ) {}

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

  @RequirePermissions("payroll:disburse")
  @Post("runs/:id/disburse")
  disburse(@CurrentOrganisationId() organisationId: string, @Param("id") id: string, @CurrentUser() actor: AccessTokenPayload) {
    return this.payouts.disburseRun(organisationId, id, actor.sub);
  }

  @RequirePermissions("payroll:read")
  @Get("wallet")
  getWallet(@CurrentOrganisationId() organisationId: string) {
    return this.payouts.getWallet(organisationId);
  }

  @RequirePermissions("payroll:manage_wallet")
  @Get("wallet/bank-accounts")
  listBankAccounts(@CurrentOrganisationId() organisationId: string) {
    return this.payouts.listBankAccounts(organisationId);
  }

  @RequirePermissions("payroll:manage_wallet")
  @Post("wallet/bank-accounts")
  linkBankAccount(@CurrentOrganisationId() organisationId: string, @Body(new ZodValidationPipe(linkPayrollBankAccountSchema)) body: LinkPayrollBankAccountInput) {
    return this.payouts.linkBankAccount(organisationId, body.accountNumber);
  }

  /** Idempotency-Key is a REQUIRED header — this moves real money, same rule as every other financial-mutation endpoint in the ecosystem. */
  @RequirePermissions("payroll:manage_wallet")
  @Post("wallet/deposits")
  depositToWallet(
    @CurrentOrganisationId() organisationId: string,
    @Body(new ZodValidationPipe(depositToPayrollWalletSchema)) body: DepositToPayrollWalletInput,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
  ) {
    if (!idempotencyKey) throw new ValidationApiException("The Idempotency-Key header is required for this endpoint");
    return this.payouts.depositToWallet(organisationId, body.bankAccountId, body.amountMinor, idempotencyKey);
  }

  @RequirePermissions("payroll:read")
  @Get("runs/:id/reconcile")
  reconcile(@CurrentOrganisationId() organisationId: string, @Param("id") id: string) {
    return this.payouts.reconcileRun(organisationId, id);
  }
}
