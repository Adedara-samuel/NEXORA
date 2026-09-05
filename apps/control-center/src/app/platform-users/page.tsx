"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import type { PlatformUser } from "@nexora/types";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Checkbox, Input, Label, useToast } from "@nexora/ui";
import { NexoraApiError } from "@nexora/api-client";
import { AppShell } from "@/components/app-shell";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth-store";

export default function PlatformUsersPage() {
  const hasPermission = useAuthStore((state) => state.hasPermission);

  return (
    <AppShell>
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Platform Users</h1>
          <p className="text-sm text-muted-foreground">Control Center operators and the roles assigned to them.</p>
        </div>

        {hasPermission("platform_users:create") && <CreateUserForm />}
        <UsersList canManage={hasPermission("platform_users:update")} />
      </div>
    </AppShell>
  );
}

function CreateUserForm() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRoleIds, setSelectedRoleIds] = useState<Set<string>>(new Set());

  const rolesQuery = useQuery({ queryKey: ["platform-roles"], queryFn: () => apiClient.rbac.listRoles() });

  const createMutation = useMutation({
    mutationFn: () =>
      apiClient.platformUsers.create({
        email: email.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        password,
        roleIds: Array.from(selectedRoleIds),
      }),
    onSuccess: (user) => {
      toast({ variant: "success", title: "Platform user created", description: `${user.email} can now sign in.` });
      queryClient.invalidateQueries({ queryKey: ["platform-users"] });
      setEmail("");
      setFirstName("");
      setLastName("");
      setPassword("");
      setSelectedRoleIds(new Set());
    },
    onError: (error) => {
      const message = error instanceof NexoraApiError ? error.message : "Could not create platform user.";
      toast({ variant: "error", title: "Creation failed", description: message });
    },
  });

  const toggleRole = (roleId: string) => {
    setSelectedRoleIds((prev) => {
      const next = new Set(prev);
      if (next.has(roleId)) next.delete(roleId);
      else next.add(roleId);
      return next;
    });
  };

  const canSubmit = email.trim() && firstName.trim() && lastName.trim() && password.length >= 8;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add a platform user</CardTitle>
        <CardDescription>Assign at least one role so they land with the right menus on first login.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="user-email">Email</Label>
            <Input id="user-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="user-password">Initial password</Label>
            <Input id="user-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="user-first-name">First name</Label>
            <Input id="user-first-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="user-last-name">Last name</Label>
            <Input id="user-last-name" value={lastName} onChange={(event) => setLastName(event.target.value)} />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">Roles</span>
          <div className="flex flex-wrap gap-3">
            {rolesQuery.data?.map((role) => (
              <label key={role.id} className="flex items-center gap-2 text-sm text-foreground">
                <Checkbox checked={selectedRoleIds.has(role.id)} onChange={() => toggleRole(role.id)} />
                {role.name}
              </label>
            ))}
          </div>
        </div>

        <Button onClick={() => createMutation.mutate()} disabled={!canSubmit || createMutation.isPending} className="self-start">
          <Plus className="h-4 w-4" />
          {createMutation.isPending ? "Creating…" : "Create user"}
        </Button>
      </CardContent>
    </Card>
  );
}

function UsersList({ canManage }: { canManage: boolean }) {
  const usersQuery = useQuery({ queryKey: ["platform-users"], queryFn: () => apiClient.platformUsers.list({ page: 1, pageSize: 50 }) });

  if (usersQuery.isLoading) return <p className="text-sm text-muted-foreground">Loading platform users…</p>;
  if (usersQuery.isError) return <p className="text-sm text-danger">Could not load platform users.</p>;

  return (
    <div className="flex flex-col gap-3">
      {usersQuery.data?.items.map((user) => (
        <UserRow key={user.id} user={user} canManage={canManage} />
      ))}
    </div>
  );
}

function UserRow({ user, canManage }: { user: PlatformUser; canManage: boolean }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const statusMutation = useMutation({
    mutationFn: () => apiClient.platformUsers.update(user.id, { status: user.status === "ACTIVE" ? "DISABLED" : "ACTIVE" }),
    onSuccess: (updated) => {
      toast({ variant: "success", title: "Status updated", description: `${updated.email} is now ${updated.status}.` });
      queryClient.invalidateQueries({ queryKey: ["platform-users"] });
    },
    onError: (error) => {
      const message = error instanceof NexoraApiError ? error.message : "Could not update status.";
      toast({ variant: "error", title: "Update failed", description: message });
    },
  });

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            {user.firstName} {user.lastName}
            <Badge variant={user.status === "ACTIVE" ? "success" : "danger"}>{user.status}</Badge>
          </CardTitle>
          <CardDescription>{user.email}</CardDescription>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {user.roles.length === 0 && <span className="text-xs text-muted-foreground">No roles assigned</span>}
            {user.roles.map((role) => (
              <Badge key={role} variant="outline">
                {role}
              </Badge>
            ))}
          </div>
        </div>
        {canManage && (
          <Button variant="outline" size="sm" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate()}>
            {user.status === "ACTIVE" ? "Disable" : "Reactivate"}
          </Button>
        )}
      </CardHeader>
    </Card>
  );
}
