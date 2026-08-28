import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  SplashScreen,
  Reveal,
  ThemeProvider,
  ThemeToggle,
  ToastProvider,
  Wordmark,
} from "@nexora/ui";
import { apiClient } from "./lib/api-client";

export function App() {
  const health = useQuery({
    queryKey: ["core-api-health"],
    queryFn: () => apiClient.health(),
    retry: false,
  });

  return (
    <ThemeProvider>
      <ToastProvider>
        <SplashScreen logoSrc="/nexora-logo.png" ready={!health.isLoading}>
          <main className="relative flex min-h-screen items-center justify-center bg-background px-4">
            <ThemeToggle className="absolute right-4 top-4" />
            <Reveal>
              <div className="mb-6 flex flex-col items-center gap-2">
                <img src="/nexora-logo.png" alt="" className="h-10 w-10 object-contain" draggable={false} />
                <Wordmark size="md" />
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Organisation Desktop</p>
              </div>
              <Card className="w-full max-w-md">
                <CardHeader>
                  <CardTitle>One app, every organisation</CardTitle>
                  <CardDescription>
                    Login, organisation configuration, modules, roles and permissions are all resolved from the
                    authenticated session — built out in Phase 4.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-foreground">
                    Core API connection:{" "}
                    {health.isLoading && <span className="text-muted-foreground">checking…</span>}
                    {health.isError && <span className="text-danger">unreachable</span>}
                    {health.data && <span className="text-accent">{health.data.status}</span>}
                  </p>
                </CardContent>
              </Card>
            </Reveal>
          </main>
        </SplashScreen>
      </ToastProvider>
    </ThemeProvider>
  );
}
