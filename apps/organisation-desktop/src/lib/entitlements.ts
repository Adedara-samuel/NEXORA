import { useQuery } from "@tanstack/react-query";
import { apiClient } from "./api-client";
import { useAuthStore } from "../store/auth-store";

/**
 * One cached query, read from both AppShell (nav filtering + the
 * lockout/grace banners) and individual pages (Dashboard's optional
 * sections, a gated page's own "not on your plan" state) — react-query
 * dedupes by key, so only AppShell's mount actually fetches.
 */
export function useEntitlements() {
  const accessToken = useAuthStore((state) => state.accessToken);
  return useQuery({
    queryKey: ["organisation-billing-summary"],
    queryFn: () => apiClient.organisationBilling.getSummary(),
    enabled: !!accessToken,
    staleTime: 60_000,
  });
}

export function isOrganisationLockedOut(entitlements: { organisationStatus: string; subscriptionStatus: string | null } | undefined): boolean {
  if (!entitlements) return false;
  if (entitlements.organisationStatus !== "ACTIVE") return true;
  return entitlements.subscriptionStatus === null || entitlements.subscriptionStatus === "SUSPENDED" || entitlements.subscriptionStatus === "CANCELLED";
}
