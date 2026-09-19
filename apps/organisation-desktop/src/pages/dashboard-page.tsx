import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Area, AreaChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Bot,
  Building2,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  FileText,
  KeyRound,
  Lightbulb,
  ShieldCheck,
  UserCog,
  UserPlus,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { OrganisationActivityEntry, OrganisationDashboardSummary } from "@nexora/types";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Reveal, cn } from "@nexora/ui";
import { AppShell } from "../components/app-shell";
import { apiClient } from "../lib/api-client";

// Categorical (identity) colours for the department donut — decorative, not
// status colours, so deliberately separate from the success/danger tokens.
const DEPARTMENT_COLOURS = ["#3b82f6", "#8b5cf6", "#14b8a6", "#f59e0b", "#ec4899", "#64748b"];
const MAX_DEPARTMENT_SLICES = 5;

const tooltipStyle = {
  backgroundColor: "hsl(var(--surface))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
  color: "hsl(var(--foreground))",
};

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function percent(rate: number | null): string {
  return rate === null ? "—" : `${(rate * 100).toFixed(1)}%`;
}

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** Days with no attendance recorded are null — a sparkline should skip them, not plot a dip. */
function recordedSeries(trend: { present: number | null }[]): number[] {
  return trend.map((point) => point.present).filter((present): present is number => present !== null);
}

function humanizeAction(action: string): string {
  const spaced = action.toLowerCase().replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function formatMoney(minor: number, currency: string): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(minor / 100);
}

const RESOURCE_ICONS: Record<string, LucideIcon> = {
  PayrollRun: Wallet,
  Document: FileText,
  Employee: Users,
  LeaveRequest: CalendarClock,
  Attendance: CalendarCheck,
  ComplianceRecord: ShieldCheck,
  OrganisationUser: UserCog,
  OrganisationRole: KeyRound,
  Department: Building2,
  Branch: Building2,
};

