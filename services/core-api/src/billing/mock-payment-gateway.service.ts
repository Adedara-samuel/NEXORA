import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { ChargeInput, ChargeResult, PaymentGateway } from "./payment-gateway.interface";

/**
 * Placeholder until the real payment integration is built. Always succeeds —
 * there's no real card/bank to decline a charge here. Testing the failure
 * path is handled one layer up (SubscriptionsService.renew's
 * simulateFailure flag short-circuits before ever calling this gateway),
 * so this class stays a faithful stand-in for what a real provider's
 * happy path looks like.
 */
@Injectable()
export class MockPaymentGateway implements PaymentGateway {
  async charge(_input: ChargeInput): Promise<ChargeResult> {
    return { success: true, providerReference: `MOCK-${randomUUID()}` };
  }
}
