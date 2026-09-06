import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Plus } from "lucide-react";
import type { ComplianceRecord, ComplianceStatus } from "@nexora/types";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, Reveal, useToast } from "@nexora/ui";
import { NexoraApiError } from "@nexora/api-client";
import { AppShell } from "../components/app-shell";
import { apiClient } from "../lib/api-client";
import { useAuthStore } from "../store/auth-store";

const STATUS_VARIANT: Record<ComplianceStatus, "default" | "success" | "danger" | "outline"> = {
  COMPLIANT: "success",
  PENDING: "outline",
  EXPIRED: "danger",
  NON_COMPLIANT: "danger",
};

const selectClassName =
  "h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

export default function CompliancePage() {
  const hasPermission = useAuthStore((state) => state.hasPermission);

  return (
    <AppShell>
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <Reveal>
          <h1 className="text-2xl font-semibold text-foreground">Compliance</h1>
          <p className="text-sm text-muted-foreground">Certifications, licenses and other trackable obligations.</p>
        </Reveal>

        {hasPermission("compliance:create") && (
          <Reveal delayMs={60}>
            <CreateComplianceForm />
          </Reveal>
        )}
        <ComplianceList canUpdate={hasPermission("compliance:update")} />
      </div>
    </AppShell>
  );
}

function CreateComplianceForm() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const employeesQuery = useQuery({ queryKey: ["employees"], queryFn: () => apiClient.employees.list({ page: 1, pageSize: 100 }) });

  const [employeeId, setEmployeeId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");

  const createMutation = useMutation({
    mutationFn: () =>
      apiClient.compliance.create({
        employeeId: employeeId || undefined,
        title: title.trim(),
        description: description.trim() || undefined,
        dueDate: dueDate ? (dueDate as unknown as Date) : undefined,
      }),
    onSuccess: () => {
      toast({ variant: "success", title: "Compliance record added" });
      queryClient.invalidateQueries({ queryKey: ["compliance"] });
      setTitle("");
      setDescription("");
      setDueDate("");
    },
    onError: (error) => {
      const message = error instanceof NexoraApiError ? error.message : "Could not add compliance record.";
      toast({ variant: "error", title: "Could not add record", description: message });
    },
  });

  const employees = employeesQuery.data?.items ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add a compliance record</CardTitle>
        <CardDescription>Leave employee unset for an organisation-wide obligation (e.g. a company license).</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="comp-title">Title</Label>
            <Input id="comp-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Fire safety certification" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="comp-employee">Employee (optional)</Label>
            <select id="comp-employee" className={selectClassName} value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
              <option value="">Organisation-wide</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.firstName} {employee.lastName} ({employee.employeeNumber})
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="comp-due">Due date (optional)</Label>
            <Input id="comp-due" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="comp-description">Description (optional)</Label>
            <Input id="comp-description" value={description} onChange={(event) => setDescription(event.target.value)} />
          </div>
        </div>
        <Button onClick={() => createMutation.mutate()} disabled={!title.trim() || createMutation.isPending} className="self-start">
          <Plus className="h-4 w-4" />
          {createMutation.isPending ? "Adding…" : "Add record"}
        </Button>
      </CardContent>
    </Card>
  );
}

function ComplianceList({ canUpdate }: { canUpdate: boolean }) {
  const complianceQuery = useQuery({ queryKey: ["compliance"], queryFn: () => apiClient.compliance.list({ page: 1, pageSize: 100 }) });
  const employeesQuery = useQuery({ queryKey: ["employees"], queryFn: () => apiClient.employees.list({ page: 1, pageSize: 100 }) });

  if (complianceQuery.isLoading) return <p className="text-sm text-muted-foreground">Loading compliance records…</p>;
  if (complianceQuery.isError) return <p className="text-sm text-danger">Could not load compliance records.</p>;

  const records = complianceQuery.data?.items ?? [];
  const employeeById = new Map((employeesQuery.data?.items ?? []).map((employee) => [employee.id, employee]));

  if (records.length === 0) return <p className="text-sm text-muted-foreground">No compliance records yet.</p>;

  return (
    <div className="flex flex-col gap-3">
      {records.map((record, index) => (
        <Reveal key={record.id} delayMs={Math.min(index * 30, 300)}>
          <ComplianceRow
            record={record}
            employeeName={record.employeeId ? formatEmployeeName(employeeById.get(record.employeeId)) : undefined}
            canUpdate={canUpdate}
          />
        </Reveal>
      ))}
    </div>
  );
}

function formatEmployeeName(employee: { firstName: string; lastName: string } | undefined) {
  return employee ? `${employee.firstName} ${employee.lastName}` : undefined;
}

function ComplianceRow({ record, employeeName, canUpdate }: { record: ComplianceRecord; employeeName: string | undefined; canUpdate: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [status, setStatus] = useState<ComplianceStatus>(record.status);
  const [completedDate, setCompletedDate] = useState("");

  const updateMutation = useMutation({
    mutationFn: () =>
      apiClient.compliance.update(record.id, {
        status,
        completedDate: status === "COMPLIANT" ? (completedDate as unknown as Date) : undefined,
      }),
    onSuccess: () => {
      toast({ variant: "success", title: "Compliance record updated" });
      queryClient.invalidateQueries({ queryKey: ["compliance"] });
      setExpanded(false);
    },
    onError: (error) => {
      const message = error instanceof NexoraApiError ? error.message : "Could not update record.";
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
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            {record.title}
            <Badge variant={STATUS_VARIANT[record.status]}>{record.status}</Badge>
          </CardTitle>
          <CardDescription>
            {employeeName ?? "Organisation-wide"}
            {record.dueDate ? ` · due ${new Date(record.dueDate).toLocaleDateString()}` : ""}
            {record.description ? ` · ${record.description}` : ""}
          </CardDescription>
        </div>
        {canUpdate && <div className="shrink-0 text-muted-foreground">{expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</div>}
      </CardHeader>
      {expanded && canUpdate && (
        <CardContent className="flex flex-col gap-4 border-t border-border pt-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`comp-status-${record.id}`}>Status</Label>
              <select
                id={`comp-status-${record.id}`}
                className={selectClassName}
                value={status}
                onChange={(event) => setStatus(event.target.value as ComplianceStatus)}
              >
                <option value="PENDING">PENDING</option>
                <option value="COMPLIANT">COMPLIANT</option>
                <option value="EXPIRED">EXPIRED</option>
                <option value="NON_COMPLIANT">NON_COMPLIANT</option>
              </select>
            </div>
            {status === "COMPLIANT" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`comp-completed-${record.id}`}>Completed date</Label>
                <Input
                  id={`comp-completed-${record.id}`}
                  type="date"
                  value={completedDate}
                  onChange={(event) => setCompletedDate(event.target.value)}
                />
              </div>
            )}
          </div>
          <Button
            size="sm"
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending || (status === "COMPLIANT" && !completedDate)}
            className="self-start"
          >
            {updateMutation.isPending ? "Saving…" : "Save changes"}
          </Button>
        </CardContent>
      )}
    </Card>
  );
}
