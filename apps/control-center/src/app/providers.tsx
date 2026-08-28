"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SplashScreen, ThemeProvider, ToastProvider } from "@nexora/ui";
import { useAuthHydration } from "@/store/use-auth-hydration";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1 } } }));
  const hydrated = useAuthHydration();

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <SplashScreen logoSrc="/nexora-logo.png" ready={hydrated}>
            {children}
          </SplashScreen>
        </ToastProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
