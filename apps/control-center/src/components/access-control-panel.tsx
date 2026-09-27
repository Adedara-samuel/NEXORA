"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, Button, useToast } from "@nexora/ui";
import { NexoraApiError } from "@nexora/api-client";
import { apiClient } from "@/lib/api-client";

/**
 * The Control Center's "what can this organisation actually do, and can we
 * change it" surface. Reads the SAME EntitlementsService the API guard
 * enforces with, so this preview is never a guess about what the
 * organisation sees — it's the literal computation, live.
 */
export function AccessControlPanel({ organisationId, canManage }: { organisationId: string; canManage: boolean }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const modulesQuery = useQuery({ queryKey: ["billing-modules"], queryFn: () => apiClient.billing.listModules() });
  const entitlementsQuery = useQuery({
    queryKey: ["entitlements", organisationId],
    queryFn: () => apiClient.entitlements.get(organisationId),
  });

  const setOverrideMutation = useMutation({
    mutationFn: ({ moduleKey, granted }: { moduleKey: string; granted: boolean | null }) =>
      apiClient.entitlements.setOverride(organisationId, moduleKey, { granted }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entitlements", organisationId] });
    },
    onError: (error) => {
      const message = error instanceof NexoraApiError ? error.message : "Could not update this module.";
      toast({ variant: "error", title: "Override failed", description: message });
    },
  });

  if (modulesQuery.isLoading || entitlementsQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading access control…</p>;
  }
  if (entitlementsQuery.isError || !entitlementsQuery.data || !modulesQuery.data) {
    return <p className="text-sm text-danger">Could not load access control.</p>;
  }

  const entitlements = entitlementsQuery.data;
  const overrideByModule = new Map(entitlements.overrides.map((override) => [override.moduleKey, override]));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>
          Plan: <span className="font-medium text-foreground">{entitlements.planName ?? "None"}</span>
        </span>
        <span>·</span>
        <span>
          This is exactly what {entitlements.organisationStatus === "ACTIVE" ? "this organisation's users" : "this organisation"} can access right now
          {entitlements.organisationStatus !== "ACTIVE" ? ` — locked out (${entitlements.organisationStatus.toLowerCase()})` : ""}.
        </span>
      </div>

      <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
        {modulesQuery.data.map((module) => {
          const inPlan = entitlements.planModuleKeys.includes(module.key);
          const effective = entitlements.effectiveModuleKeys.includes(module.key);
          const override = overrideByModule.get(module.key);
          const pending = setOverrideMutation.isPending && setOverrideMutation.variables?.moduleKey === module.key;

          return (
            <div key={module.key} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{module.name}</span>
                  <Badge variant={effective ? "success" : "outline"}>{effective ? "Included" : "Not included"}</Badge>
                  {!override && inPlan && <span className="text-xs text-muted-foreground">(plan default)</span>}
                  {override && <span className="text-xs text-muted-foreground">({override.granted ? "manually granted" : "manually revoked"})</span>}
                </div>
                {module.description && <p className="truncate text-xs text-muted-foreground">{module.description}</p>}
              </div>

              {canManage && (
                <div className="flex shrink-0 gap-1.5">
                  <Button
                    size="sm"
                    variant={!override ? "default" : "outline"}
                    disabled={!override || pending}
                    onClick={() => setOverrideMutation.mutate({ moduleKey: module.key, granted: null })}
                  >
                    Plan default
                  </Button>
                  <Button
                    size="sm"
                    variant={override?.granted === true ? "default" : "outline"}
                    disabled={pending}
                    onClick={() => setOverrideMutation.mutate({ moduleKey: module.key, granted: true })}
                  >
                    Force on
                  </Button>
                  <Button
                    size="sm"
                    variant={override?.granted === false ? "destructive" : "outline"}
                    disabled={pending}
                    onClick={() => setOverrideMutation.mutate({ moduleKey: module.key, granted: false })}
                  >
                    Force off
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
