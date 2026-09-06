import { Fragment, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, ChevronDown, ChevronUp, Plus, Play, ShieldCheck, X } from "lucide-react";
import type { PayrollDisbursementStatus, PayrollRunStatus, PayslipDisbursementStatus, TaxBandDefinition } from "@nexora/types";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, Reveal, useToast } from "@nexora/ui";
import { NexoraApiError } from "@nexora/api-client";
import { AppShell } from "../components/app-shell";
import { apiClient } from "../lib/api-client";
import { useAuthStore } from "../store/auth-store";

const selectClassName =
  "h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

const RUN_STATUS_VARIANT: Record<PayrollRunStatus, "success" | "danger"> = { COMPLETED: "success", CANCELLED: "danger" };

const DISBURSEMENT_STATUS_VARIANT: Record<PayrollDisbursementStatus, "default" | "success" | "danger" | "outline"> = {
  NOT_DISBURSED: "outline",
  DISBURSING: "outline",
  DISBURSED: "success",
  PARTIALLY_DISBURSED: "danger",
  FAILED: "danger",
};

const PAYSLIP_DISBURSEMENT_VARIANT: Record<PayslipDisbursementStatus, "success" | "danger" | "outline"> = {
  PAID: "success",
  FAILED: "danger",
  SKIPPED: "outline",
};

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
          <WalletCard canManage={hasPermission("payroll:manage_wallet")} />
        </Reveal>

        <Reveal delayMs={80}>
          <TaxSettingsCard canManage={hasPermission("payroll:manage_settings")} />
        </Reveal>

        {hasPermission("payroll:create") && (
          <Reveal delayMs={100}>
            <RunPayrollForm />
          </Reveal>
        )}
        <PayrollRunsList canManage={hasPermission("payroll:create")} canDisburse={hasPermission("payroll:disburse")} />
      </div>
    </AppShell>
  );
}

