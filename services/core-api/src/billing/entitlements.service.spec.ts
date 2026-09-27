import { EntitlementsService } from "./entitlements.service";
import { NotFoundApiException, ValidationApiException } from "../common/exceptions/api.exception";

/**
 * Regression tests for the single computation every layer (the access
 * guard, the organisation's own "why am I locked out" summary, and the
 * Control Center's access-preview) reads: what modules an organisation can
 * actually use right now, once its plan, any per-module overrides, its own
 * lifecycle status, and its subscription's status are all combined.
 */

const PLAN = { id: "plan-1", name: "Growth", modules: [{ module: { key: "employees" } }, { module: { key: "attendance" } }] };

function makeOrganisation(overrides: Record<string, unknown> = {}) {
  return {
    status: "ACTIVE",
    subscription: { status: "ACTIVE", plan: PLAN, currentPeriodEnd: new Date("2026-10-01"), gracePeriodEndsAt: null },
    moduleOverrides: [] as { granted: boolean; module: { key: string }; reason: string | null }[],
    ...overrides,
  };
}

function makeService(organisation: unknown) {
  const prisma = {
    organisation: { findUnique: jest.fn().mockResolvedValue(organisation) },
    module: { findUnique: jest.fn() },
    organisationModuleOverride: { upsert: jest.fn(), deleteMany: jest.fn() },
    auditLog: { create: jest.fn() },
  };
  return { service: new EntitlementsService(prisma as never), prisma };
}

describe("EntitlementsService.getEntitlements", () => {
  it("grants exactly the plan's modules when there are no overrides", async () => {
    const { service } = makeService(makeOrganisation());
    const result = await service.getEntitlements("org-1");
    expect(result.effectiveModuleKeys.sort()).toEqual(["attendance", "employees"]);
    expect(result.planName).toBe("Growth");
  });

  it("adds a granted override even though the plan doesn't include it", async () => {
    const organisation = makeOrganisation({ moduleOverrides: [{ granted: true, module: { key: "payroll" }, reason: "pilot" }] });
    const { service } = makeService(organisation);
    const result = await service.getEntitlements("org-1");
    expect(result.effectiveModuleKeys.sort()).toEqual(["attendance", "employees", "payroll"]);
  });

  it("removes a revoked override even though the plan includes it", async () => {
    const organisation = makeOrganisation({ moduleOverrides: [{ granted: false, module: { key: "attendance" }, reason: "dispute" }] });
    const { service } = makeService(organisation);
    const result = await service.getEntitlements("org-1");
    expect(result.effectiveModuleKeys).toEqual(["employees"]);
  });

  it("zeroes every module when the organisation itself isn't ACTIVE, regardless of plan or grants", async () => {
    const organisation = makeOrganisation({ status: "SUSPENDED", moduleOverrides: [{ granted: true, module: { key: "payroll" }, reason: null }] });
    const { service } = makeService(organisation);
    const result = await service.getEntitlements("org-1");
    expect(result.effectiveModuleKeys).toEqual([]);
  });

  it.each(["SUSPENDED", "CANCELLED"])("zeroes every module when the subscription is %s", async (status) => {
    const organisation = makeOrganisation({ subscription: { status, plan: PLAN, currentPeriodEnd: new Date(), gracePeriodEndsAt: null } });
    const { service } = makeService(organisation);
    const result = await service.getEntitlements("org-1");
    expect(result.effectiveModuleKeys).toEqual([]);
  });

  it("still grants modules during GRACE_PERIOD — overdue, not yet cut off", async () => {
    const organisation = makeOrganisation({ subscription: { status: "GRACE_PERIOD", plan: PLAN, currentPeriodEnd: new Date(), gracePeriodEndsAt: new Date() } });
    const { service } = makeService(organisation);
    const result = await service.getEntitlements("org-1");
    expect(result.effectiveModuleKeys.sort()).toEqual(["attendance", "employees"]);
  });

  it("zeroes every module when there is no subscription at all", async () => {
    const { service } = makeService(makeOrganisation({ subscription: null }));
    const result = await service.getEntitlements("org-1");
    expect(result.effectiveModuleKeys).toEqual([]);
    expect(result.subscriptionStatus).toBeNull();
  });

  it("throws NotFoundApiException for an unknown organisation", async () => {
    const { service } = makeService(null);
    await expect(service.getEntitlements("missing")).rejects.toBeInstanceOf(NotFoundApiException);
  });
});

describe("EntitlementsService.setOverride", () => {
  it("upserts a grant and audit-logs it", async () => {
    const { service, prisma } = makeService(makeOrganisation());
    prisma.module.findUnique.mockResolvedValue({ id: "module-1", key: "payroll" });
    await service.setOverride("org-1", "payroll", true, "pilot", "actor-1");
    expect(prisma.organisationModuleOverride.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: expect.objectContaining({ granted: true, reason: "pilot" }) }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "ORGANISATION_MODULE_OVERRIDE_GRANTED" }) }));
  });

  it("clears an override when granted is null instead of upserting", async () => {
    const { service, prisma } = makeService(makeOrganisation());
    prisma.module.findUnique.mockResolvedValue({ id: "module-1", key: "payroll" });
    await service.setOverride("org-1", "payroll", null, undefined, "actor-1");
    expect(prisma.organisationModuleOverride.deleteMany).toHaveBeenCalled();
    expect(prisma.organisationModuleOverride.upsert).not.toHaveBeenCalled();
  });

  it("rejects an unknown module key without touching the database", async () => {
    const { service, prisma } = makeService(makeOrganisation());
    prisma.module.findUnique.mockResolvedValue(null);
    await expect(service.setOverride("org-1", "not-a-module", true, undefined, "actor-1")).rejects.toBeInstanceOf(ValidationApiException);
    expect(prisma.organisationModuleOverride.upsert).not.toHaveBeenCalled();
  });
});
