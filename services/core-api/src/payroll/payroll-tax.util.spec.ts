import { computeAnnualPaye, computePayslip, DEFAULT_PENSION_RATE_PERCENT_BY_COUNTRY } from "./payroll-tax.util";
import type { TaxBandDefinition } from "@nexora/types";

/**
 * Financial correctness (Phase 12): this is the money math every payslip and
 * disbursement in the system is built on, so it's covered with real
 * hand-computed figures — not just "it runs" — including the boundaries
 * between bands, where an off-by-one in `lowerBound`/`bandWidth` would most
 * likely hide.
 */

// The actual seeded Nigeria bands (prisma/seed.ts's NG_TAX_BANDS) — real
// figures an organisation using this system will actually see.
const NG_BANDS: TaxBandDefinition[] = [
  { upToMajor: 800_000, ratePercent: 0 },
  { upToMajor: 3_000_000, ratePercent: 15 },
  { upToMajor: 12_000_000, ratePercent: 18 },
  { upToMajor: 25_000_000, ratePercent: 21 },
  { upToMajor: 50_000_000, ratePercent: 23 },
  { upToMajor: null, ratePercent: 25 },
];

describe("computeAnnualPaye", () => {
  it("charges nothing when income doesn't exceed the first band", () => {
    const { totalMajor, bandsApplied } = computeAnnualPaye(500_000, NG_BANDS);
    expect(totalMajor).toBe(0);
    expect(bandsApplied).toEqual([{ upToMajor: 800_000, ratePercent: 0, amountMajor: 0 }]);
  });

  it("charges exactly nothing at the first band's exact upper boundary", () => {
    const { totalMajor } = computeAnnualPaye(800_000, NG_BANDS);
    expect(totalMajor).toBe(0);
  });

  it("taxes only the excess over a boundary at the next band's rate — not the whole amount", () => {
    // 800,001: 800,000 @ 0% + 1 @ 15% (rounds to 0), proving the band is
    // applied to the MARGINAL amount, not the full income at the new rate.
    const { totalMajor } = computeAnnualPaye(800_001, NG_BANDS);
    expect(totalMajor).toBe(0); // Math.round(1 * 0.15) === 0
    const { totalMajor: total1000Over } = computeAnnualPaye(801_000, NG_BANDS);
    expect(total1000Over).toBe(150); // Math.round(1_000 * 0.15) === 150 — NOT 801,000 * 0.15
  });

  it("spans three bands correctly for a mid-range income (hand-computed)", () => {
    // 800,000 @ 0% = 0; next 2,200,000 @ 15% = 330,000; remaining 2,000,000 @ 18% = 360,000
    const { totalMajor, bandsApplied } = computeAnnualPaye(5_000_000, NG_BANDS);
    expect(totalMajor).toBe(690_000);
    expect(bandsApplied).toEqual([
      { upToMajor: 800_000, ratePercent: 0, amountMajor: 0 },
      { upToMajor: 3_000_000, ratePercent: 15, amountMajor: 330_000 },
      { upToMajor: 12_000_000, ratePercent: 18, amountMajor: 360_000 },
    ]);
  });

  it("spans every band, including the unbounded top band, for a high income (hand-computed)", () => {
    // 0 + 330,000 + 1,620,000 + 2,730,000 + 5,750,000 + 2,500,000
    const { totalMajor, bandsApplied } = computeAnnualPaye(60_000_000, NG_BANDS);
    expect(totalMajor).toBe(12_930_000);
    expect(bandsApplied).toHaveLength(6);
    expect(bandsApplied[5]).toEqual({ upToMajor: null, ratePercent: 25, amountMajor: 2_500_000 });
  });

  it("returns zero tax and no applied bands for zero or negative taxable income", () => {
    expect(computeAnnualPaye(0, NG_BANDS)).toEqual({ totalMajor: 0, bandsApplied: [] });
    expect(computeAnnualPaye(-1000, NG_BANDS)).toEqual({ totalMajor: 0, bandsApplied: [] });
  });

  it("charges the flat rate on all income when only a single unbounded band exists", () => {
    const flatBand: TaxBandDefinition[] = [{ upToMajor: null, ratePercent: 10 }];
    const { totalMajor } = computeAnnualPaye(1_000_000, flatBand);
    expect(totalMajor).toBe(100_000);
  });
});

describe("computePayslip", () => {
  it("matches a hand-computed payslip end to end (₦500,000/month, default NG pension)", () => {
    const result = computePayslip({ monthlySalaryMinor: 50_000_000, bands: NG_BANDS, pensionRatePercent: DEFAULT_PENSION_RATE_PERCENT_BY_COUNTRY.NG });
    // annualGross 6,000,000 -> pension 8% = 480,000 -> taxable 5,520,000
    // PAYE: 0 + 330,000 (band2) + 453,600 (2,520,000 @ 18%, band3) = 783,600/yr
    expect(result.breakdown.annualGrossMajor).toBe(6_000_000);
    expect(result.breakdown.annualPensionMajor).toBe(480_000);
    expect(result.breakdown.annualTaxableMajor).toBe(5_520_000);
    expect(result.breakdown.annualPayeMajor).toBe(783_600);
    expect(result.pensionMinor).toBe(4_000_000); // ₦40,000/month, in kobo
    expect(result.payeMinor).toBe(6_530_000); // ₦65,300/month, in kobo
  });

  it("deducts nothing when pensionRatePercent is 0 (a country with no default, not overridden)", () => {
    const result = computePayslip({ monthlySalaryMinor: 50_000_000, bands: NG_BANDS, pensionRatePercent: 0 });
    expect(result.pensionMinor).toBe(0);
    expect(result.breakdown.annualTaxableMajor).toBe(result.breakdown.annualGrossMajor);
  });

  it("never returns a negative taxable amount even if pension somehow exceeded gross", () => {
    const result = computePayslip({ monthlySalaryMinor: 100_000, bands: NG_BANDS, pensionRatePercent: 150 });
    expect(result.breakdown.annualTaxableMajor).toBe(0);
    expect(result.payeMinor).toBe(0);
  });

  it("a zero salary produces a zero payslip, not NaN or a thrown error", () => {
    const result = computePayslip({ monthlySalaryMinor: 0, bands: NG_BANDS, pensionRatePercent: 8 });
    expect(result.pensionMinor).toBe(0);
    expect(result.payeMinor).toBe(0);
  });
});
