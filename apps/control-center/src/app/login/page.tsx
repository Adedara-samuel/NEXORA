"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { BarChart3, Eye, EyeOff, Lock, Mail, ShieldCheck, Users, Wallet } from "lucide-react";
import { platformLoginSchema, type PlatformLoginInput } from "@nexora/validation";
import { Button, HudFrame, Input, Label, Logo, Reveal, SystemStatus, ThemeToggle, Wordmark, useToast } from "@nexora/ui";
import { NexoraApiError } from "@nexora/api-client";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth-store";

const FEATURES = [
  { icon: Users, label: "Workforce Management" },
  { icon: Wallet, label: "Payroll & Compensation" },
  { icon: BarChart3, label: "AI Analytics & Insights" },
  { icon: ShieldCheck, label: "Security & Compliance" },
];

export default function LoginPage() {
  const router = useRouter();
  const setTokens = useAuthStore((state) => state.setTokens);
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);

  const health = useQuery({
    queryKey: ["core-api-health-ping"],
    queryFn: async () => {
      const start = performance.now();
      await apiClient.health();
      return performance.now() - start;
    },
    retry: false,
    refetchInterval: 10_000,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PlatformLoginInput>({ resolver: zodResolver(platformLoginSchema) });

  const loginMutation = useMutation({
    mutationFn: (input: PlatformLoginInput) => apiClient.auth.platformLogin(input.email, input.password),
    onSuccess: (tokens) => {
      setTokens(tokens);
      router.push("/dashboard");
    },
    onError: (error) => {
      if (error instanceof NexoraApiError && error.code === "ACCOUNT_DISABLED") {
        toast({ variant: "warning", title: "Account disabled", description: error.message });
        return;
      }
      if (error instanceof NexoraApiError) {
        toast({ variant: "error", title: "Sign-in failed", description: error.message });
        return;
      }
      toast({
        variant: "error",
        title: "Can't reach NEXORA",
        description: "The Core API didn't respond. Check your connection and try again.",
      });
    },
  });

  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-[1.1fr_1fr]">
      {/* Hero panel — hidden below lg, this is the "premium" half */}
      <div className="relative hidden overflow-hidden border-r border-border lg:flex lg:flex-col lg:justify-between lg:px-16 lg:py-14">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,hsl(var(--primary)/0.22),transparent_55%)]" />
        <div className="pointer-events-none absolute -inset-1/4 animate-drift bg-[radial-gradient(circle_at_75%_75%,hsl(var(--accent)/0.1),transparent_45%)]" />
        <CircuitTraces />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--border)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        <Reveal className="relative flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Logo src="/nexora-logo.png" className="h-8 w-8 object-contain" />
            <Wordmark size="sm" />
          </div>
          <SystemStatus status={health.isFetching && !health.data && !health.isError ? "checking" : health.isError ? "offline" : "online"} latencyMs={health.data} />
        </Reveal>

        <Reveal delayMs={100} className="relative flex flex-col gap-8">
          <div className="flex flex-col gap-3">
            <h1 className="max-w-md text-3xl font-semibold leading-tight text-foreground">
              One platform. <span className="text-accent">Complete</span> workforce intelligence.
            </h1>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              Manage every organisation you operate — people, payroll, compliance and AI-driven insight — from a
              single, secure command centre.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {FEATURES.map(({ icon: Icon, label }, i) => (
              <Reveal
                key={label}
                delayMs={150 + i * 80}
                className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 transition-colors hover:border-primary/40"
              >
                <Icon className="h-4 w-4 shrink-0 text-accent" />
                <span className="text-xs font-medium text-foreground">{label}</span>
              </Reveal>
            ))}
          </div>
        </Reveal>

        <Reveal delayMs={200} className="relative text-xs uppercase tracking-[0.3em] text-muted-foreground">
          Developed by <span className="text-foreground">SAPOK TECH</span>
        </Reveal>
      </div>

      {/* Form panel */}
      <div className="relative flex flex-col items-center justify-center px-6 py-16">
        <ThemeToggle className="absolute right-6 top-6" />

        <Reveal className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center gap-2 lg:hidden">
            <Logo src="/nexora-logo.png" className="mb-2 h-12 w-12 object-contain" />
            <Wordmark size="lg" />
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Control Center</p>
          </div>

          <HudFrame className="p-6">
            <div className="mb-6 hidden flex-col gap-1 lg:flex">
              <h2 className="text-2xl font-semibold text-foreground">Sign in</h2>
              <p className="text-sm text-muted-foreground">Platform administrator access only</p>
            </div>

            <form className="flex flex-col gap-4" onSubmit={handleSubmit((values) => loginMutation.mutate(values))} noValidate>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email" className="font-mono text-[0.7rem] tracking-widest text-muted-foreground">
                  <span className="text-accent">{">"}</span> EMAIL
                </Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="email" type="email" autoComplete="email" className="pl-9" {...register("email")} />
                </div>
                {errors.email && <p className="text-sm text-danger">{errors.email.message}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="font-mono text-[0.7rem] tracking-widest text-muted-foreground">
                    <span className="text-accent">{">"}</span> PASSWORD
                  </Label>
                  <span className="text-xs text-muted-foreground">Forgot password?</span>
                </div>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    className="pl-9 pr-9"
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-sm text-danger">{errors.password.message}</p>}
              </div>
              <Button type="submit" disabled={loginMutation.isPending} className="mt-2">
                {loginMutation.isPending ? "Authenticating…" : "Sign in"}
              </Button>
            </form>
          </HudFrame>

          <div className="mt-4 flex justify-center lg:hidden">
            <SystemStatus status={health.isFetching && !health.data && !health.isError ? "checking" : health.isError ? "offline" : "online"} latencyMs={health.data} />
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground lg:hidden">Operated by SAPOK TECH</p>
        </Reveal>
      </div>
    </main>
  );
}

/** Faint animated circuit traces echoing the mark's node-and-line motif. */
function CircuitTraces() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.3]"
      viewBox="0 0 600 800"
      fill="none"
      preserveAspectRatio="xMidYMid slice"
    >
      {/* stroke-dashoffset is what actually animates a dashed SVG line —
          background-position (the `shimmer` utility) has no effect on
          strokes, so these traces used to render as static dashes. */}
      <g stroke="hsl(var(--accent))" strokeWidth="1.5">
        <path d="M40 120 H220 V260 H420" strokeDasharray="6 6" className="animate-circuit-flow" />
        <path d="M560 80 V220 H360 V420" strokeDasharray="6 6" className="animate-circuit-flow-reverse" />
        <path d="M60 620 H240 V500 H480 V680" strokeDasharray="6 6" className="animate-circuit-flow-slow" />
      </g>
      <g fill="hsl(var(--accent))">
        <circle cx="220" cy="120" r="3.5" className="animate-pulse-glow" />
        <circle cx="420" cy="260" r="3.5" className="animate-pulse-glow [animation-delay:0.4s]" />
        <circle cx="360" cy="220" r="3.5" className="animate-pulse-glow [animation-delay:0.8s]" />
        <circle cx="240" cy="620" r="3.5" className="animate-pulse-glow [animation-delay:1.2s]" />
        <circle cx="480" cy="500" r="3.5" className="animate-pulse-glow [animation-delay:1.6s]" />
      </g>
    </svg>
  );
}
