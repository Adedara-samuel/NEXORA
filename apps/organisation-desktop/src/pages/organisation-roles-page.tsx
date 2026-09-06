import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import type { Permission, Role } from "@nexora/types";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Checkbox, Input, Label, Reveal, useToast } from "@nexora/ui";
import { NexoraApiError } from "@nexora/api-client";
import { AppShell } from "../components/app-shell";
import { apiClient } from "../lib/api-client";
import { useAuthStore } from "../store/auth-store";

function groupByCategory(permissions: Permission[]): Map<string, Permission[]> {
  const groups = new Map<string, Permission[]>();
  for (const permission of permissions) {
    const list = groups.get(permission.category) ?? [];
    list.push(permission);
    groups.set(permission.category, list);
  }
  return groups;
}

export default function OrganisationRolesPage() {
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const canManage = hasPermission("org_roles:manage");

  return (
    <AppShell>
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <Reveal>
          <h1 className="text-2xl font-semibold text-foreground">Roles</h1>
          <p className="text-sm text-muted-foreground">Custom roles control what Organisation Users can see and do.</p>
        </Reveal>

        {canManage && (
          <Reveal delayMs={60}>
            <CreateRoleForm />
          </Reveal>
        )}
        <RolesList canManage={canManage} />
      </div>
    </AppShell>
  );
}

function CreateRoleForm() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const permissionsQuery = useQuery({ queryKey: ["organisation-permissions"], queryFn: () => apiClient.organisationRbac.listPermissions() });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [permissionKeys, setPermissionKeys] = useState<string[]>([]);

  const togglePermission = (key: string) =>
    setPermissionKeys((current) => (current.includes(key) ? current.filter((k) => k !== key) : [...current, key]));

  const createMutation = useMutation({
    mutationFn: () => apiClient.organisationRbac.createRole({ name: name.trim().toUpperCase().replace(/\s+/g, "_"), description: description.trim() || undefined, permissionKeys }),
    onSuccess: () => {
      toast({ variant: "success", title: "Role created" });
      queryClient.invalidateQueries({ queryKey: ["organisation-roles"] });
      setName("");
      setDescription("");
      setPermissionKeys([]);
    },
    onError: (error) => {
      const message = error instanceof NexoraApiError ? error.message : "Could not create role.";
      toast({ variant: "error", title: "Could not create role", description: message });
    },
  });

  const groups = groupByCategory(permissionsQuery.data ?? []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create a role</CardTitle>
        <CardDescription>The name is stored as UPPER_SNAKE_CASE — spaces are converted automatically.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="role-name">Name</Label>
            <Input id="role-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Payroll Manager" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="role-description">Description (optional)</Label>
            <Input id="role-description" value={description} onChange={(event) => setDescription(event.target.value)} />
          </div>
        </div>
        <div className="flex flex-col gap-3">
          {Array.from(groups.entries()).map(([category, permissions]) => (
            <div key={category} className="flex flex-col gap-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">{category}</Label>
              <div className="flex flex-wrap gap-3">
                {permissions.map((permission) => (
                  <label key={permission.key} className="flex items-center gap-2 text-sm text-foreground">
                    <Checkbox checked={permissionKeys.includes(permission.key)} onChange={() => togglePermission(permission.key)} />
                    {permission.key}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        <Button onClick={() => createMutation.mutate()} disabled={!name.trim() || createMutation.isPending} className="self-start">
          <Plus className="h-4 w-4" />
          {createMutation.isPending ? "Creating…" : "Create role"}
        </Button>
      </CardContent>
    </Card>
  );
}

function RolesList({ canManage }: { canManage: boolean }) {
  const rolesQuery = useQuery({ queryKey: ["organisation-roles"], queryFn: () => apiClient.organisationRbac.listRoles() });

  if (rolesQuery.isLoading) return <p className="text-sm text-muted-foreground">Loading roles…</p>;
  if (rolesQuery.isError) return <p className="text-sm text-danger">Could not load roles.</p>;

  const roles = rolesQuery.data ?? [];
  if (roles.length === 0) return <p className="text-sm text-muted-foreground">No roles yet.</p>;

  return (
    <div className="flex flex-col gap-3">
      {roles.map((role, index) => (
        <Reveal key={role.id} delayMs={Math.min(index * 30, 300)}>
          <RoleRow role={role} canManage={canManage} />
        </Reveal>
      ))}
    </div>
  );
}

function RoleRow({ role, canManage }: { role: Role; canManage: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const permissionsQuery = useQuery({ queryKey: ["organisation-permissions"], queryFn: () => apiClient.organisationRbac.listPermissions() });

  const [permissionKeys, setPermissionKeys] = useState<string[]>(role.permissions);
  const togglePermission = (key: string) =>
    setPermissionKeys((current) => (current.includes(key) ? current.filter((k) => k !== key) : [...current, key]));

  const updateMutation = useMutation({
    mutationFn: () => apiClient.organisationRbac.updateRole(role.id, { permissionKeys }),
    onSuccess: () => {
      toast({ variant: "success", title: "Role updated" });
      queryClient.invalidateQueries({ queryKey: ["organisation-roles"] });
      setExpanded(false);
    },
    onError: (error) => {
      const message = error instanceof NexoraApiError ? error.message : "Could not update role.";
      toast({ variant: "error", title: "Update failed", description: message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiClient.organisationRbac.deleteRole(role.id),
    onSuccess: () => {
      toast({ variant: "success", title: "Role deleted" });
      queryClient.invalidateQueries({ queryKey: ["organisation-roles"] });
    },
    onError: (error) => {
      const message = error instanceof NexoraApiError ? error.message : "Could not delete role.";
      toast({ variant: "error", title: "Delete failed", description: message });
    },
  });

  const groups = groupByCategory(permissionsQuery.data ?? []);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setExpanded((value) => !value)}>
          <CardTitle className="flex flex-wrap items-center gap-2">
            {role.name}
            {role.isSystem && <Badge variant="outline">SYSTEM</Badge>}
          </CardTitle>
          <CardDescription>{role.description ?? `${role.permissions.length} permission(s)`}</CardDescription>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {canManage && !role.isSystem && (
            <Button size="sm" variant="outline" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate()}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <button onClick={() => setExpanded((value) => !value)} className="text-muted-foreground">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="flex flex-col gap-4 border-t border-border pt-4">
          <div className="flex flex-col gap-3">
            {Array.from(groups.entries()).map(([category, permissions]) => (
              <div key={category} className="flex flex-col gap-1.5">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">{category}</Label>
                <div className="flex flex-wrap gap-3">
                  {permissions.map((permission) => (
                    <label key={permission.key} className="flex items-center gap-2 text-sm text-foreground">
                      <Checkbox
                        checked={permissionKeys.includes(permission.key)}
                        disabled={!canManage}
                        onChange={() => togglePermission(permission.key)}
                      />
                      {permission.key}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {canManage && (
            <Button size="sm" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending} className="self-start">
              {updateMutation.isPending ? "Saving…" : "Save permissions"}
            </Button>
          )}
        </CardContent>
      )}
    </Card>
  );
}
