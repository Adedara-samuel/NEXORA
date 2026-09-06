export interface TaxBandDefinition {
  upToMajor: number | null;
  ratePercent: number;
}

export interface OrganisationTaxSettings {
  organisationId: string;
  countryCode: string;
  /** Null when the organisation has no override and is using the country default. */
  customBands: TaxBandDefinition[] | null;
  /** Null when the organisation has no override and is using the platform default (8% for Nigeria). */
  pensionRatePercent: number | null;
  /** What payroll will actually use right now, after resolving the override/default fallback. */
  effectiveBands: TaxBandDefinition[];
  effectivePensionRatePercent: number;
}

export type PayrollRunStatus = "COMPLETED" | "CANCELLED";
export type PayrollDisbursementStatus = "NOT_DISBURSED" | "DISBURSING" | "DISBURSED" | "PARTIALLY_DISBURSED" | "FAILED";
export type PayslipDisbursementStatus = "PAID" | "FAILED" | "SKIPPED";

export interface PayrollRun {
  id: string;
  organisationId: string;
  periodYear: number;
  periodMonth: number;
  status: PayrollRunStatus;
  currency: string;
  totalGrossMinor: number;
  totalDeductionsMinor: number;
  totalNetMinor: number;
  skippedEmployeeCount: number;
  disbursementStatus: PayrollDisbursementStatus;
  disbursementBatchReference: string | null;
  disbursementAttempts: number;
  createdById: string | null;
  createdAt: string;
}

export interface PayslipBreakdown {
  annualGrossMajor: number;
  annualPensionMajor: number;
  annualTaxableMajor: number;
  annualPayeMajor: number;
  bandsApplied: { upToMajor: number | null; ratePercent: number; amountMajor: number }[];
}

export interface Payslip {
  id: string;
  payrollRunId: string;
  organisationId: string;
  employeeId: string;
  grossMinor: number;
  pensionMinor: number;
  payeMinor: number;
  otherDeductionsMinor: number;
  netMinor: number;
  currency: string;
  breakdown: PayslipBreakdown;
  disbursementStatus: PayslipDisbursementStatus | null;
  disbursementFailureReason: string | null;
  createdAt: string;
}

export interface PayrollRunWithPayslips extends PayrollRun {
  payslips: Payslip[];
}

export interface PayrollWallet {
  balanceMinor: number;
  currency: string;
}

export interface PayrollBankAccount {
  id: string;
  accountNumber: string;
  accountName: string;
  bankCode: string;
  createdAt: string;
}

export interface PayrollWalletDeposit {
  id: string;
  status: string;
  amountMinor: number;
}

export interface PayrollReconciliationEntry {
  employeeId: string;
  employeeName: string;
  nexoraStatus: PayslipDisbursementStatus | null;
  nexoraNetMinor: number;
  sapokPayStatus: "PAID" | "FAILED" | null;
  sapokPayAmountMinor: number | null;
  sapokPayFailureReason: string | null;
  matches: boolean;
}

export interface PayrollReconciliationReport {
  payrollRunId: string;
  batchReference: string;
  checkedAt: string;
  mismatchCount: number;
  entries: PayrollReconciliationEntry[];
}
