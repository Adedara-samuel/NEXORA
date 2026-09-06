import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Plus } from "lucide-react";
import type { OrganisationUser, OrganisationUserStatus } from "@nexora/types";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Checkbox, Input, Label, Reveal, useToast } from "@nexora/ui";
import { NexoraApiError } from "@nexora/api-client";
import { AppShell } from "../components/app-shell";
import { apiClient } from "../lib/api-client";
import { useAuthStore } from "../store/auth-store";

const STATUS_VARIANT: Record<OrganisationUserStatus, "success" | "danger"> = { ACTIVE: "success", DISABLED: "danger" };

const selectClassName =
  "h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

export default function OrganisationUsersPage() {
  const hasPermission = useAuthStore((state) => state.hasPermission);

  return (
    <AppShell>
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <Reveal>
          <h1 className="text-2xl font-semibold text-foreground">Organisation Users</h1>
          <p className="text-sm text-muted-foreground">Staff accounts with login access — distinct from Employees, which are HR records.</p>
        </Reveal>

        {hasPermission("org_users:create") && (
          <Reveal delayMs={60}>
            <CreateUserForm />
          </Reveal>
        )}
        <UsersList canUpdate={hasPermission("org_users:update")} />
      </div>
    </AppShell>
  );
}

function CreateUserForm() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const rolesQuery = useQuery({ queryKey: ["organisation-roles"], queryFn: () => apiClient.organisationRbac.listRoles() });
  const departmentsQuery = useQuery({ queryKey: ["departments"], queryFn: () => apiClient.organisationStructure.listDepartments() });
  const branchesQuery = useQuery({ queryKey: ["branches"], queryFn: () => apiClient.organisationStructure.listBranches() });

  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [departmentId, setDepartmentId] = useState("");
  const [branchId, setBranchId] = useState("");

  const toggleRole = (roleId: string) =>
    setRoleIds((current) => (current.includes(roleId) ? current.filter((id) => id !== roleId) : [...current, roleId]));

  const createMutation = useMutation({
    mutationFn: () =>
      apiClient.organisationUsers.create({
        email: email.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        password,
        roleIds,
        departmentId: departmentId || undefined,
        branchId: branchId || undefined,
      }),
    onSuccess: (user) => {
      toast({ variant: "success", title: "User added", description: `${user.firstName} ${user.lastName} can now sign in.` });
      queryClient.invalidateQueries({ queryKey: ["organisation-users"] });
      setEmail("");
      setFirstName("");
      setLastName("");
      setPassword("");
      setRoleIds([]);
      setDepartmentId("");
      setBranchId("");
    },
    onError: (error) => {
      const message = error instanceof NexoraApiError ? error.message : "Could not add user.";
      toast({ variant: "error", title: "Could not add user", description: message });
    },
  });

  const canSubmit = email.trim() && firstName.trim() && lastName.trim() && password.length >= 8;
  const roles = rolesQuery.data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add a user</CardTitle>
        <CardDescription>They'll sign in with this email and password immediately.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="user-first-name">First name</Label>
            <Input id="user-first-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="user-last-name">Last name</Label>
            <Input id="user-last-name" value={lastName} onChange={(event) => setLastName(event.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="user-email">Email</Label>
            <Input id="user-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="user-password">Password (min 8 characters)</Label>
            <Input id="user-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="user-department">Department (optional)</Label>
            <select id="user-department" className={selectClassName} value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
              <option value="">None</option>
              {(departmentsQuery.data ?? []).map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="user-branch">Branch (optional)</Label>
            <select id="user-branch" className={selectClassName} value={branchId} onChange={(event) => setBranchId(event.target.value)}>
              <option value="">None</option>
              {(branchesQuery.data ?? []).map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label>Roles</Label>
          <div className="flex flex-wrap gap-3">
            {roles.map((role) => (
              <label key={role.id} className="flex items-center gap-2 text-sm text-foreground">
                <Checkbox checked={roleIds.includes(role.id)} onChange={() => toggleRole(role.id)} />
                {role.name}
              </label>
            ))}
            {roles.length === 0 && <p className="text-sm text-muted-foreground">No roles yet — add one on the Roles page first.</p>}
          </div>
        </div>
        <Button onClick={() => createMutation.mutate()} disabled={!canSubmit || createMutation.isPending} className="self-start">
          <Plus className="h-4 w-4" />
          {createMutation.isPending ? "Adding…" : "Add user"}
        </Button>
      </CardContent>
    </Card>
  );
}

function UsersList({ canUpdate }: { canUpdate: boolean }) {
  const usersQuery = useQuery({ queryKey: ["organisation-users"], queryFn: () => apiClient.organisationUsers.list({ page: 1, pageSize: 100 }) });

  if (usersQuery.isLoading) return <p className="text-sm text-muted-foreground">Loading users…</p>;
  if (usersQuery.isError) return <p className="text-sm text-danger">Could not load users.</p>;

  const users = usersQuery.data?.items ?? [];
  if (users.length === 0) return <p className="text-sm text-muted-foreground">No users yet.</p>;

  return (
    <div className="flex flex-col gap-3">
      {users.map((user, index) => (
        <Reveal key={user.id} delayMs={Math.min(index * 30, 300)}>
          <UserRow user={user} canUpdate={canUpdate} />
        </Reveal>
      ))}
    </div>
  );
}

function UserRow({ user, canUpdate }: { user: OrganisationUser; canUpdate: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const rolesQuery = useQuery({ queryKey: ["organisation-roles"], queryFn: () => apiClient.organisationRbac.listRoles() });

  const [status, setStatus] = useState<OrganisationUserStatus>(user.status);
  const [roleIds, setRoleIds] = useState<string[]>(() => {
    const roles = rolesQuery.data ?? [];
    return roles.filter((role) => user.roles.includes(role.name)).map((role) => role.id);
  });

  const roles = rolesQuery.data ?? [];
  const toggleRole = (roleId: string) => setRoleIds((current) => (current.includes(roleId) ? current.filter((id) => id !== roleId) : [...current, roleId]));

  const updateMutation = useMutation({
    mutationFn: () => apiClient.organisationUsers.update(user.id, { status, roleIds }),
    onSuccess: () => {
      toast({ variant: "success", title: "User updated" });
      queryClient.invalidateQueries({ queryKey: ["organisation-users"] });
      setExpanded(false);
    },
    onError: (error) => {
      const message = error instanceof NexoraApiError ? error.message : "Could not update user.";
      toast({ variant: "error", title: "Update failed", description: message });
    },
  });

  return (
    <Card>
      <CardHeader
        className={`flex-row items-start justify-between gap-4 ${canUpdate ? "cursor-pointer" : ""}`}
        onClick={() => canUpdate && setExpanded((value) => !value)}
      >
        <div className="min-w-0 flex-1">
          <CardTitle className="flex flex-wrap items-center gap-2">
            {user.firstName} {user.lastName}
            <Badge variant={STATUS_VARIANT[user.status]}>{user.status}</Badge>
          </CardTitle>
          <CardDescription>
            {user.email}
            {user.roles.length > 0 ? ` · ${user.roles.join(", ")}` : ""}
          </CardDescription>
        </div>
        {canUpdate && <div className="shrink-0 text-muted-foreground">{expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</div>}
      </CardHeader>
      {expanded && canUpdate && (
        <CardContent className="flex flex-col gap-4 border-t border-border pt-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`user-status-${user.id}`}>Status</Label>
            <select
              id={`user-status-${user.id}`}
              className={`${selectClassName} sm:w-48`}
              value={status}
              onChange={(event) => setStatus(event.target.value as OrganisationUserStatus)}
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="DISABLED">DISABLED</option>
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Roles</Label>
            <div className="flex flex-wrap gap-3">
              {roles.map((role) => (
                <label key={role.id} className="flex items-center gap-2 text-sm text-foreground">
                  <Checkbox checked={roleIds.includes(role.id)} onChange={() => toggleRole(role.id)} />
                  {role.name}
                </label>
              ))}
            </div>
          </div>
          <Button size="sm" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending} className="self-start">
            {updateMutation.isPending ? "Saving…" : "Save changes"}
          </Button>
        </CardContent>
      )}
    </Card>
  );
}
