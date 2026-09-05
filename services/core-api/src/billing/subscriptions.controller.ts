import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import {
  changeSubscriptionPlanSchema,
  createSubscriptionSchema,
  renewSubscriptionSchema,
  type ChangeSubscriptionPlanInput,
  type CreateSubscriptionInput,
  type RenewSubscriptionInput,
} from "@nexora/validation";
import type { AccessTokenPayload } from "@nexora/types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { SubscriptionsService } from "./subscriptions.service";

@ApiTags("billing")
@UseGuards(PermissionsGuard)
@Controller()
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @RequirePermissions("billing:read")
  @Get("organisations/:organisationId/subscription")
  getSubscription(@Param("organisationId") organisationId: string) {
    return this.subscriptions.getByOrganisation(organisationId);
  }

  @RequirePermissions("billing:manage_subscriptions")
  @Post("organisations/:organisationId/subscription")
  create(
    @Param("organisationId") organisationId: string,
    @Body(new ZodValidationPipe(createSubscriptionSchema)) body: CreateSubscriptionInput,
    @CurrentUser() actor: AccessTokenPayload,
  ) {
    return this.subscriptions.create(organisationId, body, actor.sub);
  }

  @RequirePermissions("billing:manage_subscriptions")
  @Patch("organisations/:organisationId/subscription")
  changePlan(
    @Param("organisationId") organisationId: string,
    @Body(new ZodValidationPipe(changeSubscriptionPlanSchema)) body: ChangeSubscriptionPlanInput,
    @CurrentUser() actor: AccessTokenPayload,
  ) {
    return this.subscriptions.changePlan(organisationId, body, actor.sub);
  }

  @RequirePermissions("billing:manage_subscriptions")
  @Post("organisations/:organisationId/subscription/renew")
  async renew(
    @Param("organisationId") organisationId: string,
    @Body(new ZodValidationPipe(renewSubscriptionSchema)) body: RenewSubscriptionInput,
    @CurrentUser() actor: AccessTokenPayload,
  ) {
    return this.subscriptions.renew(organisationId, body.simulateFailure, actor.sub);
  }

  @RequirePermissions("billing:manage_subscriptions")
  @Post("organisations/:organisationId/subscription/cancel")
  cancel(@Param("organisationId") organisationId: string, @CurrentUser() actor: AccessTokenPayload) {
    return this.subscriptions.cancel(organisationId, actor.sub);
  }

  @RequirePermissions("billing:read")
  @Get("organisations/:organisationId/invoices")
  listInvoices(@Param("organisationId") organisationId: string) {
    return this.subscriptions.listInvoices(organisationId);
  }

  @RequirePermissions("billing:read")
  @Get("invoices/:id")
  findInvoiceById(@Param("id") id: string) {
    return this.subscriptions.findInvoiceById(id);
  }
}