export default function DashboardPage() {
  const meQuery = useQuery({ queryKey: ["organisation-me"], queryFn: () => apiClient.organisationUsers.getMe() });
  // Refetched every minute (and on window focus, react-query's default) so
  // the numbers stay current while the page is left open.
  const summaryQuery = useQuery({
    queryKey: ["organisation-dashboard"],
    queryFn: () => apiClient.organisationDashboard.getSummary(),
    refetchInterval: 60_000,
  });
  const summary = summaryQuery.data;

  return (
    <AppShell>
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <Reveal>
          <h1 className="text-2xl font-semibold text-foreground">
            {greeting()}
            {meQuery.data ? `, ${meQuery.data.firstName}` : ""}
          </h1>
          <p className="text-sm text-muted-foreground">Here&apos;s what&apos;s happening in your organisation today.</p>
        </Reveal>

        {summaryQuery.isLoading && <DashboardSkeleton />}

        {summaryQuery.isError && (
          <Card>
            <CardContent className="flex items-center justify-between gap-4 pt-6">
              <p className="text-sm text-muted-foreground">Couldn&apos;t load the dashboard.</p>
              <Button variant="outline" size="sm" onClick={() => summaryQuery.refetch()}>
                Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {summary && <DashboardContent summary={summary} />}
      </div>
    </AppShell>
  );
}

function DashboardContent({ summary }: { summary: OrganisationDashboardSummary }) {
  const hasAnySection = Object.keys(summary).some((key) => key !== "generatedAt");
  if (!hasAnySection) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">Your role doesn&apos;t include any dashboard widgets yet. Ask an administrator to grant you read access to a module.</CardContent>
      </Card>
    );
  }

  const headcount = summary.attendance?.expectedToday ?? summary.employees?.total;
  const onLeavePercent = summary.leave && headcount ? (summary.leave.onLeaveToday / headcount) * 100 : null;
  const newHires = summary.employees?.hiredThisMonth ?? 0;

  return (
    <>
      <Reveal delayMs={40}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {summary.employees && (
            <StatTile
              icon={Users}
              label="Total employees"
              value={summary.employees.total.toLocaleString()}
              hint={newHires > 0 ? `${newHires} joined this month` : "No new hires this month"}
              tone={newHires > 0 ? "good" : "neutral"}
              href="/employees"
            />
          )}
          {summary.attendance && (
            <StatTile
              icon={CalendarCheck}
              label="Present today"
              value={summary.attendance.presentToday.toLocaleString()}
              hint={summary.attendance.rateToday === null ? "No headcount yet" : `${percent(summary.attendance.rateToday)} attendance`}
              tone={summary.attendance.rateToday !== null && summary.attendance.rateToday >= 0.8 ? "good" : "neutral"}
              sparkline={recordedSeries(summary.attendance.trend.slice(-14))}
              href="/attendance"
            />
          )}
          {summary.leave && (
            <StatTile
              icon={CalendarClock}
              label="On leave"
              value={summary.leave.onLeaveToday.toLocaleString()}
              hint={onLeavePercent === null ? "Approved leave today" : `${onLeavePercent.toFixed(1)}% of workforce`}
              tone="neutral"
              href="/leave"
            />
          )}
          {summary.leave && (
            <StatTile
              icon={UserPlus}
              label="Pending leave requests"
              value={summary.leave.pendingRequests.toLocaleString()}
              hint={summary.leave.pendingRequests > 0 ? "Awaiting a decision" : "All caught up"}
              tone={summary.leave.pendingRequests > 0 ? "warn" : "good"}
              href="/leave"
            />
          )}
        </div>
      </Reveal>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="flex flex-col gap-6 xl:col-span-2">
          {(summary.attendance || summary.employees) && (
            <Reveal delayMs={80}>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
                {summary.attendance && (
                  <div className={summary.employees ? "lg:col-span-3" : "lg:col-span-5"}>
                    <AttendanceChart attendance={summary.attendance} />
                  </div>
                )}
                {summary.employees && (
                  <div className={summary.attendance ? "lg:col-span-2" : "lg:col-span-5"}>
                    <DepartmentDonut employees={summary.employees} />
                  </div>
                )}
              </div>
            </Reveal>
          )}

          {(summary.recentActivity || summary.attendance || summary.employees) && (
            <Reveal delayMs={120}>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {summary.recentActivity && <RecentActivityCard entries={summary.recentActivity} />}
                {(summary.attendance || summary.employees) && <InsightsCard summary={summary} />}
              </div>
            </Reveal>
          )}
        </div>

        <div className="flex flex-col gap-6">
          {(summary.leave || summary.documents || summary.compliance || summary.assistant) && (
            <Reveal delayMs={100}>
              <AttentionCard summary={summary} />
            </Reveal>
          )}
          {summary.payroll && (
            <Reveal delayMs={140}>
              <PayrollCard payroll={summary.payroll} />
            </Reveal>
          )}
        </div>
      </div>
    </>
  );
}

type Tone = "good" | "warn" | "neutral";

const TONE_CLASS: Record<Tone, string> = {
  good: "text-emerald-500",
  warn: "text-amber-500",
  neutral: "text-muted-foreground",
};

