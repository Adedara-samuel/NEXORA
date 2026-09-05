import { Module } from "@nestjs/common";
import { PlansController } from "./plans.controller";
import { PlansService } from "./plans.service";
import { SubscriptionsController } from "./subscriptions.controller";
import { SubscriptionsService } from "./subscriptions.service";
import { MockPaymentGateway } from "./mock-payment-gateway.service";
import { PAYMENT_GATEWAY } from "./payment-gateway.interface";
import { PermissionsGuard } from "../common/guards/permissions.guard";

@Module({
  controllers: [PlansController, SubscriptionsController],
  providers: [
    PlansService,
    SubscriptionsService,
    PermissionsGuard,
    // Swap this class to bring in a real payment provider — nothing else
    // in the billing module needs to change.
    { provide: PAYMENT_GATEWAY, useClass: MockPaymentGateway },
  ],
})
export class BillingModule {}
