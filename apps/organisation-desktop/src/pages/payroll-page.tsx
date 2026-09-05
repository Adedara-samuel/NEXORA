import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Play, X } from "lucide-react";
import type { PayrollRunStatus, TaxBandDefinition } from "@nexora/types";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, Reveal, useToast } from "@nexora/ui";
import { NexoraApiError } from "@nexora/api-client";
import { AppShell } from "../components/app-shell";
import { apiClient } from "../lib/api-client";
import { useAuthStore } from "../store/auth-store";

const RUN_STATUS_VARIANT: Record<PayrollRunStatus, "success" | "danger"> = { COMPLETED: "success", CANCELLED: "danger" };

const naira = (minor: number) => `₦${(minor / 100).toLocaleString()}`;

export default function PayrollPage() {
  const hasPermission = useAuthStore((state) => state.hasPermission);

  return (
    <AppShell>
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <Reveal>
          <h1 className="text-2xl font-semibold text-foreground">Payroll</h1>
          <p className="text-sm text-muted-foreground">Tax bands are configurable per organisation — see the settings card below before your first run.</p>
        </Reveal>

        <Reveal delayMs={60}>
          <TaxSettingsCard canManage={hasPermission("payroll:manage_settings")} />
        </Reveal>

        {hasPermission("payroll:create") && (
          <Reveal delayMs={100}>
            <RunPayrollForm />
          </Reveal>
        )}
        <PayrollRunsList canManage={hasPermission("payroll:create")} />
      </div>
    </AppShell>
  );
}

