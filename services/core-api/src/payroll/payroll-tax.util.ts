import type { PayslipBreakdown, TaxBandDefinition } from "@nexora/types";

/**
 * Statutory employee pension contribution when an organisation hasn't set
 * its own OrganisationTaxSettings.pensionRatePercent. Nigeria: 8% under the
 * Pension Reform Act. Any country without an entry here defaults to 0% —
 * an organisation in that country must set pensionRatePercent explicitly.
 */
export const DEFAULT_PENSION_RATE_PERCENT_BY_COUNTRY: Record<string, number> = {
  NG: 8,
};

/**
 * Progressive band calculation over ANNUAL taxable income, in whole
 * currency units (major, not minor) — see TaxBand's schema comment for why.
 * `bands` must be ascending by threshold with the last entry's
 * `upToMajor: null` (validated at the edge, in updateTaxSettingsSchema).
 */
export function computeAnnualPaye(
  taxableAnnualMajor: number,
  bands: TaxBandDefinition[],
): { totalMajor: number; bandsApplied: PayslipBreakdown["bandsApplied"] } {
  let remaining = taxableAnnualMajor;
  let lowerBound = 0;
  let totalMajor = 0;
  const bandsApplied: PayslipBreakdown["bandsApplied"] = [];

  for (const band of bands) {
    if (remaining <= 0) break;
    const bandWidth = band.upToMajor === null ? remaining : Math.max(0, band.upToMajor - lowerBound);
    const amountInBand = Math.min(remaining, bandWidth);
    if (amountInBand > 0) {
      const amountMajor = Math.round(amountInBand * (band.ratePercent / 100));
      totalMajor += amountMajor;
      bandsApplied.push({ upToMajor: band.upToMajor, ratePercent: band.ratePercent, amountMajor });
      remaining -= amountInBand;
    }
    lowerBound = band.upToMajor ?? lowerBound;
  }

  return { totalMajor, bandsApplied };
}

/**
 * Pension contributions are treated as fully tax-exempt (deducted from
 * gross before PAYE is applied) — matches Nigeria's treatment under the
 * Pension Reform Act. Other deductions (loans, benefits-in-kind, rent
 * relief, etc.) are NOT modeled — see docs/phase-5-payroll.md.
 */
export function computePayslip(params: { monthlySalaryMinor: number; bands: TaxBandDefinition[]; pensionRatePercent: number }): {
  pensionMinor: number;
  payeMinor: number;
  breakdown: PayslipBreakdown;
} {
  const { monthlySalaryMinor, bands, pensionRatePercent } = params;
  const annualGrossMajor = (monthlySalaryMinor * 12) / 100;
  const annualPensionMajor = (annualGrossMajor * pensionRatePercent) / 100;
  const annualTaxableMajor = Math.max(0, annualGrossMajor - annualPensionMajor);

  const { totalMajor: annualPayeMajor, bandsApplied } = computeAnnualPaye(annualTaxableMajor, bands);

  return {
    pensionMinor: Math.round((annualPensionMajor / 12) * 100),
    payeMinor: Math.round((annualPayeMajor / 12) * 100),
    breakdown: { annualGrossMajor, annualPensionMajor, annualTaxableMajor, annualPayeMajor, bandsApplied },
  };
}
