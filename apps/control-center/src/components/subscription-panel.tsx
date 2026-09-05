"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SubscriptionStatus } from "@nexora/types";
import { Badge, Button, useToast } from "@nexora/ui";
import { NexoraApiError } from "@nexora/api-client";
import { apiClient } from "@/lib/api-client";
import { formatMoney } from "@/lib/format";

export const SUBSCRIPTION_STATUS_VARIANT: Record<SubscriptionStatus, "default" | "success" | "danger" | "outline"> = {
  TRIALING: "outline",
  ACTIVE: "success",
  GRACE_PERIOD: "default",
  SUSPENDED: "danger",
  CANCELLED: "outline",
};

/** Shared between the Organisations list (compact) and the organisation detail page. */
export function SubscriptionPanel({ organisationId, canManage }: { organisationId: string; canManage: boolean }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedPlanId, setSelectedPlanId] = useState("");

  const plansQuery = useQuery({ queryKey: ["billing-plans"], queryFn: () => apiClient.billing.listPlans() });
  const subscriptionQuery = useQuery({
    queryKey: ["subscription", organisationId],
    queryFn: () => apiClient.billing.getSubscription(organisationId),
    retry: false,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["subscription", organisationId] });
    queryClient.invalidateQueries({ queryKey: ["organisations"] });
    queryClient.invalidateQueries({ queryKey: ["invoices", organisationId] });
  };

  const assignMutation = useMutation({
    mutationFn: () => apiClient.billing.createSubscription(organisationId, { planId: selectedPlanId, status: "ACTIVE" }),
    onSuccess: () => {
      toast({ variant: "success", title: "Subscription assigned" });
      invalidate();
    },
    onError: (error) => {
      const message = error instanceof NexoraApiError ? error.message : "Could not assign subscription.";
      toast({ variant: "error", title: "Assignment failed", description: message });
    },
  });

  const renewMutation = useMutation({
    mutationFn: (simulateFailure: boolean) => apiClient.billing.renewSubscription(organisationId, { simulateFailure }),
    onSuccess: ({ invoice }) => {
      if (invoice.status === "PAID") {
        toast({
          variant: "success",
          title: "Renewed",
          description: `Receipt ${invoice.receiptNumber} — ${formatMoney(invoice.amountMinor, invoice.currency)}`,
        });
      } else {
        toast({ variant: "warning", title: "Renewal failed", description: invoice.failureReason ?? undefined });
      }
      invalidate();
    },
    onError: (error) => {
      const message = error instanceof NexoraApiError ? error.message : "Could not process renewal.";
      toast({ variant: "error", title: "Renewal error", description: message });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => apiClient.billing.cancelSubscription(organisationId),
    onSuccess: () => {
      toast({ variant: "success", title: "Subscription cancelled" });
      invalidate();
    },
    onError: (error) => {
      const message = error instanceof NexoraApiError ? error.message : "Could not cancel subscription.";
      toast({ variant: "error", title: "Cancellation failed", description: message });
    },
  });

  const notFound =
    subscriptionQuery.isError && subscriptionQuery.error instanceof NexoraApiError && subscriptionQuery.error.code === "SUBSCRIPTION_NOT_FOUND";

  if (subscriptionQuery.isLoading) return <p className="text-xs text-muted-foreground">Loading subscription…</p>;

  if (notFound) {
    if (!canManage) return <p className="text-xs text-muted-foreground">No subscription assigned.</p>;
    return (
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={selectedPlanId}
          onChange={(event) => setSelectedPlanId(event.target.value)}
          className="h-9 rounded-md border border-border bg-background/60 px-2 text-sm text-foreground"
        >
          <option value="">Select a plan…</option>
          {plansQuery.data?.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.name} — {formatMoney(plan.priceMinor, plan.currency)}
            </option>
          ))}
        </select>
        <Button size="sm" disabled={!selectedPlanId || assignMutation.isPending} onClick={() => assignMutation.mutate()}>
          Assign subscription
        </Button>
      </div>
    );
  }

  if (subscriptionQuery.isError || !subscriptionQuery.data) {
    return <p className="text-xs text-danger">Could not load subscription.</p>;
  }

  const subscription = subscriptionQuery.data;
  const plan = plansQuery.data?.find((p) => p.id === subscription.planId);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Badge variant={SUBSCRIPTION_STATUS_VARIANT[subscription.status]}>{subscription.status}</Badge>
      <span className="text-xs text-muted-foreground">
        {plan?.name ?? "Unknown plan"} · renews {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
      </span>
      {canManage && subscription.status !== "CANCELLED" && (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={renewMutation.isPending} onClick={() => renewMutation.mutate(false)}>
            Renew
          </Button>
          <Button size="sm" variant="outline" disabled={renewMutation.isPending} onClick={() => renewMutation.mutate(true)}>
            Renew (simulate failure)
          </Button>
          <Button size="sm" variant="destructive" disabled={cancelMutation.isPending} onClick={() => cancelMutation.mutate()}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
