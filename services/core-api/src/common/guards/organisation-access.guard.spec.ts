import type { ExecutionContext } from "@nestjs/common";
import { OrganisationAccessGuard } from "./organisation-access.guard";
import { PaymentRequiredApiException, ForbiddenApiException } from "../exceptions/api.exception";

/**
 * Regression tests for the enforcement side of module entitlement — the
 * companion to entitlements.service.spec.ts, which tests the computation.
 * These prove the GUARD actually blocks on that computation's result.
 */

function makeContext(user: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

/** `getAllAndOverride` is called once for ALLOW_WHEN_INACTIVE_KEY, then once for REQUIRE_MODULE_KEY — mock the two calls in that order. */
function makeGuard(entitlements: unknown, allowWhenInactive: boolean | undefined, requiredModule: string | undefined) {
  const reflector = { getAllAndOverride: jest.fn().mockReturnValueOnce(allowWhenInactive).mockReturnValueOnce(requiredModule) };
  const entitlementsService = { getEntitlements: jest.fn().mockResolvedValue(entitlements) };
  return new OrganisationAccessGuard(reflector as never, entitlementsService as never);
}

const ORG_CALLER = { scope: "organisation", organisationId: "org-1" };
const ACTIVE_ENTITLEMENTS = { organisationStatus: "ACTIVE", subscriptionStatus: "ACTIVE", effectiveModuleKeys: ["employees"], planName: "Growth" };

describe("OrganisationAccessGuard", () => {
  it("no-ops for a platform-scoped caller — this guard only governs organisation accounts", async () => {
    const guard = makeGuard(ACTIVE_ENTITLEMENTS, undefined, undefined);
    await expect(guard.canActivate(makeContext({ scope: "platform" }))).resolves.toBe(true);
  });

  it("allows an organisation caller when active and the required module is included", async () => {
    const guard = makeGuard(ACTIVE_ENTITLEMENTS, undefined, "employees");
    await expect(guard.canActivate(makeContext(ORG_CALLER))).resolves.toBe(true);
  });

  it("blocks with 402 when the organisation itself is not ACTIVE", async () => {
    const guard = makeGuard({ ...ACTIVE_ENTITLEMENTS, organisationStatus: "SUSPENDED" }, undefined, undefined);
    const attempt = guard.canActivate(makeContext(ORG_CALLER));
    await expect(attempt).rejects.toBeInstanceOf(PaymentRequiredApiException);
    await expect(attempt).rejects.toMatchObject({ code: "ORGANISATION_INACTIVE" });
  });

  it.each(["SUSPENDED", "CANCELLED", null])("blocks with 402 when the subscription status is %s", async (status) => {
    const guard = makeGuard({ ...ACTIVE_ENTITLEMENTS, subscriptionStatus: status }, undefined, undefined);
    const attempt = guard.canActivate(makeContext(ORG_CALLER));
    await expect(attempt).rejects.toBeInstanceOf(PaymentRequiredApiException);
    await expect(attempt).rejects.toMatchObject({ code: "SUBSCRIPTION_INACTIVE" });
  });

  it("still blocks an inactive organisation even on a route tagged @RequireModule", async () => {
    const guard = makeGuard({ ...ACTIVE_ENTITLEMENTS, organisationStatus: "SUSPENDED" }, false, "employees");
    await expect(guard.canActivate(makeContext(ORG_CALLER))).rejects.toBeInstanceOf(PaymentRequiredApiException);
  });

  it("lets an @AllowWhenInactive() route through even when suspended", async () => {
    const guard = makeGuard({ ...ACTIVE_ENTITLEMENTS, organisationStatus: "SUSPENDED" }, true, undefined);
    await expect(guard.canActivate(makeContext(ORG_CALLER))).resolves.toBe(true);
  });

  it("blocks with 403 MODULE_NOT_IN_PLAN when the org is active but the plan lacks the route's module", async () => {
    const guard = makeGuard(ACTIVE_ENTITLEMENTS, false, "payroll");
    const attempt = guard.canActivate(makeContext(ORG_CALLER));
    await expect(attempt).rejects.toBeInstanceOf(ForbiddenApiException);
    await expect(attempt).rejects.toMatchObject({ code: "MODULE_NOT_IN_PLAN", details: { moduleKey: "payroll", planName: "Growth" } });
  });
});
