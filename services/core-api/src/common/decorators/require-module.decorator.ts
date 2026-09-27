import { SetMetadata } from "@nestjs/common";

export const REQUIRE_MODULE_KEY = "requiredModule";

/**
 * Marks a route/controller as belonging to a specific business module
 * (see prisma/seed.ts's MODULES catalog). Checked by OrganisationAccessGuard
 * against the caller's organisation's effective entitlements — separate
 * from @RequirePermissions, which governs WHO inside an organisation can use
 * a feature the organisation has already paid for.
 */
export const RequireModule = (moduleKey: string) => SetMetadata(REQUIRE_MODULE_KEY, moduleKey);
