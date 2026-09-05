"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import type { OrganisationStatus } from "@nexora/types";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, Reveal, useToast } from "@nexora/ui";
import { NexoraApiError } from "@nexora/api-client";
import { AppShell } from "@/components/app-shell";
import { SubscriptionPanel } from "@/components/subscription-panel";
import { apiClient } from "@/lib/api-client";
import { formatMoney } from "@/lib/format";
import { useAuthStore } from "@/store/auth-store";

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

export default function OrganisationDetailPage() {
  const params = useParams<{ id: string }>();
  const organisationId = params.id;
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const organisationQuery = useQuery({
    queryKey: ["organisation", organisationId],
    queryFn: () => apiClient.organisations.findById(organisationId),
  });

  const statusMutation = useMutation({
    mutationFn: (status: OrganisationStatus) => apiClient.organisations.updateStatus(organisationId, { status }),
    onSuccess: (organisation) => {
      toast({ variant: "success", title: "Status updated", description: `${organisation.name} is now ${organisation.status}.` });
      queryClient.invalidateQueries({ queryKey: ["organisation", organisationId] });
      queryClient.invalidateQueries({ queryKey: ["organisations"] });
    },
    onError: (error) => {
      const message = error instanceof NexoraApiError ? error.message : "Could not update status.";
      toast({ variant: "error", title: "Status change failed", description: message });
    },
  });

  if (organisationQuery.isLoading) {
    return (
      <AppShell>
        <p className="mx-auto max-w-4xl text-sm text-muted-foreground">Loading organisation…</p>
      </AppShell>
    );
  }

  if (organisationQuery.isError || !organisationQuery.data) {
    return (
      <AppShell>
        <p className="mx-auto max-w-4xl text-sm text-danger">Could not load this organisation.</p>
      </AppShell>
    );
  }

  const organisation = organisationQuery.data;

  return (
    <AppShell>
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <Reveal>
          <Link href="/organisations" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Organisations
          </Link>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
              {organisation.name}
              <Badge variant={STATUS_VARIANT[organisation.status]}>{organisation.status}</Badge>
            </h1>
            {hasPermission("organisations:manage_status") && (
              <div className="flex gap-2">
                {NEXT_STATUS_ACTIONS[organisation.status].map((action) => (
                  <Button
                    key={action.status}
                    variant="outline"
                    size="sm"
                    disabled={statusMutation.isPending}
                    onClick={() => statusMutation.mutate(action.status)}
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">/{organisation.slug}</p>
        </Reveal>

        <Reveal delayMs={60}>
          <ProfileCard organisationId={organisationId} canEdit={hasPermission("organisations:update")} />
        </Reveal>

        {hasPermission("billing:read") && (
          <Reveal delayMs={120}>
            <Card>
              <CardHeader>
                <CardTitle>Subscription</CardTitle>
              </CardHeader>
              <CardContent>
                <SubscriptionPanel organisationId={organisationId} canManage={hasPermission("billing:manage_subscriptions")} />
              </CardContent>
            </Card>
          </Reveal>
        )}

        {hasPermission("billing:read") && (
          <Reveal delayMs={180}>
            <InvoiceHistory organisationId={organisationId} />
          </Reveal>
        )}

        <Reveal delayMs={240}>
          <ActivityHistory organisationId={organisationId} />
        </Reveal>
      </div>
    </AppShell>
  );
}

function ProfileCard({ organisationId, canEdit }: { organisationId: string; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [industry, setIndustry] = useState("");

  const organisationQuery = useQuery({
    queryKey: ["organisation", organisationId],
    queryFn: () => apiClient.organisations.findById(organisationId),
  });

  useEffect(() => {
    if (organisationQuery.data && !editing) {
      setName(organisationQuery.data.name);
      setContactEmail(organisationQuery.data.contactEmail);
      setContactPhone(organisationQuery.data.contactPhone ?? "");
      setIndustry(organisationQuery.data.industry ?? "");
    }
  }, [organisationQuery.data, editing]);

  const updateMutation = useMutation({
    mutationFn: () =>
      apiClient.organisations.update(organisationId, {
        name: name.trim(),
        contactEmail: contactEmail.trim(),
        contactPhone: contactPhone.trim() || undefined,
        industry: industry.trim() || undefined,
      }),
    onSuccess: () => {
      toast({ variant: "success", title: "Organisation updated" });
      queryClient.invalidateQueries({ queryKey: ["organisation", organisationId] });
      queryClient.invalidateQueries({ queryKey: ["organisations"] });
      setEditing(false);
    },
    onError: (error) => {
      const message = error instanceof NexoraApiError ? error.message : "Could not update organisation.";
      toast({ variant: "error", title: "Update failed", description: message });
    },
  });

  if (!organisationQuery.data) return null;
  const organisation = organisationQuery.data;

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <CardTitle>Profile</CardTitle>
        {canEdit && (
          <Button variant="outline" size="sm" onClick={() => setEditing((v) => !v)}>
            {editing ? "Cancel" : "Edit"}
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {editing ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-name">Name</Label>
                <Input id="edit-name" value={name} onChange={(event) => setName(event.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-email">Contact email</Label>
                <Input id="edit-email" type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-phone">Contact phone</Label>
                <Input id="edit-phone" value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-industry">Industry</Label>
                <Input id="edit-industry" value={industry} onChange={(event) => setIndustry(event.target.value)} />
              </div>
            </div>
            <Button onClick={() => updateMutation.mutate()} disabled={!name.trim() || !contactEmail.trim() || updateMutation.isPending} className="self-start">
              {updateMutation.isPending ? "Saving…" : "Save changes"}
            </Button>
          </>
        ) : (
          <dl className="grid gap-4 sm:grid-cols-2">
            <Field label="Contact email" value={organisation.contactEmail} />
            <Field label="Contact phone" value={organisation.contactPhone ?? "—"} />
            <Field label="Industry" value={organisation.industry ?? "—"} />
            <Field label="Onboarded" value={new Date(organisation.createdAt).toLocaleString()} />
          </dl>
        )}
      </CardContent>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{value}</dd>
    </div>
  );
}

function InvoiceHistory({ organisationId }: { organisationId: string }) {
  const invoicesQuery = useQuery({ queryKey: ["invoices", organisationId], queryFn: () => apiClient.billing.listInvoices(organisationId) });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoices & receipts</CardTitle>
        <CardDescription>Every charge attempt for this organisation, newest first.</CardDescription>
      </CardHeader>
      <CardContent>
        {invoicesQuery.isLoading && <p className="text-sm text-muted-foreground">Loading invoices…</p>}
        {invoicesQuery.isError && <p className="text-sm text-danger">Could not load invoices.</p>}
        {invoicesQuery.data?.length === 0 && <p className="text-sm text-muted-foreground">No invoices yet.</p>}
        <div className="flex flex-col divide-y divide-border">
          {invoicesQuery.data?.map((invoice) => (
            <div key={invoice.id} className="flex items-center justify-between gap-3 py-3 text-sm first:pt-0 last:pb-0">
              <div>
                <p className="font-medium text-foreground">{invoice.receiptNumber}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(invoice.periodStart).toLocaleDateString()} – {new Date(invoice.periodEnd).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-foreground">{formatMoney(invoice.amountMinor, invoice.currency)}</span>
                <Badge variant={invoice.status === "PAID" ? "success" : invoice.status === "FAILED" ? "danger" : "outline"}>{invoice.status}</Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ActivityHistory({ organisationId }: { organisationId: string }) {
  const auditQuery = useQuery({ queryKey: ["organisation-audit", organisationId], queryFn: () => apiClient.organisations.listAuditLog(organisationId) });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity</CardTitle>
        <CardDescription>Full audit history for this organisation.</CardDescription>
      </CardHeader>
      <CardContent className="flex max-h-72 flex-col gap-3 overflow-y-auto">
        {auditQuery.isLoading && <p className="text-sm text-muted-foreground">Loading activity…</p>}
        {auditQuery.isError && <p className="text-sm text-danger">Could not load activity.</p>}
        {auditQuery.data?.length === 0 && <p className="text-sm text-muted-foreground">No activity recorded yet.</p>}
        {auditQuery.data?.map((entry) => (
          <div key={entry.id} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-foreground">{humanizeAction(entry.action)}</span>
            <span className="shrink-0 text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleString()}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function humanizeAction(action: string): string {
  const lower = action.toLowerCase().replace(/_/g, " ");
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}