function WalletCard({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const walletQuery = useQuery({ queryKey: ["payroll-wallet"], queryFn: () => apiClient.payroll.getWallet() });
  const bankAccountsQuery = useQuery({ queryKey: ["payroll-bank-accounts"], queryFn: () => apiClient.payroll.listBankAccounts(), enabled: canManage });

  const [accountNumber, setAccountNumber] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [depositAmount, setDepositAmount] = useState("");

  const linkMutation = useMutation({
    mutationFn: () => apiClient.payroll.linkBankAccount({ accountNumber: accountNumber.trim() }),
    onSuccess: (account) => {
      toast({ variant: "success", title: "Bank account linked", description: `Verified as ${account.accountName}` });
      queryClient.invalidateQueries({ queryKey: ["payroll-bank-accounts"] });
      setAccountNumber("");
    },
    onError: (error) => {
      const message = error instanceof NexoraApiError ? error.message : "Could not link bank account.";
      toast({ variant: "error", title: "Could not link account", description: message });
    },
  });

  const depositMutation = useMutation({
    mutationFn: () =>
      apiClient.payroll.depositToWallet({ bankAccountId: selectedAccountId, amountMinor: Math.round(Number(depositAmount) * 100) }, crypto.randomUUID()),
    onSuccess: (deposit) => {
      toast({ variant: deposit.status === "SUCCESSFUL" ? "success" : "error", title: `Deposit ${deposit.status.toLowerCase()}` });
      queryClient.invalidateQueries({ queryKey: ["payroll-wallet"] });
      setDepositAmount("");
    },
    onError: (error) => {
      const message = error instanceof NexoraApiError ? error.message : "Could not fund wallet.";
      toast({ variant: "error", title: "Deposit failed", description: message });
    },
  });

  const bankAccounts = bankAccountsQuery.data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payroll wallet</CardTitle>
        <CardDescription>
          Funds payroll disbursements via SAPOK Pay. Link your organisation's bank account, then deposit into the wallet before running a disbursement.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {walletQuery.isLoading && <p className="text-sm text-muted-foreground">Loading balance…</p>}
        {walletQuery.data && <p className="text-3xl font-semibold text-foreground">₦{(walletQuery.data.balanceMinor / 100).toLocaleString()}</p>}

        {canManage && (
          <>
            <div className="flex gap-2 border-t border-border pt-4">
              <Input value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} placeholder="10-digit account number" maxLength={10} />
              <Button size="sm" onClick={() => linkMutation.mutate()} disabled={accountNumber.trim().length !== 10 || linkMutation.isPending}>
                <Plus className="h-4 w-4" />
                Link
              </Button>
            </div>

            {bankAccounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No bank accounts linked yet.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {bankAccounts.map((account) => (
                  <li key={account.id} className="rounded-md border border-border px-3 py-2 text-sm text-foreground">
                    {account.accountName} · {account.accountNumber}
                  </li>
                ))}
              </ul>
            )}

            {bankAccounts.length > 0 && (
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="wallet-bank-account">From account</Label>
                  <select id="wallet-bank-account" className={`${selectClassName} sm:w-64`} value={selectedAccountId} onChange={(event) => setSelectedAccountId(event.target.value)}>
                    <option value="">Select an account</option>
                    {bankAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.accountName} · {account.accountNumber}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="wallet-deposit-amount">Amount, NGN</Label>
                  <Input id="wallet-deposit-amount" type="number" min={0} className="w-32" value={depositAmount} onChange={(event) => setDepositAmount(event.target.value)} />
                </div>
                <Button size="sm" onClick={() => depositMutation.mutate()} disabled={!selectedAccountId || !depositAmount || depositMutation.isPending}>
                  {depositMutation.isPending ? "Depositing…" : "Deposit"}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
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

function PayrollRunsList({ canManage, canDisburse }: { canManage: boolean; canDisburse: boolean }) {
  const runsQuery = useQuery({ queryKey: ["payroll-runs"], queryFn: () => apiClient.payroll.listRuns({ page: 1, pageSize: 50 }) });

  if (runsQuery.isLoading) return <p className="text-sm text-muted-foreground">Loading payroll runs…</p>;
  if (runsQuery.isError) return <p className="text-sm text-danger">Could not load payroll runs.</p>;

  const runs = runsQuery.data?.items ?? [];
  if (runs.length === 0) return <p className="text-sm text-muted-foreground">No payroll runs yet.</p>;

  return (
    <div className="flex flex-col gap-3">
      {runs.map((run, index) => (
        <Reveal key={run.id} delayMs={Math.min(index * 30, 300)}>
          <PayrollRunRow runId={run.id} canManage={canManage} canDisburse={canDisburse} />
        </Reveal>
      ))}
    </div>
  );
}

function PayrollRunRow({ runId, canManage, canDisburse }: { runId: string; canManage: boolean; canDisburse: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [expandedPayslipId, setExpandedPayslipId] = useState<string | null>(null);
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

  const disburseMutation = useMutation({
    mutationFn: () => apiClient.payroll.disburse(runId),
    onSuccess: (updatedRun) => {
      const variant = updatedRun.disbursementStatus === "DISBURSED" ? "success" : updatedRun.disbursementStatus === "PARTIALLY_DISBURSED" ? "warning" : "error";
      toast({ variant, title: `Disbursement ${updatedRun.disbursementStatus.toLowerCase().replace("_", " ")}` });
      queryClient.invalidateQueries({ queryKey: ["payroll-runs"] });
      queryClient.invalidateQueries({ queryKey: ["payroll-run", runId] });
    },
    onError: (error) => {
      const message = error instanceof NexoraApiError ? error.message : "Could not disburse payroll run.";
      toast({ variant: "error", title: "Disbursement failed", description: message });
    },
  });

  const reconcileMutation = useMutation({
    mutationFn: () => apiClient.payroll.reconcile(runId),
    onSuccess: (report) => {
      toast({
        variant: report.mismatchCount === 0 ? "success" : "warning",
        title: report.mismatchCount === 0 ? "Reconciled — everything matches" : `Reconciled — ${report.mismatchCount} mismatch(es) found`,
      });
    },
    onError: (error) => {
      const message = error instanceof NexoraApiError ? error.message : "Could not reconcile payroll run.";
      toast({ variant: "error", title: "Reconciliation failed", description: message });
    },
  });

  if (!runQuery.data) return null;
  const run = runQuery.data;
  const canRetryDisbursement = run.disbursementStatus === "NOT_DISBURSED" || run.disbursementStatus === "FAILED";

  return (
    <Card>
      <CardHeader className="cursor-pointer flex-row items-start justify-between gap-4" onClick={() => setExpanded((value) => !value)}>
        <div className="min-w-0 flex-1">
          <CardTitle className="flex flex-wrap items-center gap-2">
            {run.periodYear}-{String(run.periodMonth).padStart(2, "0")}
            <Badge variant={RUN_STATUS_VARIANT[run.status]}>{run.status}</Badge>
            <Badge variant={DISBURSEMENT_STATUS_VARIANT[run.disbursementStatus]}>{run.disbursementStatus.replace("_", " ")}</Badge>
          </CardTitle>
          <CardDescription>
            Gross {naira(run.totalGrossMinor)} · Deductions {naira(run.totalDeductionsMinor)} · Net {naira(run.totalNetMinor)}
            {run.skippedEmployeeCount ? ` · ${run.skippedEmployeeCount} skipped` : ""}
          </CardDescription>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {canDisburse && run.status === "COMPLETED" && canRetryDisbursement && (
            <Button
              size="sm"
              disabled={disburseMutation.isPending}
              onClick={(event) => {
                event.stopPropagation();
                disburseMutation.mutate();
              }}
            >
              <Banknote className="h-4 w-4" />
              {disburseMutation.isPending ? "Disbursing…" : run.disbursementStatus === "FAILED" ? "Retry disbursement" : "Disburse"}
            </Button>
          )}
          {run.disbursementBatchReference && (
            <Button
              size="sm"
              variant="outline"
              disabled={reconcileMutation.isPending}
              onClick={(event) => {
                event.stopPropagation();
                reconcileMutation.mutate();
              }}
            >
              <ShieldCheck className="h-4 w-4" />
              {reconcileMutation.isPending ? "Checking…" : "Reconcile"}
            </Button>
          )}
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
                  <th className="px-3 py-2">Disbursement</th>
                </tr>
              </thead>
              <tbody>
                {run.payslips.map((payslip) => {
                  const employee = employeeById.get(payslip.employeeId);
                  const isOpen = expandedPayslipId === payslip.id;
                  return (
                  <Fragment key={payslip.id}>
                  <tr
                    className="cursor-pointer border-t border-border hover:bg-surface"
                    onClick={() => setExpandedPayslipId(isOpen ? null : payslip.id)}
                  >
                    <td className="px-3 py-2 text-muted-foreground">{employee ? `${employee.firstName} ${employee.lastName}` : payslip.employeeId}</td>
                    <td className="px-3 py-2">{naira(payslip.grossMinor)}</td>
                    <td className="px-3 py-2">{naira(payslip.pensionMinor)}</td>
                    <td className="px-3 py-2">{naira(payslip.payeMinor)}</td>
                    <td className="px-3 py-2 font-medium">{naira(payslip.netMinor)}</td>
                    <td className="px-3 py-2">
                      {payslip.disbursementStatus ? (
                        <div className="flex flex-col gap-0.5">
                          <Badge variant={PAYSLIP_DISBURSEMENT_VARIANT[payslip.disbursementStatus]}>{payslip.disbursementStatus}</Badge>
                          {payslip.disbursementFailureReason && (
                            <span className="text-xs text-muted-foreground">{payslip.disbursementFailureReason}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="border-t border-border bg-surface">
                      <td colSpan={6} className="px-3 py-3">
                        <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Payslip — tax computation</p>
                        <div className="grid gap-1 text-sm sm:grid-cols-2">
                          <span>Annual gross: {naira(payslip.breakdown.annualGrossMajor * 100)}</span>
                          <span>Annual pension: {naira(payslip.breakdown.annualPensionMajor * 100)}</span>
                          <span>Annual taxable: {naira(payslip.breakdown.annualTaxableMajor * 100)}</span>
                          <span>Annual PAYE: {naira(payslip.breakdown.annualPayeMajor * 100)}</span>
                        </div>
                        {payslip.breakdown.bandsApplied.length > 0 && (
                          <div className="mt-2 flex flex-col gap-1">
                            {payslip.breakdown.bandsApplied.map((band, index) => (
                              <span key={index} className="text-xs text-muted-foreground">
                                {band.ratePercent}% on {band.upToMajor === null ? "remaining income" : `up to ₦${band.upToMajor.toLocaleString()}`} = {naira(band.amountMajor * 100)}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                  </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {reconcileMutation.data && (
            <div className="mt-4 overflow-x-auto rounded-md border border-border">
              <div className="border-b border-border bg-surface px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground">
                Reconciliation vs SAPOK Pay — checked {new Date(reconcileMutation.data.checkedAt).toLocaleString()}
              </div>
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="bg-surface text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Employee</th>
                    <th className="px-3 py-2">NEXORA</th>
                    <th className="px-3 py-2">SAPOK Pay</th>
                    <th className="px-3 py-2">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {reconcileMutation.data.entries.map((entry) => (
                    <tr key={entry.employeeId} className="border-t border-border">
                      <td className="px-3 py-2 text-muted-foreground">{entry.employeeName}</td>
                      <td className="px-3 py-2">
                        {entry.nexoraStatus} · {naira(entry.nexoraNetMinor)}
                      </td>
                      <td className="px-3 py-2">
                        {entry.sapokPayStatus ? `${entry.sapokPayStatus} · ${naira(entry.sapokPayAmountMinor ?? 0)}` : "no matching item"}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={entry.matches ? "success" : "danger"}>{entry.matches ? "MATCH" : "MISMATCH"}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
