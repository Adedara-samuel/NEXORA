import { SetMetadata } from "@nestjs/common";

export const ALLOW_WHEN_INACTIVE_KEY = "allowWhenInactive";

/**
 * Exempts a route from OrganisationAccessGuard's organisation-status/
 * subscription lockout — for the handful of endpoints a suspended
 * organisation still needs (reading its own billing summary so it can see
 * WHY it's locked out, logging out). Never exempts module-level checks.
 */
export const AllowWhenInactive = () => SetMetadata(ALLOW_WHEN_INACTIVE_KEY, true);
