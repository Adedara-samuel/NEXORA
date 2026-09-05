import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { CreateSubscriptionInput, ChangeSubscriptionPlanInput } from "@nexora/validation";
import type { Invoice, Subscription, SubscriptionStatus } from "@nexora/types";
import type { BillingCycle as PrismaBillingCycle, Invoice as PrismaInvoice, Subscription as PrismaSubscription } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ConflictApiException, NotFoundApiException, ValidationApiException } from "../common/exceptions/api.exception";
import { PAYMENT_GATEWAY, type PaymentGateway } from "./payment-gateway.interface";

/** No scheduler exists yet to flip subscriptions automatically — every read
 * re-derives and self-heals the stored status against the current date. */
const GRACE_PERIOD_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

const BILLING_CYCLE_DAYS: Record<PrismaBillingCycle, number> = { MONTHLY: 30, ANNUALLY: 365 };

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_GATEWAY) private readonly paymentGateway: PaymentGateway,
  ) {}

  async getByOrganisation(organisationId: string): Promise<Subscription> {
    const subscription = await this.findRawByOrganisation(organisationId);
    const refreshed = await this.refreshStatus(subscription);
    return this.toSubscription(refreshed);
  }

  async create(organisationId: string, input: CreateSubscriptionInput, actorId: string): Promise<Subscription> {
    const organisation = await this.prisma.organisation.findUnique({ where: { id: organisationId } });
    if (!organisation) throw new NotFoundApiException("Organisation not found", "ORGANISATION_NOT_FOUND");

    const existing = await this.prisma.subscription.findUnique({ where: { organisationId } });
    if (existing) throw new ConflictApiException("This organisation already has a subscription", "SUBSCRIPTION_EXISTS");

    const plan = await this.prisma.plan.findUnique({ where: { id: input.planId } });
    if (!plan) throw new NotFoundApiException("Plan not found", "PLAN_NOT_FOUND");
    if (!plan.isActive) throw new ValidationApiException("This plan is not active and cannot be assigned");

    const now = new Date();
    const periodEnd = this.addCycle(now, plan.billingCycle);

    const subscription = await this.prisma.subscription.create({
      data: {
        organisationId,
        planId: plan.id,
        status: input.status,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        actorType: "PLATFORM_USER",
        organisationId,
        action: "SUBSCRIPTION_CREATED",
        resourceType: "Subscription",
        resourceId: subscription.id,
        metadata: { planId: plan.id, planName: plan.name, status: subscription.status },
      },
    });

    return this.toSubscription(subscription);
  }

  async changePlan(organisationId: string, input: ChangeSubscriptionPlanInput, actorId: string): Promise<Subscription> {
    const subscription = await this.findRawByOrganisation(organisationId);
    const plan = await this.prisma.plan.findUnique({ where: { id: input.planId } });
    if (!plan) throw new NotFoundApiException("Plan not found", "PLAN_NOT_FOUND");
    if (!plan.isActive) throw new ValidationApiException("This plan is not active and cannot be assigned");

    const updated = await this.prisma.subscription.update({ where: { id: subscription.id }, data: { planId: plan.id } });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        actorType: "PLATFORM_USER",
        organisationId,
        action: "SUBSCRIPTION_PLAN_CHANGED",
        resourceType: "Subscription",
        resourceId: subscription.id,
        metadata: { from: subscription.planId, to: plan.id },
      },
    });

    return this.toSubscription(await this.refreshStatus(updated));
  }

  async renew(organisationId: string, simulateFailure: boolean, actorId: string): Promise<{ subscription: Subscription; invoice: Invoice }> {
    const subscription = await this.findRawByOrganisation(organisationId);
    const plan = await this.prisma.plan.findUniqueOrThrow({ where: { id: subscription.planId } });

    const now = new Date();
    const periodStart = subscription.currentPeriodEnd > now ? subscription.currentPeriodEnd : now;
    const periodEnd = this.addCycle(periodStart, plan.billingCycle);
    const reference = randomUUID();

    const chargeResult = simulateFailure
      ? { success: false as const, providerReference: `SIMULATED-${reference}`, failureReason: "Simulated failure (mock gateway)" }
      : await this.paymentGateway.charge({
          amountMinor: plan.priceMinor,
          currency: plan.currency,
          reference,
          organisationId,
          description: `Renewal — ${plan.name}`,
        });

    const invoice = await this.prisma.invoice.create({
      data: {
        subscriptionId: subscription.id,
        organisationId,
        receiptNumber: this.generateReceiptNumber(),
        amountMinor: plan.priceMinor,
        currency: plan.currency,
        status: chargeResult.success ? "PAID" : "FAILED",
        periodStart,
        periodEnd,
        paymentReference: chargeResult.providerReference,
        failureReason: chargeResult.success ? undefined : chargeResult.failureReason,
        paidAt: chargeResult.success ? now : undefined,
      },
    });

    let updatedSubscription = subscription;
    if (chargeResult.success) {
      updatedSubscription = await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: "ACTIVE", currentPeriodStart: periodStart, currentPeriodEnd: periodEnd, gracePeriodEndsAt: null },
      });
    }

    await this.prisma.auditLog.create({
      data: {
        actorId,
        actorType: "PLATFORM_USER",
        organisationId,
        action: chargeResult.success ? "SUBSCRIPTION_RENEWED" : "SUBSCRIPTION_RENEWAL_FAILED",
        resourceType: "Subscription",
        resourceId: subscription.id,
        metadata: { invoiceId: invoice.id, amountMinor: plan.priceMinor, currency: plan.currency },
      },
    });

    return {
      subscription: this.toSubscription(chargeResult.success ? updatedSubscription : await this.refreshStatus(updatedSubscription)),
      invoice: this.toInvoice(invoice),
    };
  }

  async cancel(organisationId: string, actorId: string): Promise<Subscription> {
    const subscription = await this.findRawByOrganisation(organisationId);
    const updated = await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: "CANCELLED", cancelAtPeriodEnd: true },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        actorType: "PLATFORM_USER",
        organisationId,
        action: "SUBSCRIPTION_CANCELLED",
        resourceType: "Subscription",
        resourceId: subscription.id,
      },
    });

    return this.toSubscription(updated);
  }

  async listInvoices(organisationId: string): Promise<Invoice[]> {
    const invoices = await this.prisma.invoice.findMany({ where: { organisationId }, orderBy: { createdAt: "desc" } });
    return invoices.map((invoice) => this.toInvoice(invoice));
  }

  async findInvoiceById(id: string): Promise<Invoice> {
    const invoice = await this.prisma.invoice.findUnique({ where: { id } });
    if (!invoice) throw new NotFoundApiException("Invoice not found", "INVOICE_NOT_FOUND");
    return this.toInvoice(invoice);
  }

  private async findRawByOrganisation(organisationId: string): Promise<PrismaSubscription> {
    const subscription = await this.prisma.subscription.findUnique({ where: { organisationId } });
    if (!subscription) throw new NotFoundApiException("This organisation has no subscription yet", "SUBSCRIPTION_NOT_FOUND");
    return subscription;
  }

  /** Recomputes the effective status from dates and persists it if it changed. */
  private async refreshStatus(subscription: PrismaSubscription): Promise<PrismaSubscription> {
    if (subscription.status === "CANCELLED") return subscription;

    const now = new Date();
    const graceEnd = subscription.gracePeriodEndsAt ?? new Date(subscription.currentPeriodEnd.getTime() + GRACE_PERIOD_DAYS * DAY_MS);

    let effective: SubscriptionStatus;
    if (now <= subscription.currentPeriodEnd) {
      effective = subscription.status === "TRIALING" ? "TRIALING" : "ACTIVE";
    } else if (now <= graceEnd) {
      effective = "GRACE_PERIOD";
    } else {
      effective = "SUSPENDED";
    }

    const enteringGrace = effective === "GRACE_PERIOD" && !subscription.gracePeriodEndsAt;
    if (effective === subscription.status && !enteringGrace) return subscription;

    const updated = await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: effective, gracePeriodEndsAt: enteringGrace ? graceEnd : subscription.gracePeriodEndsAt },
    });

    if (effective !== subscription.status) {
      await this.prisma.auditLog.create({
        data: {
          actorType: "SYSTEM",
          organisationId: subscription.organisationId,
          action: `SUBSCRIPTION_${effective}`,
          resourceType: "Subscription",
          resourceId: subscription.id,
          metadata: { from: subscription.status, to: effective },
        },
      });
    }

    return updated;
  }

  private addCycle(from: Date, billingCycle: PrismaBillingCycle): Date {
    return new Date(from.getTime() + BILLING_CYCLE_DAYS[billingCycle] * DAY_MS);
  }

  private generateReceiptNumber(): string {
    const yearMonth = new Date().toISOString().slice(0, 7).replace("-", "");
    return `INV-${yearMonth}-${randomUUID().slice(0, 8).toUpperCase()}`;
  }

  private toSubscription(subscription: PrismaSubscription): Subscription {
    return {
      id: subscription.id,
      organisationId: subscription.organisationId,
      planId: subscription.planId,
      status: subscription.status,
      currentPeriodStart: subscription.currentPeriodStart.toISOString(),
      currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
      gracePeriodEndsAt: subscription.gracePeriodEndsAt?.toISOString() ?? null,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      createdAt: subscription.createdAt.toISOString(),
      updatedAt: subscription.updatedAt.toISOString(),
    };
  }

  private toInvoice(invoice: PrismaInvoice): Invoice {
    return {
      id: invoice.id,
      subscriptionId: invoice.subscriptionId,
      organisationId: invoice.organisationId,
      receiptNumber: invoice.receiptNumber,
      amountMinor: invoice.amountMinor,
      currency: invoice.currency,
      status: invoice.status,
      periodStart: invoice.periodStart.toISOString(),
      periodEnd: invoice.periodEnd.toISOString(),
      paymentReference: invoice.paymentReference,
      failureReason: invoice.failureReason,
      paidAt: invoice.paidAt?.toISOString() ?? null,
      createdAt: invoice.createdAt.toISOString(),
    };
  }
}
