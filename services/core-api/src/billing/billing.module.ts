import { Module } from "@nestjs/common";
import { PlansController } from "./plans.controller";
import { PlansService } from "./plans.service";
import { SubscriptionsController } from "./subscriptions.controller";
import { SubscriptionsService } from "./subscriptions.service";
import { EntitlementsController } from "./entitlements.controller";
import { OrganisationBillingController } from "./organisation-billing.controller";
import { EntitlementsService } from "./entitlements.service";
import { MockPaymentGateway } from "./mock-payment-gateway.service";
import { PAYMENT_GATEWAY } from "./payment-gateway.interface";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { OrganisationAccessGuard } from "../common/guards/organisation-access.guard";

@Module({
  controllers: [PlansController, SubscriptionsController, EntitlementsController, OrganisationBillingController],
  providers: [
    PlansService,
    SubscriptionsService,
    EntitlementsService,
    PermissionsGuard,
    OrganisationAccessGuard,
    // Swap this class to bring in a real payment provider — nothing else
    // in the billing module needs to change.
    { provide: PAYMENT_GATEWAY, useClass: MockPaymentGateway },
  ],
  exports: [EntitlementsService],
})
export class BillingModule {}
