import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LogOut, Menu, X } from "lucide-react";
import { ThemeToggle, Wordmark, cn } from "@nexora/ui";
import { NAV_ITEMS } from "../lib/nav";
import { apiClient } from "../lib/api-client";
import { useAuthStore } from "../store/auth-store";

/**
 * Shared shell for every authenticated page: redirects to /login when
 * signed out, filters the sidebar to only the nav items the current user's
 * permissions (embedded in their access token) allow, and collapses into an
 * off-canvas drawer below the `md` breakpoint so it works on a phone-sized
 * viewport, not just desktop.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const accessToken = useAuthStore((state) => state.accessToken);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const organisationSlug = useAuthStore((state) => state.organisationSlug);
  const permissions = useAuthStore((state) => state.permissions);
  const clear = useAuthStore((state) => state.clear);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!accessToken) navigate("/login", { replace: true });
  }, [accessToken, navigate]);

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  if (!accessToken) return null;

  const visibleItems = NAV_ITEMS.filter((item) => !item.permission || permissions.includes(item.permission));

  const handleLogout = async () => {
    if (refreshToken) await apiClient.auth.logout(refreshToken).catch(() => undefined);
    clear();
    navigate("/login", { replace: true });
  };

  const sidebarContent = (
    <>
      <div className="mb-8 flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <img src="/nexora-logo.png" alt="" className="h-6 w-6 object-contain" draggable={false} />
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
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
