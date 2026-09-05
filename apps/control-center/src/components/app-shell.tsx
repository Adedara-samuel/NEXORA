"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { ThemeToggle, Wordmark, cn } from "@nexora/ui";
import { NAV_ITEMS } from "@/lib/nav";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth-store";

/**
 * Shared shell for every authenticated page: redirects to /login when
 * signed out, and filters the sidebar to only the nav items the current
 * user's permissions (embedded in their access token) allow — this is the
 * "roles determine what you can see" behaviour end to end.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const accessToken = useAuthStore((state) => state.accessToken);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const permissions = useAuthStore((state) => state.permissions);
  const clear = useAuthStore((state) => state.clear);

  useEffect(() => {
    if (!accessToken) router.replace("/login");
  }, [accessToken, router]);

  if (!accessToken) return null;

  const visibleItems = NAV_ITEMS.filter((item) => !item.permission || permissions.includes(item.permission));

  const handleLogout = async () => {
    if (refreshToken) await apiClient.auth.logout(refreshToken).catch(() => undefined);
    clear();
    router.replace("/login");
  };

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="flex w-60 shrink-0 flex-col border-r border-border px-4 py-6">
        <div className="mb-8 flex items-center gap-2 px-2">
          <img src="/nexora-logo.png" alt="" className="h-6 w-6 object-contain" draggable={false} />
          <Wordmark size="sm" />
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {visibleItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
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
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border px-6 py-4">
          <span className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Control Center</span>
          <ThemeToggle />
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
