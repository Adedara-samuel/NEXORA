"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import type { BillingCycle } from "@nexora/types";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Checkbox, Input, Label, Reveal, useToast } from "@nexora/ui";
import { NexoraApiError } from "@nexora/api-client";
import { AppShell } from "@/components/app-shell";
import { apiClient } from "@/lib/api-client";
import { formatMoney } from "@/lib/format";
import { useAuthStore } from "@/store/auth-store";

export default function BillingPage() {
  const hasPermission = useAuthStore((state) => state.hasPermission);

  return (
    <AppShell>
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <Reveal>
          <h1 className="text-2xl font-semibold text-foreground">Billing</h1>
          <p className="text-sm text-muted-foreground">
            Plans and the modules each one unlocks. Payments run through a mock gateway until the real integration
            is wired in — every renewal here is simulated.
          </p>
        </Reveal>

        {hasPermission("billing:manage_plans") && (
          <Reveal delayMs={60}>
            <CreatePlanForm />
          </Reveal>
        )}
        <PlansList />
      </div>
    </AppShell>
  );
}

function CreatePlanForm() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("MONTHLY");
  const [selectedModules, setSelectedModules] = useState<Set<string>>(new Set());

  const modulesQuery = useQuery({ queryKey: ["billing-modules"], queryFn: () => apiClient.billing.listModules() });

  const createMutation = useMutation({
    mutationFn: () =>
      apiClient.billing.createPlan({
        name: name.trim(),
        description: description.trim() || undefined,
        priceMinor: Math.round(Number(price) * 100),
        currency: "NGN",
        billingCycle,
        moduleKeys: Array.from(selectedModules),
      }),
    onSuccess: (plan) => {
      toast({ variant: "success", title: "Plan created", description: `${plan.name} is ready to assign to organisations.` });
      queryClient.invalidateQueries({ queryKey: ["billing-plans"] });
      setName("");
      setDescription("");
      setPrice("");
      setSelectedModules(new Set());
    },
    onError: (error) => {
      const message = error instanceof NexoraApiError ? error.message : "Could not create plan.";
      toast({ variant: "error", title: "Plan creation failed", description: message });
    },
  });

  const toggleModule = (key: string) => {
    setSelectedModules((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const canSubmit = name.trim() && Number(price) >= 0 && price !== "";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create a plan</CardTitle>
        <CardDescription>Price is in your default currency (NGN) — enter the amount, not minor units.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="plan-name">Name</Label>
            <Input id="plan-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Starter" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="plan-price">Price</Label>
            <Input id="plan-price" type="number" min={0} step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="plan-description">Description (optional)</Label>
            <Input id="plan-description" value={description} onChange={(event) => setDescription(event.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="plan-cycle">Billing cycle</Label>
            <select
              id="plan-cycle"
              value={billingCycle}
              onChange={(event) => setBillingCycle(event.target.value as BillingCycle)}
              className="h-10 rounded-md border border-border bg-background/60 px-3 text-sm text-foreground"
            >
              <option value="MONTHLY">Monthly</option>
              <option value="ANNUALLY">Annually</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">Included modules</span>
          <div className="flex flex-wrap gap-3">
            {modulesQuery.data?.map((module) => (
              <label key={module.key} className="flex items-center gap-2 text-sm text-foreground">
                <Checkbox checked={selectedModules.has(module.key)} onChange={() => toggleModule(module.key)} />
                {module.name}
              </label>
            ))}
          </div>
        </div>

        <Button onClick={() => createMutation.mutate()} disabled={!canSubmit || createMutation.isPending} className="self-start">
          <Plus className="h-4 w-4" />
          {createMutation.isPending ? "Creating…" : "Create plan"}
        </Button>
      </CardContent>
    </Card>
  );
}

function PlansList() {
  const plansQuery = useQuery({ queryKey: ["billing-plans"], queryFn: () => apiClient.billing.listPlans() });

  if (plansQuery.isLoading) return <p className="text-sm text-muted-foreground">Loading plans…</p>;
  if (plansQuery.isError) return <p className="text-sm text-danger">Could not load plans.</p>;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {plansQuery.data?.map((plan, index) => (
        <Reveal key={plan.id} delayMs={Math.min(index * 60, 240)}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              {plan.name}
              {!plan.isActive && <Badge variant="outline">Inactive</Badge>}
            </CardTitle>
            <CardDescription>{plan.description}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-2xl font-semibold text-foreground">
              {formatMoney(plan.priceMinor, plan.currency)}
              <span className="text-sm font-normal text-muted-foreground">/{plan.billingCycle === "MONTHLY" ? "mo" : "yr"}</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {plan.moduleKeys.map((key) => (
                <Badge key={key} variant="outline">
                  {key}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
        </Reveal>
      ))}
    </div>
  );
}
