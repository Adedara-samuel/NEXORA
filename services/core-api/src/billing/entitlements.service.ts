import { Injectable } from "@nestjs/common";
import type { OrganisationEntitlements } from "@nexora/types";
import { PrismaService } from "../prisma/prisma.service";
import { NotFoundApiException, ValidationApiException } from "../common/exceptions/api.exception";

/**
 * The single computation of "what can this organisation actually do right
 * now" — read by OrganisationAccessGuard (to enforce it), by the
 * organisation-side billing summary (to explain it), and by the Control
 * Center's access-preview (to show it before it's enforced). One
 * implementation, three readers — never re-derive this logic elsewhere.
 *
 * A subscription only grants modules while it's TRIALING, ACTIVE, or
 * GRACE_PERIOD (still working, possibly overdue) — SUSPENDED, CANCELLED, or
 * no subscription at all grants nothing. On top of that, the organisation
 * itself must be ACTIVE — PENDING/SUSPENDED/ARCHIVED zeroes out every
 * module regardless of what's paid for, mirroring the platform's own
 * "organisations:manage_status" kill switch actually meaning something.
 */
const MODULE_GRANTING_SUBSCRIPTION_STATUSES = new Set(["TRIALING", "ACTIVE", "GRACE_PERIOD"]);

@Injectable()
export class EntitlementsService {
  constructor(private readonly prisma: PrismaService) {}

  async getEffectiveModuleKeys(organisationId: string): Promise<Set<string>> {
    const entitlements = await this.getEntitlements(organisationId);
    return new Set(entitlements.effectiveModuleKeys);
  }

  async getEntitlements(organisationId: string): Promise<OrganisationEntitlements> {
    const organisation = await this.prisma.organisation.findUnique({
      where: { id: organisationId },
      include: {
        subscription: { include: { plan: { include: { modules: { include: { module: true } } } } } },
        moduleOverrides: { include: { module: true } },
      },
    });
    if (!organisation) throw new NotFoundApiException("Organisation not found", "ORGANISATION_NOT_FOUND");

    const subscription = organisation.subscription;
    const plan = subscription?.plan ?? null;
    const planModuleKeys = plan ? plan.modules.map((planModule) => planModule.module.key) : [];

    const grants = new Set(organisation.moduleOverrides.filter((override) => override.granted).map((override) => override.module.key));
    const revokes = new Set(organisation.moduleOverrides.filter((override) => !override.granted).map((override) => override.module.key));

    const subscriptionUsable = subscription !== null && MODULE_GRANTING_SUBSCRIPTION_STATUSES.has(subscription.status);
    const organisationUsable = organisation.status === "ACTIVE";

    const effectiveModuleKeys =
      organisationUsable && subscriptionUsable
        ? Array.from(new Set([...planModuleKeys.filter((key) => !revokes.has(key)), ...grants]))
        : [];

    return {
      organisationStatus: organisation.status,
      subscriptionStatus: subscription?.status ?? null,
      planId: plan?.id ?? null,
      planName: plan?.name ?? null,
      planModuleKeys,
      effectiveModuleKeys,
      overrides: organisation.moduleOverrides.map((override) => ({
        moduleKey: override.module.key,
        granted: override.granted,
        reason: override.reason,
      })),
      currentPeriodEnd: subscription?.currentPeriodEnd.toISOString() ?? null,
      gracePeriodEndsAt: subscription?.gracePeriodEndsAt?.toISOString() ?? null,
    };
  }

  /** granted: true = force-grant, false = force-revoke, null = clear the override and fall back to the plan. */
  async setOverride(organisationId: string, moduleKey: string, granted: boolean | null, reason: string | undefined, actorId: string): Promise<OrganisationEntitlements> {
    const organisation = await this.prisma.organisation.findUnique({ where: { id: organisationId } });
    if (!organisation) throw new NotFoundApiException("Organisation not found", "ORGANISATION_NOT_FOUND");

    const module = await this.prisma.module.findUnique({ where: { key: moduleKey } });
    if (!module) throw new ValidationApiException("Unknown module key", { moduleKey });

    if (granted === null) {
      await this.prisma.organisationModuleOverride.deleteMany({ where: { organisationId, moduleId: module.id } });
    } else {
      await this.prisma.organisationModuleOverride.upsert({
        where: { organisationId_moduleId: { organisationId, moduleId: module.id } },
        update: { granted, reason: reason ?? null, createdById: actorId },
        create: { organisationId, moduleId: module.id, granted, reason: reason ?? null, createdById: actorId },
      });
    }

    await this.prisma.auditLog.create({
      data: {
        actorId,
        actorType: "PLATFORM_USER",
        organisationId,
        action: granted === null ? "ORGANISATION_MODULE_OVERRIDE_CLEARED" : granted ? "ORGANISATION_MODULE_OVERRIDE_GRANTED" : "ORGANISATION_MODULE_OVERRIDE_REVOKED",
        resourceType: "Module",
        resourceId: module.id,
        metadata: { moduleKey, reason: reason ?? null },
      },
    });

    return this.getEntitlements(organisationId);
  }
}
