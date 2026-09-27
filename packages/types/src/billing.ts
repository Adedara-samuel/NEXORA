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

/**
 * What an organisation can ACTUALLY do right now — the single computed
 * result of combining its Plan's modules with any per-organisation
 * overrides and its own/its subscription's lifecycle status. This is the
 * one shape every layer (the API guard, the organisation-side "why can't I
 * see this" banner, and the Control Center's access-preview) reads, so
 * there is exactly one definition of "entitled."
 */
export interface OrganisationEntitlements {
  organisationStatus: "PENDING" | "ACTIVE" | "SUSPENDED" | "ARCHIVED";
  subscriptionStatus: SubscriptionStatus | null;
  planId: string | null;
  planName: string | null;
  /** Modules included by the plan itself, before overrides. */
  planModuleKeys: string[];
  /** The final, effective set — plan modules, plus grants, minus revokes. Empty whenever the organisation isn't ACTIVE or has no usable subscription. */
  effectiveModuleKeys: string[];
  overrides: { moduleKey: string; granted: boolean; reason: string | null }[];
  currentPeriodEnd: string | null;
  gracePeriodEndsAt: string | null;
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
