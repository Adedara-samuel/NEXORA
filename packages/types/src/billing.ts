export type BillingCycle = "MONTHLY" | "ANNUALLY";
export type SubscriptionStatus = "TRIALING" | "ACTIVE" | "GRACE_PERIOD" | "SUSPENDED" | "CANCELLED";
export type InvoiceStatus = "PENDING" | "PAID" | "FAILED";

export interface ModuleCatalogEntry {
  id: string;
  key: string;
  name: string;
  description: string | null;
}

export interface Plan {
  id: string;
  name: string;
  description: string | null;
  priceMinor: number;
  currency: string;
  billingCycle: BillingCycle;
  isActive: boolean;
  moduleKeys: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Subscription {
  id: string;
  organisationId: string;
  planId: string;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  gracePeriodEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Invoice {
  id: string;
  subscriptionId: string;
  organisationId: string;
  receiptNumber: string;
  amountMinor: number;
  currency: string;
  status: InvoiceStatus;
  periodStart: string;
  periodEnd: string;
  paymentReference: string | null;
  failureReason: string | null;
  paidAt: string | null;
  createdAt: string;
}