function StatTile({
  icon: Icon,
  label,
  value,
  hint,
  tone,
  sparkline,
  href,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
  tone: Tone;
  sparkline?: number[];
  href: string;
}) {
  return (
    <Link to={href} className="block">
      <Card className="h-full transition-colors hover:border-primary/50">
        <CardContent className="flex items-start justify-between gap-2 pt-5">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Icon className="h-4 w-4" />
              </span>
              {label}
            </div>
            <div className="text-3xl font-semibold text-foreground">{value}</div>
            <div className={cn("text-xs", TONE_CLASS[tone])}>{hint}</div>
          </div>
          {sparkline && sparkline.some((point) => point > 0) && (
            <div className="h-12 w-20 shrink-0 self-end">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sparkline.map((point, index) => ({ index, point }))}>
                  <Line type="monotone" dataKey="point" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

function AttendanceChart({ attendance }: { attendance: NonNullable<OrganisationDashboardSummary["attendance"]> }) {
  const hasData = attendance.trend.some((point) => point.present !== null);
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-sm">Attendance overview</CardTitle>
        <p className="text-xs text-muted-foreground">Employees present per day — last 30 days</p>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <p className="flex h-56 items-center justify-center text-sm text-muted-foreground">No attendance recorded in the last 30 days.</p>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={attendance.trend} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="presentFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  minTickGap={24}
                  tickFormatter={(date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" })}
                />
                <YAxis tickLine={false} axisLine={false} allowDecimals={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelFormatter={(date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, { dateStyle: "medium", timeZone: "UTC" })}
                  formatter={(value) => [typeof value === "number" ? `${value} present` : "Nothing recorded", ""]}
                />
                <Area type="monotone" dataKey="present" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#presentFill)" connectNulls />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DepartmentDonut({ employees }: { employees: NonNullable<OrganisationDashboardSummary["employees"]> }) {
  // Top slices by headcount, everything else folded into "Others" so the
  // legend stays readable however many departments exist.
  const sorted = employees.byDepartment;
  const top = sorted.slice(0, MAX_DEPARTMENT_SLICES);
  const othersCount = sorted.slice(MAX_DEPARTMENT_SLICES).reduce((sum, department) => sum + department.count, 0);
  const slices = othersCount > 0 ? [...top, { departmentId: "others", name: "Others", count: othersCount }] : top;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-sm">Department distribution</CardTitle>
      </CardHeader>
      <CardContent>
        {employees.total === 0 ? (
          <p className="flex h-56 items-center justify-center text-sm text-muted-foreground">No employees yet.</p>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="relative h-40 w-40 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={slices} dataKey="count" nameKey="name" innerRadius={52} outerRadius={72} paddingAngle={2} stroke="none" isAnimationActive={false}>
                    {slices.map((slice, index) => (
                      <Cell key={slice.departmentId ?? "unassigned"} fill={DEPARTMENT_COLOURS[index % DEPARTMENT_COLOURS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => [`${value} employees`, name]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-semibold text-foreground">{employees.total.toLocaleString()}</span>
                <span className="text-xs text-muted-foreground">Total</span>
              </div>
            </div>
            <ul className="flex w-full flex-col gap-1.5 text-sm">
              {slices.map((slice, index) => (
                <li key={slice.departmentId ?? "unassigned"} className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: DEPARTMENT_COLOURS[index % DEPARTMENT_COLOURS.length] }} />
                    <span className="truncate">{slice.name}</span>
                  </span>
                  <span className="shrink-0 text-foreground">
                    {Math.round((slice.count / employees.total) * 100)}% <span className="text-muted-foreground">({slice.count})</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RecentActivityCard({ entries }: { entries: OrganisationActivityEntry[] }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-sm">Recent activity</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {entries.length === 0 && <p className="text-sm text-muted-foreground">Nothing has happened in your organisation yet.</p>}
        {entries.map((entry) => {
          const Icon = RESOURCE_ICONS[entry.resourceType] ?? Activity;
          return (
            <div key={entry.id} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface text-muted-foreground ring-1 ring-border">
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-foreground">{humanizeAction(entry.action)}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {entry.actorName ? `${entry.actorName} · ` : ""}
                  {entry.resourceType}
                </div>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(entry.createdAt)}</span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

/**
 * Deliberately NOT branded as AI: these are plain comparisons computed from
 * the caller's own attendance and hiring records. The assistant behind
 * Phase 7-10 is still an honest placeholder — presenting arithmetic as
 * "AI insights" would misrepresent what's actually generating them.
 */
function InsightsCard({ summary }: { summary: OrganisationDashboardSummary }) {
  const insights: { icon: LucideIcon; title: string; body: string; delta?: { value: string; positive: boolean }; sparkline?: number[] }[] = [];

  if (summary.attendance) {
    const { rateLast7Days, ratePrevious7Days, trend } = summary.attendance;
    if (rateLast7Days !== null && ratePrevious7Days !== null) {
      const points = (rateLast7Days - ratePrevious7Days) * 100;
      const unchanged = Math.abs(points) < 0.05;
      insights.push({
        icon: CalendarCheck,
        title: "Attendance",
        body: unchanged
          ? `Average attendance over the last 7 days is ${percent(rateLast7Days)}, unchanged from the 7 days before.`
          : `Average attendance over the last 7 days is ${percent(rateLast7Days)}, ${points > 0 ? "up" : "down"} ${Math.abs(points).toFixed(1)} points from the 7 days before.`,
        delta: unchanged ? undefined : { value: `${points > 0 ? "+" : "−"}${Math.abs(points).toFixed(1)} pts`, positive: points > 0 },
        sparkline: recordedSeries(trend.slice(-14)),
      });
    } else if (rateLast7Days !== null) {
      insights.push({
        icon: CalendarCheck,
        title: "Attendance",
        body: `Average attendance over the last 7 days is ${percent(rateLast7Days)}. There isn't an earlier week recorded to compare against yet.`,
        sparkline: recordedSeries(trend.slice(-14)),
      });
    } else {
      insights.push({ icon: CalendarCheck, title: "Attendance", body: "No attendance has been recorded in the last 7 days." });
    }
  }

  if (summary.employees) {
    const { hiredThisMonth, hiredLastMonth } = summary.employees;
    const diff = hiredThisMonth - hiredLastMonth;
    insights.push({
      icon: UserPlus,
      title: "Hiring",
      body:
        hiredThisMonth === 0 && hiredLastMonth === 0
          ? "No new hires this month or last month."
          : `${hiredThisMonth} ${hiredThisMonth === 1 ? "person has" : "people have"} joined this month, versus ${hiredLastMonth} last month.`,
      delta: diff === 0 ? undefined : { value: `${diff > 0 ? "+" : "−"}${Math.abs(diff)}`, positive: diff > 0 },
    });
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Lightbulb className="h-4 w-4 text-amber-500" />
          Insights
        </CardTitle>
        <p className="text-xs text-muted-foreground">Computed from your attendance and HR records</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {insights.map((insight) => (
          <div key={insight.title} className="rounded-lg border border-border p-3">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                <insight.icon className="h-4 w-4 text-primary" />
                {insight.title}
              </span>
              {insight.delta && (
                <span className={cn("flex items-center gap-0.5 text-xs font-medium", insight.delta.positive ? "text-emerald-500" : "text-red-500")}>
                  {insight.delta.positive ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                  {insight.delta.value}
                </span>
              )}
            </div>
            <div className="flex items-end justify-between gap-3">
              <p className="text-xs text-muted-foreground">{insight.body}</p>
              {insight.sparkline && insight.sparkline.some((point) => point > 0) && (
                <div className="h-8 w-20 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={insight.sparkline.map((point, index) => ({ index, point }))}>
                      <Line type="monotone" dataKey="point" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function AttentionCard({ summary }: { summary: OrganisationDashboardSummary }) {
  const rows: { icon: LucideIcon; label: string; count: number; href: string }[] = [];

  if (summary.leave) rows.push({ icon: CalendarClock, label: "Leave requests awaiting a decision", count: summary.leave.pendingRequests, href: "/leave" });
  if (summary.documents) {
    rows.push({ icon: FileText, label: "Documents expiring within 30 days", count: summary.documents.expiringWithin30Days, href: "/documents" });
    rows.push({ icon: FileText, label: "Documents already expired", count: summary.documents.expired, href: "/documents" });
  }
  if (summary.compliance) rows.push({ icon: ShieldCheck, label: "Compliance items needing attention", count: summary.compliance.needingAttention, href: "/compliance" });
  if (summary.assistant) rows.push({ icon: Bot, label: "Assistant actions awaiting approval", count: summary.assistant.pendingActions, href: "/assistant" });

  const open = rows.filter((row) => row.count > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Needs your attention</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {open.length === 0 && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            Nothing needs your attention right now.
          </p>
        )}
        {open.map((row) => (
          <Link key={row.label} to={row.href} className="flex items-center justify-between gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-surface">
            <span className="flex min-w-0 items-center gap-2 text-foreground">
              <row.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{row.label}</span>
            </span>
            <Badge variant="danger">{row.count}</Badge>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

function PayrollCard({ payroll }: { payroll: NonNullable<OrganisationDashboardSummary["payroll"]> }) {
  const run = payroll.latestRun;
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm">Payroll</CardTitle>
        <Link to="/payroll" className="text-xs text-primary hover:underline">
          View all
        </Link>
      </CardHeader>
      <CardContent>
        {!run ? (
          <p className="text-sm text-muted-foreground">No payroll has been run yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="text-sm text-muted-foreground">
              {new Date(run.periodYear, run.periodMonth - 1).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
            </div>
            <div className="text-2xl font-semibold text-foreground">{formatMoney(run.totalNetMinor, run.currency)}</div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              Net pay
              <Badge variant={run.disbursementStatus === "DISBURSED" ? "success" : run.disbursementStatus === "NOT_DISBURSED" ? "outline" : "danger"}>
                {humanizeAction(run.disbursementStatus)}
              </Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading dashboard">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-lg bg-surface" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="h-72 animate-pulse rounded-lg bg-surface xl:col-span-2" />
        <div className="h-72 animate-pulse rounded-lg bg-surface" />
      </div>
    </div>
  );
}
