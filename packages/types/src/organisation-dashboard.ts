/**
 * The Organisation Desktop home dashboard. Every top-level section is
 * optional: the API only computes and returns the sections the caller's own
 * permissions unlock (same pattern as the platform DashboardSummary), so a
 * user without `payroll:read` never receives payroll figures even though the
 * endpoint is shared. Every number here is derived from real records —
 * nothing is placeholder or estimated beyond what's documented on the field.
 */
export interface OrganisationActivityEntry {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  /** Null for system/unknown actors. Platform staff are deliberately shown
   * as "NEXORA Platform" rather than by name — an organisation has no
   * business seeing individual SAPOK TECH staff identities. */
  actorName: string | null;
  actorType: string | null;
  createdAt: string;
}

export interface OrganisationDashboardSummary {
  generatedAt: string;

  /** Requires `employees:read`. */
  employees?: {
    /** Everyone not TERMINATED. */
    total: number;
    hiredThisMonth: number;
    hiredLastMonth: number;
    byDepartment: { departmentId: string | null; name: string; count: number }[];
  };

  /** Requires `attendance:read`. PRESENT, LATE and HALF_DAY all count as present. */
  attendance?: {
    presentToday: number;
    /** Non-terminated headcount — the denominator for today's rate. */
    expectedToday: number;
    /** presentToday / expectedToday; null when there is no headcount. */
    rateToday: number | null;
    /**
     * Average daily rate over the last 7 days vs the 7 before that, counting
     * only days that have any attendance records (weekends/holidays with no
     * records aren't treated as mass absence), against current headcount.
     * Null when the window has no recorded days.
     */
    rateLast7Days: number | null;
    ratePrevious7Days: number | null;
    /**
     * Last 30 calendar days, oldest first. `present` is null on a day with
     * no attendance recorded at all (weekends, holidays) — deliberately not
     * 0, which would claim everyone was absent and draw a false dip.
     */
    trend: { date: string; present: number | null }[];
  };

  /** Requires `leave:read`. */
  leave?: {
    /** Distinct employees with an APPROVED leave covering today. */
    onLeaveToday: number;
    pendingRequests: number;
  };

  /** Requires `payroll:read`. */
  payroll?: {
    latestRun: {
      id: string;
      periodYear: number;
      periodMonth: number;
      totalNetMinor: number;
      currency: string;
      disbursementStatus: string;
    } | null;
  };

  /** Requires `documents:read`. */
  documents?: {
    expiringWithin30Days: number;
    expired: number;
  };

  /** Requires `compliance:read`. EXPIRED / NON_COMPLIANT, or PENDING past its due date. */
  compliance?: {
    needingAttention: number;
  };

  /** Requires `assistant:use`. */
  assistant?: {
    pendingActions: number;
  };

  /** Requires `audit:read`. */
  recentActivity?: OrganisationActivityEntry[];
}
