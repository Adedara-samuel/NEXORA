"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import type { Permission, Role } from "@nexora/types";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Checkbox, Input, Label, Reveal, useToast } from "@nexora/ui";
import { NexoraApiError } from "@nexora/api-client";
import { AppShell } from "@/components/app-shell";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth-store";

export default function RolesPage() {
  const hasPermission = useAuthStore((state) => state.hasPermission);

  return (
    <AppShell>
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <Reveal>
          <h1 className="text-2xl font-semibold text-foreground">Platform Roles</h1>
          <p className="text-sm text-muted-foreground">
            A role is a named bundle of permissions. Assigning a role to a platform user determines exactly which
            menus and actions they can see — nothing more.
          </p>
        </Reveal>

        {hasPermission("platform_roles:manage") && (
          <Reveal delayMs={60}>
            <CreateRoleForm />
          </Reveal>
        )}
        <RolesList canManage={hasPermission("platform_roles:manage")} />
      </div>
    </AppShell>
  );
}

function groupByCategory(permissions: Permission[]): Record<string, Permission[]> {
  return permissions.reduce<Record<string, Permission[]>>((groups, permission) => {
    (groups[permission.category] ??= []).push(permission);
    return groups;
  }, {});
}

function CreateRoleForm() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const permissionsQuery = useQuery({ queryKey: ["platform-permissions"], queryFn: () => apiClient.rbac.listPermissions() });
  const grouped = useMemo(() => groupByCategory(permissionsQuery.data ?? []), [permissionsQuery.data]);

  const createMutation = useMutation({
    mutationFn: () =>
      apiClient.rbac.createRole({ name: name.trim().toUpperCase(), description: description.trim() || undefined, permissionKeys: Array.from(selected) }),
    onSuccess: () => {
      toast({ variant: "success", title: "Role created", description: `${name.trim().toUpperCase()} is ready to assign.` });
      queryClient.invalidateQueries({ queryKey: ["platform-roles"] });
      setName("");
      setDescription("");
      setSelected(new Set());
    },
    onError: (error) => {
      const message = error instanceof NexoraApiError ? error.message : "Could not create role.";
      toast({ variant: "error", title: "Role creation failed", description: message });
    },
  });

  const togglePermission = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create a role</CardTitle>
        <CardDescription>Pick exactly the permissions this role should grant — everything else stays hidden.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="role-name">Name</Label>
            <Input
              id="role-name"
              placeholder="e.g. ONBOARDING_AGENT"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="role-description">Description (optional)</Label>
            <Input
              id="role-description"
              placeholder="What this role is for"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {Object.entries(grouped).map(([category, permissions]) => (
            <div key={category} className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{category}</span>
              <div className="grid gap-2 sm:grid-cols-2">
                {permissions.map((permission) => (
                  <label key={permission.key} className="flex items-start gap-2 text-sm text-foreground">
                    <Checkbox checked={selected.has(permission.key)} onChange={() => togglePermission(permission.key)} className="mt-0.5" />
                    <span>
                      <span className="font-medium">{permission.key}</span>
                      <span className="block text-xs text-muted-foreground">{permission.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <Button
          onClick={() => createMutation.mutate()}
          disabled={!name.trim() || createMutation.isPending}
          className="self-start"
        >
          <Plus className="h-4 w-4" />
          {createMutation.isPending ? "Creating…" : "Create role"}
        </Button>
      </CardContent>
    </Card>
  );
}

function RolesList({ canManage }: { canManage: boolean }) {
  const rolesQuery = useQuery({ queryKey: ["platform-roles"], queryFn: () => apiClient.rbac.listRoles() });

  if (rolesQuery.isLoading) return <p className="text-sm text-muted-foreground">Loading roles…</p>;
  if (rolesQuery.isError) return <p className="text-sm text-danger">Could not load roles.</p>;

  return (
    <div className="flex flex-col gap-3">
      {rolesQuery.data?.map((role, index) => (
        <Reveal key={role.id} delayMs={Math.min(index * 40, 320)}>
          <RoleRow role={role} canManage={canManage} />
        </Reveal>
      ))}
    </div>
  );
}

function RoleRow({ role, canManage }: { role: Role; canManage: boolean }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set(role.permissions));

  const permissionsQuery = useQuery({ queryKey: ["platform-permissions"], queryFn: () => apiClient.rbac.listPermissions(), enabled: editing });
  const grouped = useMemo(() => groupByCategory(permissionsQuery.data ?? []), [permissionsQuery.data]);

  const updateMutation = useMutation({
    mutationFn: () => apiClient.rbac.updateRole(role.id, { permissionKeys: Array.from(selected) }),
    onSuccess: () => {
      toast({ variant: "success", title: "Role updated", description: `${role.name}'s permissions were saved.` });
      queryClient.invalidateQueries({ queryKey: ["platform-roles"] });
      setEditing(false);
    },
    onError: (error) => {
      const message = error instanceof NexoraApiError ? error.message : "Could not update role.";
      toast({ variant: "error", title: "Update failed", description: message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiClient.rbac.deleteRole(role.id),
    onSuccess: () => {
      toast({ variant: "success", title: "Role deleted", description: `${role.name} was removed.` });
      queryClient.invalidateQueries({ queryKey: ["platform-roles"] });
    },
    onError: (error) => {
      const message = error instanceof NexoraApiError ? error.message : "Could not delete role.";
      toast({ variant: "error", title: "Delete failed", description: message });
    },
  });

  const togglePermission = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            {role.name}
            {role.isSystem && <Badge variant="outline">System</Badge>}
          </CardTitle>
          {role.description && <CardDescription>{role.description}</CardDescription>}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {role.permissions.length === 0 && <span className="text-xs text-muted-foreground">No permissions granted</span>}
            {role.permissions.map((key) => (
              <Badge key={key}>{key}</Badge>
            ))}
          </div>
        </div>
        {canManage && (
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing((v) => !v)}>
              {editing ? "Cancel" : "Edit"}
            </Button>
            {!role.isSystem && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                aria-label={`Delete ${role.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </CardHeader>

      {editing && (
        <CardContent className="flex flex-col gap-4 border-t border-border pt-4">
          {Object.entries(grouped).map(([category, permissions]) => (
            <div key={category} className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{category}</span>
              <div className="grid gap-2 sm:grid-cols-2">
                {permissions.map((permission) => (
                  <label key={permission.key} className="flex items-center gap-2 text-sm text-foreground">
                    <Checkbox checked={selected.has(permission.key)} onChange={() => togglePermission(permission.key)} />
                    {permission.key}
                  </label>
                ))}
              </div>
            </div>
          ))}
          <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending} className="self-start">
            {updateMutation.isPending ? "Saving…" : "Save permissions"}
          </Button>
        </CardContent>
      )}
    </Card>
  );
}
