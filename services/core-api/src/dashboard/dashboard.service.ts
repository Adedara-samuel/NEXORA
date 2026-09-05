import { Injectable } from "@nestjs/common";
import type { AccessTokenPayload, DashboardSummary } from "@nexora/types";
import type { OrganisationStatus, PlatformUserStatus, SubscriptionStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

const ORGANISATION_STATUSES: OrganisationStatus[] = ["PENDING", "ACTIVE", "SUSPENDED", "ARCHIVED"];
const PLATFORM_USER_STATUSES: PlatformUserStatus[] = ["ACTIVE", "DISABLED"];
const SUBSCRIPTION_STATUSES: SubscriptionStatus[] = ["TRIALING", "ACTIVE", "GRACE_PERIOD", "SUSPENDED", "CANCELLED"];

function zeroFilledRecord<K extends string>(keys: K[]): Record<K, number> {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>;
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Every section is computed only if the caller's permissions allow it —
   * one shared endpoint, but a SUPPORT user never receives billing numbers
   * even though this service method runs for every role.
   */
  async getSummary(actor: AccessTokenPayload): Promise<DashboardSummary> {
    const permissions = new Set(actor.permissions ?? []);
    const summary: DashboardSummary = {};

    if (permissions.has("organisations:read")) {
      summary.organisations = await this.getOrganisationsSummary();
    }
    if (permissions.has("platform_users:read")) {
      summary.platformUsers = await this.getPlatformUsersSummary();
    }
    if (permissions.has("platform_roles:read")) {
      summary.roles = { total: await this.prisma.platformRole.count() };
    }
    if (permissions.has("billing:read")) {
      summary.billing = await this.getBillingSummary();
    }
    if (
      permissions.has("organisations:read") ||
      permissions.has("platform_users:read") ||
      permissions.has("platform_roles:read") ||
      permissions.has("billing:read")
    ) {
      summary.recentActivity = await this.getRecentActivity();
    }

    return summary;
  }

  private async getOrganisationsSummary(): Promise<NonNullable<DashboardSummary["organisations"]>> {
    const grouped = await this.prisma.organisation.groupBy({ by: ["status"], _count: true });
    const byStatus = zeroFilledRecord(ORGANISATION_STATUSES);
    let total = 0;
    for (const row of grouped) {
      byStatus[row.status] = row._count;
      total += row._count;
    }
    return { total, byStatus };
  }

  private async getPlatformUsersSummary(): Promise<NonNullable<DashboardSummary["platformUsers"]>> {
    const grouped = await this.prisma.platformUser.groupBy({ by: ["status"], _count: true });
    const byStatus = zeroFilledRecord(PLATFORM_USER_STATUSES);
    let total = 0;
    for (const row of grouped) {
      byStatus[row.status] = row._count;
      total += row._count;
    }
    return { total, byStatus };
  }

  private async getBillingSummary(): Promise<NonNullable<DashboardSummary["billing"]>> {
    const grouped = await this.prisma.subscription.groupBy({ by: ["status"], _count: true });
    const subscriptionsByStatus = zeroFilledRecord(SUBSCRIPTION_STATUSES);
    for (const row of grouped) {
      subscriptionsByStatus[row.status] = row._count;
    }

    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const revenue = await this.prisma.invoice.aggregate({
      _sum: { amountMinor: true },
      where: { status: "PAID", paidAt: { gte: startOfMonth } },
    });

    return {
      activeSubscriptions: subscriptionsByStatus.ACTIVE,
      subscriptionsByStatus,
      // Single-currency assumption for this phase — see docs/phase-3-module-subscription-engine.md.
      revenueThisMonthMinor: revenue._sum.amountMinor ?? 0,
      currency: "NGN",
    };
  }

  private async getRecentActivity(): Promise<NonNullable<DashboardSummary["recentActivity"]>> {
    const logs = await this.prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 15 });
    return logs.map((log) => ({
      id: log.id,
      action: log.action,
      resourceType: log.resourceType,
      resourceId: log.resourceId,
      organisationId: log.organisationId,
      createdAt: log.createdAt.toISOString(),
    }));
  }
}
