import type { OrganisationStatus } from "./organisation";
import type { PlatformUserStatus } from "./platform-user";
import type { SubscriptionStatus } from "./billing";
import type { AssistantActionStatus } from "./assistant";

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
  /**
   * Phase 10 — platform-wide AI adoption/health, built entirely from
   * NEXORA's own data (organisations.aiProviderDeveloperId,
   * assistant_action_requests). Deliberately does NOT touch SAPOK AI's
   * cross-tenant training-data export or admin feedback summary — those
   * aggregate across every SAPOK AI developer on the platform (every
   * NEXORA organisation AND any other product built on SAPOK AI), which a
   * NEXORA platform admin has no business seeing. This section only ever
   * reflects what NEXORA itself already knows about its own organisations.
   */
  assistant?: {
    organisationsProvisioned: number;
    actionsByStatus: Record<AssistantActionStatus, number>;
    actionsByTool: { toolName: string; count: number }[];
  };
}
