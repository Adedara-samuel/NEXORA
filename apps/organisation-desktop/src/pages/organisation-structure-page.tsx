import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, Reveal, useToast } from "@nexora/ui";
import { NexoraApiError } from "@nexora/api-client";
import { AppShell } from "../components/app-shell";
import { apiClient } from "../lib/api-client";
import { useAuthStore } from "../store/auth-store";

export default function OrganisationStructurePage() {
  const hasPermission = useAuthStore((state) => state.hasPermission);

  return (
    <AppShell>
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <Reveal>
          <h1 className="text-2xl font-semibold text-foreground">Departments & Branches</h1>
          <p className="text-sm text-muted-foreground">Used by Employees, Attendance and Organisation Users for grouping and filtering.</p>
        </Reveal>

        <div className="grid gap-6 sm:grid-cols-2">
          <DepartmentsSection canManage={hasPermission("departments:manage")} />
          <BranchesSection canManage={hasPermission("branches:manage")} />
        </div>
      </div>
    </AppShell>
  );
}

function DepartmentsSection({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const departmentsQuery = useQuery({ queryKey: ["departments"], queryFn: () => apiClient.organisationStructure.listDepartments() });
  const [name, setName] = useState("");

  const createMutation = useMutation({
    mutationFn: () => apiClient.organisationStructure.createDepartment({ name: name.trim() }),
    onSuccess: () => {
      toast({ variant: "success", title: "Department added" });
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      setName("");
    },
    onError: (error) => {
      const message = error instanceof NexoraApiError ? error.message : "Could not add department.";
      toast({ variant: "error", title: "Could not add department", description: message });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Departments</CardTitle>
        <CardDescription>Names must be unique within your organisation.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {canManage && (
          <div className="flex gap-2">
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Engineering" />
            <Button size="sm" onClick={() => createMutation.mutate()} disabled={!name.trim() || createMutation.isPending}>
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
        )}
        {departmentsQuery.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {departmentsQuery.isError && <p className="text-sm text-danger">Could not load departments.</p>}
        {departmentsQuery.data?.length === 0 && <p className="text-sm text-muted-foreground">No departments yet.</p>}
        <ul className="flex flex-col gap-1.5">
          {(departmentsQuery.data ?? []).map((department) => (
            <li key={department.id} className="rounded-md border border-border px-3 py-2 text-sm text-foreground">
              {department.name}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function BranchesSection({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const branchesQuery = useQuery({ queryKey: ["branches"], queryFn: () => apiClient.organisationStructure.listBranches() });
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");

  const createMutation = useMutation({
    mutationFn: () => apiClient.organisationStructure.createBranch({ name: name.trim(), address: address.trim() || undefined }),
    onSuccess: () => {
      toast({ variant: "success", title: "Branch added" });
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      setName("");
      setAddress("");
    },
    onError: (error) => {
      const message = error instanceof NexoraApiError ? error.message : "Could not add branch.";
      toast({ variant: "error", title: "Could not add branch", description: message });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Branches</CardTitle>
        <CardDescription>Names must be unique within your organisation.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {canManage && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="branch-name">Name</Label>
            <Input id="branch-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Lagos HQ" />
            <Label htmlFor="branch-address">Address (optional)</Label>
            <Input id="branch-address" value={address} onChange={(event) => setAddress(event.target.value)} />
            <Button size="sm" onClick={() => createMutation.mutate()} disabled={!name.trim() || createMutation.isPending} className="self-start">
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
        )}
        {branchesQuery.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {branchesQuery.isError && <p className="text-sm text-danger">Could not load branches.</p>}
        {branchesQuery.data?.length === 0 && <p className="text-sm text-muted-foreground">No branches yet.</p>}
        <ul className="flex flex-col gap-1.5">
          {(branchesQuery.data ?? []).map((branch) => (
            <li key={branch.id} className="rounded-md border border-border px-3 py-2 text-sm text-foreground">
              {branch.name}
              {branch.address && <span className="text-muted-foreground"> · {branch.address}</span>}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
