import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Plus } from "lucide-react";
import type { Employee, EmployeeStatus } from "@nexora/types";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, Reveal, useToast } from "@nexora/ui";
import { NexoraApiError } from "@nexora/api-client";
import { AppShell } from "../components/app-shell";
import { apiClient } from "../lib/api-client";
import { useAuthStore } from "../store/auth-store";

const STATUS_VARIANT: Record<EmployeeStatus, "default" | "success" | "danger" | "outline"> = {
  ACTIVE: "success",
  ON_LEAVE: "outline",
  TERMINATED: "danger",
};

const selectClassName =
  "h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

export default function EmployeesPage() {
  const hasPermission = useAuthStore((state) => state.hasPermission);

  return (
    <AppShell>
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <Reveal>
          <h1 className="text-2xl font-semibold text-foreground">Employees</h1>
          <p className="text-sm text-muted-foreground">Staff records — attach a department, branch and salary for payroll to use.</p>
        </Reveal>

        {hasPermission("employees:create") && (
          <Reveal delayMs={60}>
            <CreateEmployeeForm />
          </Reveal>
        )}
        <EmployeesList canUpdate={hasPermission("employees:update")} />
      </div>
    </AppShell>
  );
}

function CreateEmployeeForm() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const departmentsQuery = useQuery({ queryKey: ["departments"], queryFn: () => apiClient.organisationStructure.listDepartments() });
  const branchesQuery = useQuery({ queryKey: ["branches"], queryFn: () => apiClient.organisationStructure.listBranches() });

  const [employeeNumber, setEmployeeNumber] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [position, setPosition] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [hireDate, setHireDate] = useState("");
  const [salaryMajor, setSalaryMajor] = useState("");

  const createMutation = useMutation({
    mutationFn: () =>
      apiClient.employees.create({
        employeeNumber: employeeNumber.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim() || undefined,
        position: position.trim() || undefined,
        departmentId: departmentId || undefined,
        branchId: branchId || undefined,
        // CreateEmployeeInput's date fields are typed as `Date` (z.coerce.date()'s
        // *output* type) even though the wire format is a plain "YYYY-MM-DD"
        // string — the server re-parses it with the same schema, so this cast
        // just satisfies TS without changing what's actually sent over JSON.
        hireDate: hireDate as unknown as Date,
        salaryMinor: salaryMajor ? Math.round(Number(salaryMajor) * 100) : undefined,
        currency: "NGN",
      }),
    onSuccess: (employee) => {
      toast({ variant: "success", title: "Employee added", description: `${employee.firstName} ${employee.lastName} was added.` });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      setEmployeeNumber("");
      setFirstName("");
      setLastName("");
      setEmail("");
      setPosition("");
      setDepartmentId("");
      setBranchId("");
      setHireDate("");
      setSalaryMajor("");
    },
    onError: (error) => {
      const message = error instanceof NexoraApiError ? error.message : "Could not add employee.";
      toast({ variant: "error", title: "Could not add employee", description: message });
    },
  });

  const canSubmit = employeeNumber.trim() && firstName.trim() && lastName.trim() && hireDate;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add an employee</CardTitle>
        <CardDescription>Employee number must be unique within your organisation.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="emp-number">Employee number</Label>
            <Input id="emp-number" value={employeeNumber} onChange={(event) => setEmployeeNumber(event.target.value)} placeholder="EMP-001" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="emp-hire-date">Hire date</Label>
            <Input id="emp-hire-date" type="date" value={hireDate} onChange={(event) => setHireDate(event.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="emp-first-name">First name</Label>
            <Input id="emp-first-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="emp-last-name">Last name</Label>
            <Input id="emp-last-name" value={lastName} onChange={(event) => setLastName(event.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="emp-email">Email (optional)</Label>
            <Input id="emp-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="emp-position">Position (optional)</Label>
            <Input id="emp-position" value={position} onChange={(event) => setPosition(event.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="emp-department">Department (optional)</Label>
            <select id="emp-department" className={selectClassName} value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
              <option value="">None</option>
              {(departmentsQuery.data ?? []).map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="emp-branch">Branch (optional)</Label>
            <select id="emp-branch" className={selectClassName} value={branchId} onChange={(event) => setBranchId(event.target.value)}>
              <option value="">None</option>
              {(branchesQuery.data ?? []).map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="emp-salary">Monthly salary, NGN (optional)</Label>
            <Input id="emp-salary" type="number" min={0} value={salaryMajor} onChange={(event) => setSalaryMajor(event.target.value)} placeholder="500000" />
          </div>
        </div>
        <Button onClick={() => createMutation.mutate()} disabled={!canSubmit || createMutation.isPending} className="self-start">
          <Plus className="h-4 w-4" />
          {createMutation.isPending ? "Adding…" : "Add employee"}
        </Button>
      </CardContent>
    </Card>
  );
}

function EmployeesList({ canUpdate }: { canUpdate: boolean }) {
  const employeesQuery = useQuery({ queryKey: ["employees"], queryFn: () => apiClient.employees.list({ page: 1, pageSize: 100 }) });

  if (employeesQuery.isLoading) return <p className="text-sm text-muted-foreground">Loading employees…</p>;
  if (employeesQuery.isError) return <p className="text-sm text-danger">Could not load employees.</p>;

  const employees = employeesQuery.data?.items ?? [];
  if (employees.length === 0) return <p className="text-sm text-muted-foreground">No employees yet.</p>;

  return (
    <div className="flex flex-col gap-3">
      {employees.map((employee, index) => (
        <Reveal key={employee.id} delayMs={Math.min(index * 30, 300)}>
          <EmployeeRow employee={employee} canUpdate={canUpdate} />
        </Reveal>
      ))}
    </div>
  );
}

function EmployeeRow({ employee, canUpdate }: { employee: Employee; canUpdate: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [status, setStatus] = useState<EmployeeStatus>(employee.status);
  const [terminationDate, setTerminationDate] = useState("");
  const [salaryMajor, setSalaryMajor] = useState(employee.salaryMinor !== null ? String(employee.salaryMinor / 100) : "");

  const updateMutation = useMutation({
    mutationFn: () =>
      apiClient.employees.update(employee.id, {
        status,
        terminationDate: status === "TERMINATED" ? (terminationDate as unknown as Date) : undefined,
        salaryMinor: salaryMajor ? Math.round(Number(salaryMajor) * 100) : undefined,
      }),
    onSuccess: () => {
      toast({ variant: "success", title: "Employee updated" });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      setExpanded(false);
    },
    onError: (error) => {
      const message = error instanceof NexoraApiError ? error.message : "Could not update employee.";
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
            {employee.firstName} {employee.lastName}
            <Badge variant={STATUS_VARIANT[employee.status]}>{employee.status}</Badge>
          </CardTitle>
          <CardDescription>
            {employee.employeeNumber}
            {employee.position ? ` · ${employee.position}` : ""}
            {employee.salaryMinor !== null ? ` · ₦${(employee.salaryMinor / 100).toLocaleString()}/mo` : ""}
          </CardDescription>
        </div>
        {canUpdate && <div className="shrink-0 text-muted-foreground">{expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</div>}
      </CardHeader>
      {expanded && canUpdate && (
        <CardContent className="flex flex-col gap-4 border-t border-border pt-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`status-${employee.id}`}>Status</Label>
              <select
                id={`status-${employee.id}`}
                className={selectClassName}
                value={status}
                onChange={(event) => setStatus(event.target.value as EmployeeStatus)}
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="ON_LEAVE">ON_LEAVE</option>
                <option value="TERMINATED">TERMINATED</option>
              </select>
            </div>
            {status === "TERMINATED" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`termination-${employee.id}`}>Termination date</Label>
                <Input id={`termination-${employee.id}`} type="date" value={terminationDate} onChange={(event) => setTerminationDate(event.target.value)} />
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`salary-${employee.id}`}>Monthly salary, NGN</Label>
              <Input id={`salary-${employee.id}`} type="number" min={0} value={salaryMajor} onChange={(event) => setSalaryMajor(event.target.value)} />
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending || (status === "TERMINATED" && !terminationDate)}
            className="self-start"
          >
            {updateMutation.isPending ? "Saving…" : "Save changes"}
          </Button>
        </CardContent>
      )}
    </Card>
  );
}
