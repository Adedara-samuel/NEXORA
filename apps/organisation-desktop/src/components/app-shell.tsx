import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AlertTriangle, LockKeyhole, LogOut, Menu, X } from "lucide-react";
import { PoweredBySapok, ThemeToggle, Wordmark, cn } from "@nexora/ui";
import { NAV_ITEMS } from "../lib/nav";
import { apiClient } from "../lib/api-client";
import { useAuthStore } from "../store/auth-store";
import { isOrganisationLockedOut, useEntitlements } from "../lib/entitlements";

const LOCKOUT_COPY: Record<string, { title: string; body: string }> = {
  PENDING: { title: "Your organisation isn't active yet", body: "A platform administrator needs to activate your organisation before you can sign in and use Sapok OneGrid." },
  SUSPENDED: { title: "Access suspended", body: "Your organisation's access has been suspended by a platform administrator. Contact them to restore it." },
  ARCHIVED: { title: "Organisation archived", body: "This organisation has been archived and is no longer accessible." },
  SUBSCRIPTION: { title: "Subscription inactive", body: "Your organisation's subscription isn't active. Contact your platform administrator to renew it." },
};

/**
 * Shared shell for every authenticated page: redirects to /login when
 * signed out, filters the sidebar to only the nav items the current user's
 * permissions AND the organisation's plan allow, and — new in the
 * module-entitlement phase — replaces the whole app with a lockout screen
 * the moment the organisation itself isn't ACTIVE or its subscription can't
 * fund access, since every API call would 402 anyway. Collapses into an
 * off-canvas drawer below the `md` breakpoint so it works on a phone-sized
 * viewport, not just desktop.
 */
export function AppShell({ children, requiredModule }: { children: ReactNode; requiredModule?: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const accessToken = useAuthStore((state) => state.accessToken);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const organisationSlug = useAuthStore((state) => state.organisationSlug);
  const permissions = useAuthStore((state) => state.permissions);
  const clear = useAuthStore((state) => state.clear);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const entitlementsQuery = useEntitlements();
  const entitlements = entitlementsQuery.data;

  useEffect(() => {
    if (!accessToken) navigate("/login", { replace: true });
  }, [accessToken, navigate]);

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  if (!accessToken) return null;

  const handleLogout = async () => {
    if (refreshToken) await apiClient.auth.logout(refreshToken).catch(() => undefined);
    clear();
    navigate("/login", { replace: true });
  };

  const lockedOut = isOrganisationLockedOut(entitlements);
  const lockoutCopy = entitlements
    ? entitlements.organisationStatus !== "ACTIVE"
      ? LOCKOUT_COPY[entitlements.organisationStatus]
      : LOCKOUT_COPY.SUBSCRIPTION
    : undefined;

  const visibleItems = NAV_ITEMS.filter(
    (item) => (!item.permission || permissions.includes(item.permission)) && (!item.moduleKey || !entitlements || entitlements.effectiveModuleKeys.includes(item.moduleKey)),
  );

  const moduleMissing = !!requiredModule && !!entitlements && !lockedOut && !entitlements.effectiveModuleKeys.includes(requiredModule);

  const sidebarContent = (
    <>
      <div className="mb-8 flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <img src="/onegrid-icon.png" alt="" className="h-6 w-6 object-contain" draggable={false} />
          <Wordmark size="sm" />
        </div>
        <button className="text-muted-foreground hover:text-foreground md:hidden" onClick={() => setDrawerOpen(false)} aria-label="Close menu">
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {visibleItems.map((item) => {
          const active = location.pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-surface text-foreground" : "text-muted-foreground hover:bg-surface hover:text-foreground",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <button
        onClick={handleLogout}
        className="flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
      >
        <LogOut className="h-4 w-4" />
        Log out
      </button>

      <PoweredBySapok className="mt-4 justify-center" />
    </>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border px-4 py-6 md:flex">{sidebarContent}</aside>

      {/* Mobile off-canvas drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-border bg-background px-4 py-6 shadow-lg">
            {sidebarContent}
          </aside>
        </div>
      )}

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button className="text-muted-foreground hover:text-foreground md:hidden" onClick={() => setDrawerOpen(true)} aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </button>
            <span className="text-xs uppercase tracking-[0.25em] text-muted-foreground">{organisationSlug ?? "Organisation Desktop"}</span>
          </div>
          <ThemeToggle />
        </header>

        {entitlements?.subscriptionStatus === "GRACE_PERIOD" && !lockedOut && (
          <div className="flex items-center gap-2 border-b border-amber-400/30 bg-amber-400/10 px-4 py-2 text-sm text-amber-400 sm:px-6">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              Your subscription payment is overdue{entitlements.gracePeriodEndsAt ? ` — access will be suspended after ${new Date(entitlements.gracePeriodEndsAt).toLocaleDateString()} unless renewed` : ""}. Contact your platform administrator.
            </span>
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {lockedOut && lockoutCopy ? (
            <LockoutScreen title={lockoutCopy.title} body={lockoutCopy.body} onLogout={handleLogout} />
          ) : moduleMissing ? (
            <ModuleNotIncludedScreen planName={entitlements?.planName ?? null} />
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}

function LockoutScreen({ title, body, onLogout }: { title: string; body: string; onLogout: () => void }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-24 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-danger/10 text-danger">
        <LockKeyhole className="h-6 w-6" />
      </div>
      <h1 className="text-xl font-semibold text-foreground">{title}</h1>
      <p className="text-sm text-muted-foreground">{body}</p>
      <button onClick={onLogout} className="mt-2 text-sm font-medium text-primary hover:underline">
        Log out
      </button>
    </div>
  );
}

function ModuleNotIncludedScreen({ planName }: { planName: string | null }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-24 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <LockKeyhole className="h-6 w-6" />
      </div>
      <h1 className="text-xl font-semibold text-foreground">Not included in your plan</h1>
      <p className="text-sm text-muted-foreground">
        {planName ? `Your organisation's ${planName} plan` : "Your organisation's current plan"} doesn't include this feature. Contact your platform administrator to upgrade.
      </p>
    </div>
  );
}
