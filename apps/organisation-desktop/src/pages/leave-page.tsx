import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import type { LeaveRequest, LeaveStatus, LeaveType } from "@nexora/types";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, Reveal, useToast } from "@nexora/ui";
import { NexoraApiError } from "@nexora/api-client";
import { AppShell } from "../components/app-shell";
import { apiClient } from "../lib/api-client";
import { useAuthStore } from "../store/auth-store";

const STATUS_VARIANT: Record<LeaveStatus, "default" | "success" | "danger" | "outline"> = {
  PENDING: "outline",
  APPROVED: "success",
  REJECTED: "danger",
  CANCELLED: "danger",
};

const LEAVE_TYPES: LeaveType[] = ["ANNUAL", "SICK", "MATERNITY", "PATERNITY", "UNPAID", "OTHER"];

const selectClassName =
  "h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

export default function LeavePage() {
  const hasPermission = useAuthStore((state) => state.hasPermission);

  return (
    <AppShell>
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <Reveal>
          <h1 className="text-2xl font-semibold text-foreground">Leave</h1>
          <p className="text-sm text-muted-foreground">Requests, approvals and rejections.</p>
        </Reveal>

        {hasPermission("leave:create") && (
          <Reveal delayMs={60}>
            <CreateLeaveForm />
          </Reveal>
        )}
        <LeaveList canManage={hasPermission("leave:manage")} />
      </div>
    </AppShell>
  );
}

function CreateLeaveForm() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const employeesQuery = useQuery({ queryKey: ["employees"], queryFn: () => apiClient.employees.list({ page: 1, pageSize: 100 }) });

  const [employeeId, setEmployeeId] = useState("");
  const [leaveType, setLeaveType] = useState<LeaveType>("ANNUAL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  const createMutation = useMutation({
    mutationFn: () =>
      apiClient.leave.create({
        employeeId,
        leaveType,
        startDate: startDate as unknown as Date,
        endDate: endDate as unknown as Date,
        reason: reason.trim() || undefined,
      }),
    onSuccess: () => {
      toast({ variant: "success", title: "Leave request submitted" });
      queryClient.invalidateQueries({ queryKey: ["leave"] });
      setStartDate("");
      setEndDate("");
      setReason("");
    },
    onError: (error) => {
      const message = error instanceof NexoraApiError ? error.message : "Could not submit leave request.";
      toast({ variant: "error", title: "Could not submit leave request", description: message });
    },
  });

  const employees = employeesQuery.data?.items ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Submit a leave request</CardTitle>
        <CardDescription>Always created as PENDING, awaiting approval.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="leave-employee">Employee</Label>
            <select id="leave-employee" className={selectClassName} value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
              <option value="">Select employee</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.firstName} {employee.lastName} ({employee.employeeNumber})
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="leave-type">Type</Label>
            <select id="leave-type" className={selectClassName} value={leaveType} onChange={(event) => setLeaveType(event.target.value as LeaveType)}>
              {LEAVE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="leave-start">Start date</Label>
            <Input id="leave-start" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="leave-end">End date</Label>
            <Input id="leave-end" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="leave-reason">Reason (optional)</Label>
            <Input id="leave-reason" value={reason} onChange={(event) => setReason(event.target.value)} />
          </div>
        </div>
        <Button onClick={() => createMutation.mutate()} disabled={!employeeId || !startDate || !endDate || createMutation.isPending} className="self-start">
          <Plus className="h-4 w-4" />
          {createMutation.isPending ? "Submitting…" : "Submit request"}
        </Button>
      </CardContent>
    </Card>
  );
}

function LeaveList({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const leaveQuery = useQuery({ queryKey: ["leave"], queryFn: () => apiClient.leave.list({ page: 1, pageSize: 100 }) });
  const employeesQuery = useQuery({ queryKey: ["employees"], queryFn: () => apiClient.employees.list({ page: 1, pageSize: 100 }) });
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const decideMutation = useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: "APPROVED" | "REJECTED" | "CANCELLED"; reason?: string }) =>
      apiClient.leave.decide(id, { status, rejectionReason: reason }),
    onSuccess: () => {
      toast({ variant: "success", title: "Leave request updated" });
      queryClient.invalidateQueries({ queryKey: ["leave"] });
      setRejectingId(null);
      setRejectionReason("");
    },
    onError: (error) => {
      const message = error instanceof NexoraApiError ? error.message : "Could not update leave request.";
      toast({ variant: "error", title: "Failed", description: message });
    },
  });

  if (leaveQuery.isLoading) return <p className="text-sm text-muted-foreground">Loading leave requests…</p>;
  if (leaveQuery.isError) return <p className="text-sm text-danger">Could not load leave requests.</p>;

  const requests = leaveQuery.data?.items ?? [];
  const employeeById = new Map((employeesQuery.data?.items ?? []).map((employee) => [employee.id, employee]));

  if (requests.length === 0) return <p className="text-sm text-muted-foreground">No leave requests yet.</p>;

  return (
    <div className="flex flex-col gap-3">
      {requests.map((request: LeaveRequest, index) => {
        const employee = employeeById.get(request.employeeId);
        return (
          <Reveal key={request.id} delayMs={Math.min(index * 30, 300)}>
            <Card>
              <CardHeader className="flex-row items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                    {employee ? `${employee.firstName} ${employee.lastName}` : request.employeeId}
                    <Badge variant={STATUS_VARIANT[request.status]}>{request.status}</Badge>
                  </CardTitle>
                  <CardDescription>
                    {request.leaveType} · {new Date(request.startDate).toLocaleDateString()} – {new Date(request.endDate).toLocaleDateString()}
                    {request.reason ? ` · ${request.reason}` : ""}
                  </CardDescription>
                  {request.status === "REJECTED" && request.rejectionReason && (
                    <p className="mt-1 text-xs text-danger">Rejected: {request.rejectionReason}</p>
                  )}
                </div>
                {canManage && request.status === "PENDING" && (
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <div className="flex gap-2">
                      <Button size="sm" disabled={decideMutation.isPending} onClick={() => decideMutation.mutate({ id: request.id, status: "APPROVED" })}>
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={decideMutation.isPending}
                        onClick={() => setRejectingId(rejectingId === request.id ? null : request.id)}
                      >
                        Reject
                      </Button>
                    </div>
                    {rejectingId === request.id && (
                      <div className="flex w-56 flex-col gap-2">
                        <Input
                          placeholder="Reason for rejection"
                          value={rejectionReason}
                          onChange={(event) => setRejectionReason(event.target.value)}
                        />
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={!rejectionReason.trim() || decideMutation.isPending}
                          onClick={() => decideMutation.mutate({ id: request.id, status: "REJECTED", reason: rejectionReason.trim() })}
                        >
                          Confirm rejection
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardHeader>
            </Card>
          </Reveal>
        );
      })}
    </div>
  );
}
