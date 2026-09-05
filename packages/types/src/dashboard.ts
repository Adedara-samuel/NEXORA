import type { OrganisationStatus } from "./organisation";
import type { PlatformUserStatus } from "./platform-user";
import type { SubscriptionStatus } from "./billing";

export interface RecentActivityEntry {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  organisationId: string | null;
  createdAt: string;
}

/**
 * Every top-level section is optional — the API only computes and returns
 * the sections the requesting user's permissions allow, so a SUPPORT user
 * (organisations:read + platform_users:read only) never receives billing
 * numbers even though the endpoint is shared.
 */
export interface DashboardSummary {
  organisations?: {
    total: number;
    byStatus: Record<OrganisationStatus, number>;
  };
  platformUsers?: {
    total: number;
    byStatus: Record<PlatformUserStatus, number>;
  };
  roles?: {
    total: number;
  };
  billing?: {
    activeSubscriptions: number;
    subscriptionsByStatus: Record<SubscriptionStatus, number>;
    revenueThisMonthMinor: number;
    currency: string;
  };
  recentActivity?: RecentActivityEntry[];
}
