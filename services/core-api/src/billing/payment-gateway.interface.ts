export interface ChargeInput {
  amountMinor: number;
  currency: string;
  reference: string;
  organisationId: string;
  description: string;
}

export interface ChargeResult {
  success: boolean;
  providerReference: string;
  failureReason?: string;
}

/**
 * Every real payment provider (Paystack, Flutterwave, etc.) implements this
 * same interface — swap the class bound to PAYMENT_GATEWAY in billing.module.ts
 * and nothing else in the billing module changes.
 */
export interface PaymentGateway {
  charge(input: ChargeInput): Promise<ChargeResult>;
}

export const PAYMENT_GATEWAY = Symbol("PAYMENT_GATEWAY");
