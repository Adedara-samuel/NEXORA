"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import type { Organisation, OrganisationStatus, SubscriptionStatus } from "@nexora/types";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, useToast } from "@nexora/ui";
import { NexoraApiError } from "@nexora/api-client";
import { AppShell } from "@/components/app-shell";
import { apiClient } from "@/lib/api-client";
import { formatMoney } from "@/lib/format";
import { useAuthStore } from "@/store/auth-store";

const SUBSCRIPTION_STATUS_VARIANT: Record<SubscriptionStatus, "default" | "success" | "danger" | "outline"> = {
  TRIALING: "outline",
  ACTIVE: "success",
  GRACE_PERIOD: "default",
  SUSPENDED: "danger",
  CANCELLED: "outline",
};

const STATUS_VARIANT: Record<OrganisationStatus, "default" | "success" | "danger" | "outline"> = {
  PENDING: "outline",
  ACTIVE: "success",
  SUSPENDED: "danger",
  ARCHIVED: "outline",
};

const NEXT_STATUS_ACTIONS: Record<OrganisationStatus, { label: string; status: OrganisationStatus }[]> = {
  PENDING: [
    { label: "Activate", status: "ACTIVE" },
    { label: "Archive", status: "ARCHIVED" },
  ],
  ACTIVE: [
    { label: "Suspend", status: "SUSPENDED" },
    { label: "Archive", status: "ARCHIVED" },
  ],
  SUSPENDED: [
    { label: "Reactivate", status: "ACTIVE" },
    { label: "Archive", status: "ARCHIVED" },
  ],
  ARCHIVED: [],
};

export default function OrganisationsPage() {
  const hasPermission = useAuthStore((state) => state.hasPermission);

  return (
    <AppShell>
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Organisations</h1>
          <p className="text-sm text-muted-foreground">Onboard and manage every organisation on the platform.</p>
        </div>

        {hasPermission("organisations:create") && <CreateOrganisationForm />}
        <OrganisationsList
          canManageStatus={hasPermission("organisations:manage_status")}
          canReadBilling={hasPermission("billing:read")}
          canManageSubscriptions={hasPermission("billing:manage_subscriptions")}
        />
      </div>
    </AppShell>
  );
}

function CreateOrganisationForm() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [industry, setIndustry] = useState("");

  const createMutation = useMutation({
    mutationFn: () =>
      apiClient.organisations.create({
        name: name.trim(),
        contactEmail: contactEmail.trim(),
        contactPhone: contactPhone.trim() || undefined,
        industry: industry.trim() || undefined,
      }),
    onSuccess: (organisation) => {
      toast({ variant: "success", title: "Organisation onboarded", description: `${organisation.name} was created as PENDING.` });
      queryClient.invalidateQueries({ queryKey: ["organisations"] });
      setName("");
      setContactEmail("");
      setContactPhone("");
      setIndustry("");
    },
    onError: (error) => {
      const message = error instanceof NexoraApiError ? error.message : "Could not create organisation.";
      toast({ variant: "error", title: "Onboarding failed", description: message });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Onboard an organisation</CardTitle>
        <CardDescription>Creates the organisation shell as PENDING — activate it once it's ready to use.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="org-name">Name</Label>
            <Input id="org-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Acme Cooperative" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="org-email">Contact email</Label>
            <Input
              id="org-email"
              type="email"
              value={contactEmail}
              onChange={(event) => setContactEmail(event.target.value)}
              placeholder="ops@acme.coop"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="org-phone">Contact phone (optional)</Label>
            <Input id="org-phone" value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="org-industry">Industry (optional)</Label>
            <Input id="org-industry" value={industry} onChange={(event) => setIndustry(event.target.value)} />
          </div>
        </div>
        <Button
          onClick={() => createMutation.mutate()}
          disabled={!name.trim() || !contactEmail.trim() || createMutation.isPending}
          className="self-start"
        >
          <Plus className="h-4 w-4" />
          {createMutation.isPending ? "Creating…" : "Onboard organisation"}
        </Button>
      </CardContent>
    </Card>
  );
}

function OrganisationsList({
  canManageStatus,
  canReadBilling,
  canManageSubscriptions,
}: {
  canManageStatus: boolean;
  canReadBilling: boolean;
  canManageSubscriptions: boolean;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const organisationsQuery = useQuery({ queryKey: ["organisations"], queryFn: () => apiClient.organisations.list({ page: 1, pageSize: 50 }) });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrganisationStatus }) => apiClient.organisations.updateStatus(id, { status }),
    onSuccess: (organisation) => {
      toast({ variant: "success", title: "Status updated", description: `${organisation.name} is now ${organisation.status}.` });
      queryClient.invalidateQueries({ queryKey: ["organisations"] });
    },
    onError: (error) => {
      const message = error instanceof NexoraApiError ? error.message : "Could not update status.";
      toast({ variant: "error", title: "Status change failed", description: message });
    },
  });

  if (organisationsQuery.isLoading) return <p className="text-sm text-muted-foreground">Loading organisations…</p>;
  if (organisationsQuery.isError) return <p className="text-sm text-danger">Could not load organisations.</p>;

  const organisations = organisationsQuery.data?.items ?? [];
  if (organisations.length === 0) return <p className="text-sm text-muted-foreground">No organisations yet.</p>;

  return (
    <div className="flex flex-col gap-3">
      {organisations.map((organisation) => (
        <OrganisationRow
          key={organisation.id}
          organisation={organisation}
          canManageStatus={canManageStatus}
          canReadBilling={canReadBilling}
          canManageSubscriptions={canManageSubscriptions}
          onChangeStatus={(status) => statusMutation.mutate({ id: organisation.id, status })}
          pending={statusMutation.isPending}
        />
      ))}
    </div>
  );
}

function OrganisationRow({
  organisation,
  canManageStatus,
  canReadBilling,
  canManageSubscriptions,
  onChangeStatus,
  pending,
}: {
  organisation: Organisation;
  canManageStatus: boolean;
  canReadBilling: boolean;
  canManageSubscriptions: boolean;
  onChangeStatus: (status: OrganisationStatus) => void;
  pending: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            {organisation.name}
            <Badge variant={STATUS_VARIANT[organisation.status]}>{organisation.status}</Badge>
          </CardTitle>
          <CardDescription>
            {organisation.contactEmail}
            {organisation.contactPhone ? ` · ${organisation.contactPhone}` : ""}
            {organisation.industry ? ` · ${organisation.industry}` : ""}
          </CardDescription>
          <p className="mt-1 text-xs text-muted-foreground">/{organisation.slug}</p>
        </div>
        {canManageStatus && (
          <div className="flex shrink-0 gap-2">
            {NEXT_STATUS_ACTIONS[organisation.status].map((action) => (
              <Button key={action.status} variant="outline" size="sm" disabled={pending} onClick={() => onChangeStatus(action.status)}>
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </CardHeader>
      {canReadBilling && (
        <CardContent className="border-t border-border pt-4">
          <SubscriptionPanel organisationId={organisation.id} canManage={canManageSubscriptions} />
        </CardContent>
      )}
    </Card>
  );
}

function SubscriptionPanel({ organisationId, canManage }: { organisationId: string; canManage: boolean }) {
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
        toast({ variant: "success", title: "Renewed", description: `Receipt ${invoice.receiptNumber} — ${formatMoney(invoice.amountMinor, invoice.currency)}` });
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

  const notFound = subscriptionQuery.isError && subscriptionQuery.error instanceof NexoraApiError && subscriptionQuery.error.code === "SUBSCRIPTION_NOT_FOUND";

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