function TaxSettingsCard({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const settingsQuery = useQuery({ queryKey: ["payroll-tax-settings"], queryFn: () => apiClient.payroll.getTaxSettings() });

  const [pensionRatePercent, setPensionRatePercent] = useState("");
  const [editingBands, setEditingBands] = useState(false);
  const [bands, setBands] = useState<TaxBandDefinition[]>([]);

  useEffect(() => {
    if (settingsQuery.data) setPensionRatePercent(String(settingsQuery.data.effectivePensionRatePercent));
  }, [settingsQuery.data]);

  const savePensionMutation = useMutation({
    mutationFn: () => apiClient.payroll.updateTaxSettings({ pensionRatePercent: Number(pensionRatePercent) }),
    onSuccess: () => {
      toast({ variant: "success", title: "Pension rate updated" });
      queryClient.invalidateQueries({ queryKey: ["payroll-tax-settings"] });
    },
    onError: (error) => {
      const message = error instanceof NexoraApiError ? error.message : "Could not update pension rate.";
      toast({ variant: "error", title: "Failed", description: message });
    },
  });

  const saveBandsMutation = useMutation({
    mutationFn: () => apiClient.payroll.updateTaxSettings({ customBands: bands }),
    onSuccess: () => {
      toast({ variant: "success", title: "Tax bands updated" });
      queryClient.invalidateQueries({ queryKey: ["payroll-tax-settings"] });
      setEditingBands(false);
    },
    onError: (error) => {
      const message = error instanceof NexoraApiError ? error.message : "Could not update tax bands.";
      toast({ variant: "error", title: "Failed", description: message });
    },
  });

  if (settingsQuery.isLoading) return <p className="text-sm text-muted-foreground">Loading tax settings…</p>;
  if (settingsQuery.isError || !settingsQuery.data) return <p className="text-sm text-danger">Could not load tax settings.</p>;

  const settings = settingsQuery.data;

  const startEditingBands = () => {
    setBands(settings.customBands ?? settings.effectiveBands);
    setEditingBands(true);
  };

  const updateBand = (index: number, patch: Partial<TaxBandDefinition>) =>
    setBands((current) => current.map((band, i) => (i === index ? { ...band, ...patch } : band)));

  const addBand = () =>
    setBands((current) => {
      const withoutLast = current.slice(0, -1);
      const last = current[current.length - 1];
      const previousThreshold = withoutLast[withoutLast.length - 1]?.upToMajor ?? 0;
      return [...withoutLast, { upToMajor: previousThreshold + 1_000_000, ratePercent: 0 }, last];
    });

  const removeBand = (index: number) => setBands((current) => current.filter((_, i) => i !== index));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tax settings — {settings.countryCode}</CardTitle>
        <CardDescription>
          {settings.customBands ? "Using this organisation's custom bands." : `Using ${settings.countryCode}'s default bands.`} Best-effort — verify
          against current local tax guidance before relying on this for real payroll.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {canManage && (
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pension-rate">Employee pension rate (%)</Label>
              <Input
                id="pension-rate"
                type="number"
                min={0}
                max={100}
                className="w-32"
                value={pensionRatePercent}
                onChange={(event) => setPensionRatePercent(event.target.value)}
              />
            </div>
            <Button size="sm" onClick={() => savePensionMutation.mutate()} disabled={savePensionMutation.isPending}>
              {savePensionMutation.isPending ? "Saving…" : "Save pension rate"}
            </Button>
          </div>
        )}

        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead className="bg-surface text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Up to (annual, NGN)</th>
                <th className="px-3 py-2">Rate</th>
                {canManage && editingBands && <th className="px-3 py-2" />}
              </tr>
            </thead>
            <tbody>
              {(editingBands ? bands : settings.effectiveBands).map((band, index) => (
                <tr key={index} className="border-t border-border">
                  <td className="px-3 py-2">
                    {editingBands ? (
                      band.upToMajor === null ? (
                        <span className="text-muted-foreground">No limit</span>
                      ) : (
                        <Input
                          type="number"
                          min={1}
                          value={band.upToMajor}
                          onChange={(event) => updateBand(index, { upToMajor: Number(event.target.value) })}
                        />
                      )
                    ) : band.upToMajor === null ? (
                      "No limit"
                    ) : (
                      band.upToMajor.toLocaleString()
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editingBands ? (
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        className="w-24"
                        value={band.ratePercent}
                        onChange={(event) => updateBand(index, { ratePercent: Number(event.target.value) })}
                      />
                    ) : (
                      `${band.ratePercent}%`
                    )}
                  </td>
                  {canManage && editingBands && (
                    <td className="px-3 py-2">
                      {band.upToMajor !== null && bands.length > 1 && (
                        <button onClick={() => removeBand(index)} aria-label="Remove band" className="text-muted-foreground hover:text-danger">
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {canManage && (
          <div className="flex flex-wrap gap-2">
            {!editingBands ? (
              <Button size="sm" variant="outline" onClick={startEditingBands}>
                Customize bands
              </Button>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={addBand}>
                  Add band
                </Button>
                <Button size="sm" onClick={() => saveBandsMutation.mutate()} disabled={saveBandsMutation.isPending}>
                  {saveBandsMutation.isPending ? "Saving…" : "Save custom bands"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingBands(false)}>
                  Cancel
                </Button>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RunPayrollForm() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const now = new Date();
  const [periodYear, setPeriodYear] = useState(String(now.getFullYear()));
  const [periodMonth, setPeriodMonth] = useState(String(now.getMonth() + 1));

  const runMutation = useMutation({
    mutationFn: () => apiClient.payroll.run({ periodYear: Number(periodYear), periodMonth: Number(periodMonth) }),
    onSuccess: (run) => {
      toast({
        variant: "success",
        title: "Payroll run completed",
        description: `${run.payslips.length} payslip(s) generated${run.skippedEmployeeCount ? `, ${run.skippedEmployeeCount} employee(s) skipped (no salary set)` : ""}.`,
      });
      queryClient.invalidateQueries({ queryKey: ["payroll-runs"] });
    },
    onError: (error) => {
      const message = error instanceof NexoraApiError ? error.message : "Could not run payroll.";
      toast({ variant: "error", title: "Payroll run failed", description: message });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Run payroll</CardTitle>
        <CardDescription>Runs once per organisation per calendar month — a second run for the same period is rejected.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="run-year">Year</Label>
          <Input id="run-year" type="number" className="w-28" value={periodYear} onChange={(event) => setPeriodYear(event.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="run-month">Month</Label>
          <Input id="run-month" type="number" min={1} max={12} className="w-24" value={periodMonth} onChange={(event) => setPeriodMonth(event.target.value)} />
        </div>
        <Button onClick={() => runMutation.mutate()} disabled={runMutation.isPending}>
          <Play className="h-4 w-4" />
          {runMutation.isPending ? "Running…" : "Run payroll"}
        </Button>
      </CardContent>
    </Card>
  );
}

function PayrollRunsList({ canManage }: { canManage: boolean }) {
  const runsQuery = useQuery({ queryKey: ["payroll-runs"], queryFn: () => apiClient.payroll.listRuns({ page: 1, pageSize: 50 }) });

  if (runsQuery.isLoading) return <p className="text-sm text-muted-foreground">Loading payroll runs…</p>;
  if (runsQuery.isError) return <p className="text-sm text-danger">Could not load payroll runs.</p>;

  const runs = runsQuery.data?.items ?? [];
  if (runs.length === 0) return <p className="text-sm text-muted-foreground">No payroll runs yet.</p>;

  return (
    <div className="flex flex-col gap-3">
      {runs.map((run, index) => (
        <Reveal key={run.id} delayMs={Math.min(index * 30, 300)}>
          <PayrollRunRow runId={run.id} canManage={canManage} />
        </Reveal>
      ))}
    </div>
  );
}

function PayrollRunRow({ runId, canManage }: { runId: string; canManage: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const runQuery = useQuery({
    queryKey: ["payroll-run", runId],
    queryFn: () => apiClient.payroll.getRun(runId),
  });
  const employeesQuery = useQuery({ queryKey: ["employees"], queryFn: () => apiClient.employees.list({ page: 1, pageSize: 100 }) });
  const employeeById = new Map((employeesQuery.data?.items ?? []).map((employee) => [employee.id, employee]));

  const cancelMutation = useMutation({
    mutationFn: () => apiClient.payroll.cancel(runId),
    onSuccess: () => {
      toast({ variant: "success", title: "Payroll run cancelled" });
      queryClient.invalidateQueries({ queryKey: ["payroll-runs"] });
      queryClient.invalidateQueries({ queryKey: ["payroll-run", runId] });
    },
    onError: (error) => {
      const message = error instanceof NexoraApiError ? error.message : "Could not cancel payroll run.";
      toast({ variant: "error", title: "Failed", description: message });
    },
  });

  if (!runQuery.data) return null;
  const run = runQuery.data;

  return (
    <Card>
      <CardHeader className="cursor-pointer flex-row items-start justify-between gap-4" onClick={() => setExpanded((value) => !value)}>
        <div className="min-w-0 flex-1">
          <CardTitle className="flex flex-wrap items-center gap-2">
            {run.periodYear}-{String(run.periodMonth).padStart(2, "0")}
            <Badge variant={RUN_STATUS_VARIANT[run.status]}>{run.status}</Badge>
          </CardTitle>
          <CardDescription>
            Gross {naira(run.totalGrossMinor)} · Deductions {naira(run.totalDeductionsMinor)} · Net {naira(run.totalNetMinor)}
            {run.skippedEmployeeCount ? ` · ${run.skippedEmployeeCount} skipped` : ""}
          </CardDescription>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {canManage && run.status === "COMPLETED" && (
            <Button
              size="sm"
              variant="outline"
              disabled={cancelMutation.isPending}
              onClick={(event) => {
                event.stopPropagation();
                cancelMutation.mutate();
              }}
            >
              Cancel
            </Button>
          )}
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="border-t border-border pt-4">
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="bg-surface text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Employee</th>
                  <th className="px-3 py-2">Gross</th>
                  <th className="px-3 py-2">Pension</th>
                  <th className="px-3 py-2">PAYE</th>
                  <th className="px-3 py-2">Net</th>
                </tr>
              </thead>
              <tbody>
                {run.payslips.map((payslip) => {
                  const employee = employeeById.get(payslip.employeeId);
                  return (
                  <tr key={payslip.id} className="border-t border-border">
                    <td className="px-3 py-2 text-muted-foreground">{employee ? `${employee.firstName} ${employee.lastName}` : payslip.employeeId}</td>
                    <td className="px-3 py-2">{naira(payslip.grossMinor)}</td>
                    <td className="px-3 py-2">{naira(payslip.pensionMinor)}</td>
                    <td className="px-3 py-2">{naira(payslip.payeMinor)}</td>
                    <td className="px-3 py-2 font-medium">{naira(payslip.netMinor)}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
