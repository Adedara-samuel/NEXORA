"use client";

import type { ComponentType } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts";
import { Building2, CreditCard, ShieldCheck, Users } from "lucide-react";
import type { OrganisationStatus } from "@nexora/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Reveal } from "@nexora/ui";
import { AppShell } from "@/components/app-shell";
import { apiClient } from "@/lib/api-client";
import { formatMoney } from "@/lib/format";
import { useAuthStore } from "@/store/auth-store";

const ORGANISATION_STATUS_COLOR: Record<OrganisationStatus, string> = {
  PENDING: "hsl(var(--muted-foreground))",
  ACTIVE: "hsl(var(--success))",
  SUSPENDED: "hsl(var(--danger))",
  ARCHIVED: "hsl(var(--border))",
};

/** Polls every 15s rather than pushing over a websocket — plenty "live" for
 * an admin dashboard at this scale, no new realtime infra needed. */
const REFRESH_INTERVAL_MS = 15_000;

export default function DashboardPage() {
  const roles = useAuthStore((state) => state.roles);
  const summaryQuery = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: () => apiClient.dashboard.getSummary(),
    refetchInterval: REFRESH_INTERVAL_MS,
  });

  const summary = summaryQuery.data;
  const hasAnySection = summary && (summary.organisations || summary.platformUsers || summary.roles || summary.billing);

  return (
    <AppShell>
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <Reveal>
          <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Signed in with {roles.length > 0 ? roles.join(", ") : "no roles assigned"}. Refreshes automatically every
            15 seconds.
          </p>
        </Reveal>

        {summaryQuery.isLoading && <p className="text-sm text-muted-foreground">Loading dashboard…</p>}
        {summaryQuery.isError && <p className="text-sm text-danger">Could not load dashboard data.</p>}

        {summary && !hasAnySection && (
          <p className="text-sm text-muted-foreground">
            No roles are assigned to your account yet — ask a Super Admin to assign one.
          </p>
        )}

        {summary && hasAnySection && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {summary.organisations && (
                <Reveal delayMs={0}>
                  <StatTile
                    icon={Building2}
                    label="Organisations"
                    value={summary.organisations.total.toLocaleString()}
                    hint={`${summary.organisations.byStatus.ACTIVE} active`}
                  />
                </Reveal>
              )}
              {summary.platformUsers && (
                <Reveal delayMs={60}>
                  <StatTile
                    icon={Users}
                    label="Platform Users"
                    value={summary.platformUsers.total.toLocaleString()}
                    hint={`${summary.platformUsers.byStatus.ACTIVE} active`}
                  />
                </Reveal>
              )}
              {summary.roles && (
                <Reveal delayMs={120}>
                  <StatTile icon={ShieldCheck} label="Roles" value={summary.roles.total.toLocaleString()} />
                </Reveal>
              )}
              {summary.billing && (
                <Reveal delayMs={180}>
                  <StatTile
                    icon={CreditCard}
                    label="Revenue this month"
                    value={formatMoney(summary.billing.revenueThisMonthMinor, summary.billing.currency)}
                    hint={`${summary.billing.activeSubscriptions} active subscriptions`}
                  />
                </Reveal>
              )}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {summary.organisations && (
                <Reveal delayMs={100}>
                  <Card>
                    <CardHeader>
                      <CardTitle>Organisations by status</CardTitle>
                    </CardHeader>
                    <CardContent className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={(Object.keys(summary.organisations.byStatus) as OrganisationStatus[]).map((status) => ({
                            status,
                            count: summary.organisations!.byStatus[status],
                          }))}
                          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                          <XAxis dataKey="status" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={{ stroke: "hsl(var(--border))" }} tickLine={false} />
                          <YAxis allowDecimals={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={false} tickLine={false} width={28} />
                          <Tooltip
                            cursor={{ fill: "hsl(var(--surface))" }}
                            contentStyle={{ background: "hsl(var(--surface))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                            animationDuration={200}
                          />
                          <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={48} animationDuration={700} animationEasing="ease-out">
                            {(Object.keys(summary.organisations.byStatus) as OrganisationStatus[]).map((status) => (
                              <Cell key={status} fill={ORGANISATION_STATUS_COLOR[status]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </Reveal>
              )}

              {summary.recentActivity && (
                <Reveal delayMs={160}>
                  <Card>
                    <CardHeader>
                      <CardTitle>Recent activity</CardTitle>
                      <CardDescription>Latest 15 audit log entries across the platform.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex max-h-64 flex-col gap-3 overflow-y-auto">
                      {summary.recentActivity.length === 0 && <p className="text-sm text-muted-foreground">No activity yet.</p>}
                      {summary.recentActivity.map((entry) => (
                        <div key={entry.id} className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-foreground">{humanizeAction(entry.action)}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(entry.createdAt)}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </Reveal>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-5">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Icon className="h-4 w-4" />
          <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
        </div>
        <p className="text-2xl font-semibold text-foreground">{value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function humanizeAction(action: string): string {
  const lower = action.toLowerCase().replace(/_/g, " ");
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
