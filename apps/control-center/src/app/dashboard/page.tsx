"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Reveal, ThemeToggle, Wordmark } from "@nexora/ui";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth-store";

export default function DashboardPage() {
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.accessToken);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const clear = useAuthStore((state) => state.clear);

  useEffect(() => {
    if (!accessToken) router.replace("/login");
  }, [accessToken, router]);

  if (!accessToken) return null;

  const handleLogout = async () => {
    if (refreshToken) await apiClient.auth.logout(refreshToken).catch(() => undefined);
    clear();
    router.replace("/login");
  };

  return (
    <main className="min-h-screen bg-background">
      <header className="flex items-center justify-between gap-2 border-b border-border px-6 py-4">
        <div className="flex items-center gap-2">
          <img src="/nexora-logo.png" alt="" className="h-6 w-6 object-contain" draggable={false} />
          <Wordmark size="sm" />
          <span className="ml-1 text-xs uppercase tracking-[0.25em] text-muted-foreground">Control Center</span>
        </div>
        <ThemeToggle />
      </header>

      <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-16">
        <Reveal>
          <Card>
            <CardHeader>
              <CardTitle>Welcome back</CardTitle>
              <CardDescription>
                Authentication foundation is live: JWT access/refresh tokens issued by the Core API are verified on
                every request. Organisation onboarding, subscriptions and platform RBAC land in the next phases.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={handleLogout}>
                Log out
              </Button>
            </CardContent>
          </Card>
        </Reveal>
      </div>
    </main>
  );
}
