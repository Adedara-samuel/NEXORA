import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import type { Attendance, AttendanceStatus } from "@nexora/types";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, Reveal, useToast } from "@nexora/ui";
import { NexoraApiError } from "@nexora/api-client";
import { AppShell } from "../components/app-shell";
import { apiClient } from "../lib/api-client";
import { useAuthStore } from "../store/auth-store";

const STATUS_VARIANT: Record<AttendanceStatus, "default" | "success" | "danger" | "outline"> = {
  PRESENT: "success",
  LATE: "outline",
  HALF_DAY: "outline",
  ABSENT: "danger",
};

const selectClassName =
  "h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

export default function AttendancePage() {
  const hasPermission = useAuthStore((state) => state.hasPermission);

  return (
    <AppShell>
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <Reveal>
          <h1 className="text-2xl font-semibold text-foreground">Attendance</h1>
          <p className="text-sm text-muted-foreground">One record per employee per day.</p>
        </Reveal>

        {hasPermission("attendance:create") && (
          <Reveal delayMs={60}>
            <CreateAttendanceForm canUpdate={hasPermission("attendance:update")} />
          </Reveal>
        )}
        <AttendanceList canUpdate={hasPermission("attendance:update")} />
      </div>
    </AppShell>
  );
}

function CreateAttendanceForm({ canUpdate }: { canUpdate: boolean }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const employeesQuery = useQuery({ queryKey: ["employees"], queryFn: () => apiClient.employees.list({ page: 1, pageSize: 100 }) });

  const [employeeId, setEmployeeId] = useState("");
  const [date, setDate] = useState("");
  const [status, setStatus] = useState<AttendanceStatus>("PRESENT");
  const [clockInAt, setClockInAt] = useState("");

  const createMutation = useMutation({
    mutationFn: () =>
      apiClient.attendance.create({
        employeeId,
        date: date as unknown as Date,
        status,
        clockInAt: clockInAt ? (`${date}T${clockInAt}:00` as unknown as Date) : undefined,
      }),
    onSuccess: () => {
      toast({ variant: "success", title: "Attendance recorded" });
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      setDate("");
      setClockInAt("");
    },
    onError: (error) => {
      const message = error instanceof NexoraApiError ? error.message : "Could not record attendance.";
      toast({ variant: "error", title: "Could not record attendance", description: message });
    },
  });

  const employees = employeesQuery.data?.items ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Record attendance</CardTitle>
        <CardDescription>A duplicate record for the same employee and date is rejected.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="att-employee">Employee</Label>
            <select id="att-employee" className={selectClassName} value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
              <option value="">Select employee</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.firstName} {employee.lastName} ({employee.employeeNumber})
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="att-date">Date</Label>
            <Input id="att-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="att-status">Status</Label>
            <select id="att-status" className={selectClassName} value={status} onChange={(event) => setStatus(event.target.value as AttendanceStatus)}>
              <option value="PRESENT">PRESENT</option>
              <option value="LATE">LATE</option>
              <option value="HALF_DAY">HALF_DAY</option>
              <option value="ABSENT">ABSENT</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="att-clock-in">Clock-in time (optional)</Label>
            <Input id="att-clock-in" type="time" value={clockInAt} onChange={(event) => setClockInAt(event.target.value)} />
          </div>
        </div>
        <Button onClick={() => createMutation.mutate()} disabled={!employeeId || !date || createMutation.isPending} className="self-start">
          <Plus className="h-4 w-4" />
          {createMutation.isPending ? "Recording…" : "Record attendance"}
        </Button>
      </CardContent>
    </Card>
  );
}

function AttendanceList({ canUpdate }: { canUpdate: boolean }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const attendanceQuery = useQuery({ queryKey: ["attendance"], queryFn: () => apiClient.attendance.list({ page: 1, pageSize: 100 }) });
  const employeesQuery = useQuery({ queryKey: ["employees"], queryFn: () => apiClient.employees.list({ page: 1, pageSize: 100 }) });

  const clockOutMutation = useMutation({
    mutationFn: (id: string) => apiClient.attendance.update(id, { clockOutAt: new Date() }),
    onSuccess: () => {
      toast({ variant: "success", title: "Clocked out" });
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
    },
    onError: (error) => {
      const message = error instanceof NexoraApiError ? error.message : "Could not clock out.";
      toast({ variant: "error", title: "Failed", description: message });
    },
  });

  if (attendanceQuery.isLoading) return <p className="text-sm text-muted-foreground">Loading attendance…</p>;
  if (attendanceQuery.isError) return <p className="text-sm text-danger">Could not load attendance.</p>;

  const records = attendanceQuery.data?.items ?? [];
  const employeeById = new Map((employeesQuery.data?.items ?? []).map((employee) => [employee.id, employee]));

  if (records.length === 0) return <p className="text-sm text-muted-foreground">No attendance recorded yet.</p>;

  return (
    <div className="flex flex-col gap-3">
      {records.map((record: Attendance, index) => {
        const employee = employeeById.get(record.employeeId);
        return (
          <Reveal key={record.id} delayMs={Math.min(index * 30, 300)}>
            <Card>
              <CardHeader className="flex-row items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                    {employee ? `${employee.firstName} ${employee.lastName}` : record.employeeId}
                    <Badge variant={STATUS_VARIANT[record.status]}>{record.status}</Badge>
                  </CardTitle>
                  <CardDescription>
                    {new Date(record.date).toLocaleDateString()}
                    {record.clockInAt ? ` · in ${new Date(record.clockInAt).toLocaleTimeString()}` : ""}
                    {record.clockOutAt ? ` · out ${new Date(record.clockOutAt).toLocaleTimeString()}` : ""}
                  </CardDescription>
                </div>
                {canUpdate && record.clockInAt && !record.clockOutAt && (
                  <Button size="sm" variant="outline" disabled={clockOutMutation.isPending} onClick={() => clockOutMutation.mutate(record.id)}>
                    Clock out
                  </Button>
                )}
              </CardHeader>
            </Card>
          </Reveal>
        );
      })}
    </div>
  );
}
