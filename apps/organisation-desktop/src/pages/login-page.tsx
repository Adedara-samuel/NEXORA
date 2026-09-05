import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Eye, EyeOff, Lock, Mail, Building2 } from "lucide-react";
import { organisationLoginSchema, type OrganisationLoginInput } from "@nexora/validation";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, Reveal, ThemeToggle, Wordmark, useToast } from "@nexora/ui";
import { NexoraApiError } from "@nexora/api-client";
import { apiClient } from "../lib/api-client";
import { useAuthStore } from "../store/auth-store";

export function LoginPage() {
  const navigate = useNavigate();
  const setTokens = useAuthStore((state) => state.setTokens);
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OrganisationLoginInput>({ resolver: zodResolver(organisationLoginSchema) });

  const loginMutation = useMutation({
    mutationFn: (input: OrganisationLoginInput) => apiClient.auth.organisationLogin(input.organisationSlug, input.email, input.password),
    onSuccess: (tokens, variables) => {
      setTokens(tokens, variables.organisationSlug);
      navigate("/employees", { replace: true });
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
      toast({ variant: "error", title: "Can't reach NEXORA", description: "The Core API didn't respond. Check your connection and try again." });
    },
  });

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-background px-4">
      <ThemeToggle className="absolute right-4 top-4" />
      <Reveal className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-2">
          <img src="/nexora-logo.png" alt="" className="h-10 w-10 object-contain" draggable={false} />
          <Wordmark size="md" />
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Organisation Desktop</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>Use your organisation's slug and your staff account credentials.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-4" onSubmit={handleSubmit((values) => loginMutation.mutate(values))} noValidate>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="organisationSlug">Organisation</Label>
                <div className="relative">
                  <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="organisationSlug" autoComplete="organization" placeholder="acme-cooperative" className="pl-9" {...register("organisationSlug")} />
                </div>
                {errors.organisationSlug && <p className="text-sm text-danger">{errors.organisationSlug.message}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="email" type="email" autoComplete="email" className="pl-9" {...register("email")} />
                </div>
                {errors.email && <p className="text-sm text-danger">{errors.email.message}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password">Password</Label>
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
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-sm text-danger">{errors.password.message}</p>}
              </div>
              <Button type="submit" disabled={loginMutation.isPending} className="mt-2">
                {loginMutation.isPending ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </Reveal>
    </main>
  );
}
