import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { PayrollDisbursementStatus, PayrollReconciliationReport, PayrollRun } from "@nexora/types";
import { PrismaService } from "../prisma/prisma.service";
import { ConflictApiException, NotFoundApiException, ValidationApiException } from "../common/exceptions/api.exception";

interface SapokPayBatchItem {
  recipientLabel: string | null;
  amountMinor: number;
  status: "SUCCESSFUL" | "FAILED";
  failureReason: string | null;
}

interface SapokPayBatch {
  id: string;
  status: "PROCESSING" | "COMPLETED" | "PARTIALLY_FAILED" | "FAILED";
  items: SapokPayBatchItem[];
}

/**
 * Talks to SAPOK Pay (a separate standalone service, see ../sapok-pay) to
 * actually pay out a completed payroll run's net salaries — the
 * difference between NEXORA *computing* payroll (Phase 5, already done)
 * and NEXORA *paying* it. See docs/phase-6-payroll-disbursement.md.
 */
@Injectable()
export class PayoutsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Idempotent: an organisation is provisioned as a SAPOK Pay Merchant
   * exactly once — the merchant ID and API key are cached on the
   * Organisation row after the first call. SAPOK Pay's own provisioning
   * endpoint is ALSO idempotent by externalReference (Organisation.id), so
   * even if NEXORA's cache were somehow lost mid-provisioning, calling
   * again is safe — except SAPOK Pay can only ever show a raw API key
   * once, so a second call after a lost cache can't recover it (see the
   * error below).
   */
  async ensureProvisioned(organisationId: string): Promise<{ merchantId: string; apiKey: string }> {
    const organisation = await this.prisma.organisation.findUniqueOrThrow({ where: { id: organisationId } });
    if (organisation.paymentProviderMerchantId && organisation.paymentProviderApiKey) {
      return { merchantId: organisation.paymentProviderMerchantId, apiKey: organisation.paymentProviderApiKey };
    }

    const response = await fetch(`${this.sapokPayUrl()}/api/v1/service/merchants`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Service-Secret": this.config.getOrThrow<string>("SAPOK_PAY_SERVICE_SECRET") },
      body: JSON.stringify({
        email: `org-${organisation.id}@sapoktech.internal`,
        businessName: organisation.name,
        externalReference: organisation.id,
      }),
    });
    const body = (await response.json()) as { success: boolean; data?: { merchantId: string; apiKey: string | null }; error?: { message: string } };

    if (!response.ok || !body.success || !body.data) {
      throw new ValidationApiException(`Could not provision a SAPOK Pay merchant for this organisation: ${body.error?.message ?? "unknown error"}`);
    }
    if (!body.data.apiKey) {
      throw new ValidationApiException(
        "This organisation already has a SAPOK Pay merchant, but NEXORA doesn't have its API key on file — SAPOK Pay only shows a raw key once, at creation. Contact SAPOK Pay support to resolve.",
      );
    }

    await this.prisma.organisation.update({
      where: { id: organisationId },
      data: { paymentProviderMerchantId: body.data.merchantId, paymentProviderApiKey: body.data.apiKey },
    });

    return { merchantId: body.data.merchantId, apiKey: body.data.apiKey };
  }

  async disburseRun(organisationId: string, payrollRunId: string, actorId: string): Promise<PayrollRun> {
    const run = await this.prisma.payrollRun.findUnique({
      where: { id: payrollRunId },
      include: { payslips: { include: { employee: true } } },
    });
    if (!run || run.organisationId !== organisationId) {
      throw new NotFoundApiException("Payroll run not found", "PAYROLL_RUN_NOT_FOUND");
    }
    if (run.status !== "COMPLETED") {
      throw new ValidationApiException("Only a COMPLETED payroll run can be disbursed");
    }
    if (run.disbursementStatus === "DISBURSED" || run.disbursementStatus === "PARTIALLY_DISBURSED") {
      throw new ValidationApiException("This payroll run has already been disbursed");
    }
    if (run.disbursementStatus === "DISBURSING") {
      throw new ConflictApiException("A disbursement attempt for this payroll run is already in progress", "DISBURSEMENT_IN_PROGRESS");
    }

    const payable = run.payslips.filter((payslip) => payslip.employee.bankAccountNumber);
    const skipped = run.payslips.filter((payslip) => !payslip.employee.bankAccountNumber);

    if (payable.length === 0) {
      const failed = await this.prisma.payrollRun.update({ where: { id: run.id }, data: { disbursementStatus: "FAILED" } });
      throw new ValidationApiException("No payslip's employee has a bank account on file — nothing to disburse", {
        disbursementStatus: failed.disbursementStatus,
      });
    }

    const { apiKey } = await this.ensureProvisioned(organisationId);

    // Each attempt gets its own idempotency key (below) — without this, a
    // retry after fixing the underlying problem (e.g. funding the wallet)
    // would just replay SAPOK Pay's cached failure from the FIRST attempt
    // forever, since the key would otherwise be identical every time. A
    // real bug caught in end-to-end testing, not a hypothetical.
    const { disbursementAttempts: attemptNumber } = await this.prisma.payrollRun.update({
      where: { id: run.id },
      data: { disbursementStatus: "DISBURSING", disbursementAttempts: { increment: 1 } },
    });

    for (const payslip of skipped) {
      await this.prisma.payslip.update({
        where: { id: payslip.id },
        data: { disbursementStatus: "SKIPPED", disbursementFailureReason: "Employee has no bank account on file" },
      });
    }

    // recipientLabel carries the NEXORA employeeId through SAPOK Pay and
    // back — correlating the batch's per-item result by that explicit key,
    // not by trusting the response array to preserve request order across
    // a network boundary.
    const items = payable.map((payslip) => ({
      recipientAccountNumber: payslip.employee.bankAccountNumber!,
      amountMinor: payslip.netMinor,
      recipientLabel: payslip.employeeId,
    }));

    const response = await fetch(`${this.sapokPayUrl()}/api/v1/wallets/me/payroll-batches`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "Idempotency-Key": `nexora-payroll-run-${run.id}-attempt-${attemptNumber}`,
      },
      body: JSON.stringify({ items }),
    });
    const body = (await response.json()) as { success: boolean; data?: SapokPayBatch; error?: { message: string } };

    if (!response.ok || !body.success || !body.data) {
      await this.prisma.payrollRun.update({ where: { id: run.id }, data: { disbursementStatus: "FAILED" } });
      throw new ValidationApiException(`SAPOK Pay rejected the payroll batch: ${body.error?.message ?? "unknown error"}`);
    }

    const batch = body.data;
    const itemByEmployeeId = new Map(batch.items.map((item) => [item.recipientLabel, item]));

    for (const payslip of payable) {
      const item = itemByEmployeeId.get(payslip.employeeId);
      await this.prisma.payslip.update({
        where: { id: payslip.id },
        data: {
          disbursementStatus: item?.status === "SUCCESSFUL" ? "PAID" : "FAILED",
          disbursementFailureReason: item?.status === "SUCCESSFUL" ? null : (item?.failureReason ?? "No matching result returned by SAPOK Pay"),
        },
      });
    }

    const disbursementStatus: PayrollDisbursementStatus =
      batch.status === "COMPLETED" ? "DISBURSED" : batch.status === "PARTIALLY_FAILED" ? "PARTIALLY_DISBURSED" : "FAILED";

    const updated = await this.prisma.payrollRun.update({
      where: { id: run.id },
      data: { disbursementStatus, disbursementBatchReference: batch.id },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        actorType: "ORGANISATION_USER",
        organisationId,
        action: "PAYROLL_RUN_DISBURSED",
        resourceType: "PayrollRun",
        resourceId: run.id,
        metadata: { batchReference: batch.id, disbursementStatus, payableCount: payable.length, skippedCount: skipped.length },
      },
    });

    return {
      id: updated.id,
      organisationId: updated.organisationId,
      periodYear: updated.periodYear,
      periodMonth: updated.periodMonth,
      status: updated.status,
      currency: updated.currency,
      totalGrossMinor: updated.totalGrossMinor,
      totalDeductionsMinor: updated.totalDeductionsMinor,
      totalNetMinor: updated.totalNetMinor,
      skippedEmployeeCount: updated.skippedEmployeeCount,
      disbursementStatus: updated.disbursementStatus,
      disbursementBatchReference: updated.disbursementBatchReference,
      disbursementAttempts: updated.disbursementAttempts,
      createdById: updated.createdById,
      createdAt: updated.createdAt.toISOString(),
    };
  }

  /**
   * Compares NEXORA's own record of a disbursement (Payslip.disbursementStatus
   * /netMinor) against what SAPOK Pay's payroll batch actually says happened
   * — the two systems agreeing at the moment `disburseRun` ran is not the
   * same guarantee as them still agreeing later (a bug, a manual DB edit,
   * or a race on either side could make them drift silently). Read-only,
   * on-demand — there's no scheduled reconciliation job, this is a "check
   * right now" diagnostic, not continuous monitoring.
   */
  async reconcileRun(organisationId: string, payrollRunId: string): Promise<PayrollReconciliationReport> {
    const run = await this.prisma.payrollRun.findUnique({
      where: { id: payrollRunId },
      include: { payslips: { include: { employee: true } } },
    });
    if (!run || run.organisationId !== organisationId) {
      throw new NotFoundApiException("Payroll run not found", "PAYROLL_RUN_NOT_FOUND");
    }
    if (!run.disbursementBatchReference) {
      throw new ValidationApiException("This payroll run has not been disbursed yet — nothing to reconcile");
    }

    const { apiKey } = await this.ensureProvisioned(organisationId);
    const batch = await this.sapokPayFetch<SapokPayBatch>(apiKey, "GET", `/api/v1/wallets/me/payroll-batches/${run.disbursementBatchReference}`);
    const itemByEmployeeId = new Map(batch.items.map((item) => [item.recipientLabel, item]));

    const entries = run.payslips.map((payslip) => {
      const item = itemByEmployeeId.get(payslip.employeeId);
      const sapokPayStatus: PayrollDisbursementStatus | "PAID" | "FAILED" | null = item ? (item.status === "SUCCESSFUL" ? "PAID" : "FAILED") : null;

      // A SKIPPED payslip (no bank account) was never submitted to SAPOK
      // Pay at all — the correct match for it is "no item exists", not a
      // status comparison.
      const matches =
        payslip.disbursementStatus === "SKIPPED"
          ? item === undefined
          : sapokPayStatus === payslip.disbursementStatus && (item?.amountMinor ?? null) === payslip.netMinor;

      return {
        employeeId: payslip.employeeId,
        employeeName: `${payslip.employee.firstName} ${payslip.employee.lastName}`,
        nexoraStatus: payslip.disbursementStatus,
        nexoraNetMinor: payslip.netMinor,
        sapokPayStatus,
        sapokPayAmountMinor: item?.amountMinor ?? null,
        sapokPayFailureReason: item?.failureReason ?? null,
        matches,
      };
    });

    return {
      payrollRunId: run.id,
      batchReference: run.disbursementBatchReference,
      checkedAt: new Date().toISOString(),
      mismatchCount: entries.filter((entry) => !entry.matches).length,
      entries,
    };
  }

  /**
   * Without these, an organisation's SAPOK Pay wallet can only ever be
   * funded by a human manually posting an admin adjustment on SAPOK Pay's
   * own side (fine for testing, not a real product flow) — the
   * auto-provisioned merchant has a randomly-generated, immediately
   * discarded password, so nobody can ever log into SAPOK Pay's own
   * dashboard for it. NEXORA proxies these calls itself, using the API key
   * cached by `ensureProvisioned`, so an organisation never needs a
   * separate SAPOK Pay login at all.
   */
  async getWallet(organisationId: string): Promise<{ balanceMinor: number; currency: string }> {
    const { apiKey } = await this.ensureProvisioned(organisationId);
    return this.sapokPayFetch(apiKey, "GET", "/api/v1/wallets/me");
  }

  async listBankAccounts(organisationId: string): Promise<{ id: string; accountNumber: string; accountName: string; bankCode: string; createdAt: string }[]> {
    const { apiKey } = await this.ensureProvisioned(organisationId);
    return this.sapokPayFetch(apiKey, "GET", "/api/v1/wallets/bank-accounts");
  }

  async linkBankAccount(
    organisationId: string,
    accountNumber: string,
  ): Promise<{ id: string; accountNumber: string; accountName: string; bankCode: string; createdAt: string }> {
    const { apiKey } = await this.ensureProvisioned(organisationId);
    return this.sapokPayFetch(apiKey, "POST", "/api/v1/wallets/bank-accounts", { accountNumber });
  }

  async depositToWallet(
    organisationId: string,
    bankAccountId: string,
    amountMinor: number,
    idempotencyKey: string,
  ): Promise<{ id: string; status: string; amountMinor: number }> {
    const { apiKey } = await this.ensureProvisioned(organisationId);
    return this.sapokPayFetch(apiKey, "POST", "/api/v1/wallets/me/deposits", { bankAccountId, amountMinor }, { "Idempotency-Key": idempotencyKey });
  }

  private async sapokPayFetch<T>(apiKey: string, method: string, path: string, body?: unknown, extraHeaders?: Record<string, string>): Promise<T> {
    const response = await fetch(`${this.sapokPayUrl()}${path}`, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}`, ...extraHeaders },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const parsed = (await response.json()) as { success: boolean; data?: T; error?: { code: string; message: string } };

    if (!response.ok || !parsed.success || parsed.data === undefined) {
      throw new ValidationApiException(`SAPOK Pay request failed: ${parsed.error?.message ?? "unknown error"}`, parsed.error ? { sapokPayCode: parsed.error.code } : undefined);
    }
    return parsed.data;
  }

  private sapokPayUrl(): string {
    return this.config.get<string>("SAPOK_PAY_API_URL", "http://localhost:4100");
  }
}
