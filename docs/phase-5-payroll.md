# Phase 5, slice 4 — Payroll

Status: **verified working end-to-end (computation and API only — no bank
payout, no payslip PDF, no frontend)**. Depends on `Employee.salaryMinor`
(Phase 5 slice 1). Migration: `20260905154656_phase5_payroll`.

## Why tax bands are data, not code

Earlier direction from the project owner: *"it is nigeria tax law we will
work with first for now, but every organization can always work to correct
theirs — if the organisation is a Nigeria company, they use Nigeria law; if
other country, they use their own country tax law."* Hardcoding Nigeria's
PAYE formula into the service would satisfy the first half of that and
break the second. Instead:

- `TaxBand` — a global, code-curated catalog keyed by `countryCode`. Only
  `"NG"` is seeded today (6 bands, reflecting Nigeria's Tax Act 2025 bands
  effective 2026-01-01: 0% to ₦800k, then 15/18/21/23/25% progressively up
  to the ₦50M+ top band). **This is a best-effort implementation, not
  verified by a tax professional** — verify against current FIRS guidance
  before relying on it for real payroll.
- `OrganisationTaxSettings` — one optional row per organisation. If
  `customBands` is set, it **fully replaces** the country default for that
  org; if `pensionRatePercent` is set, it overrides the platform default
  (8% for Nigeria, under the Pension Reform Act). This is the "every
  organisation can correct theirs" mechanism — a non-Nigerian organisation
  sets `customBands` for their own country's law; a Nigerian organisation
  that disagrees with the seeded bands can override them too, without a
  code change or deploy.
- `Organisation.countryCode` (`@default("NG")`) picks which country's
  default bands apply when there's no override.

If an organisation's country has no seeded `TaxBand` rows and no
`customBands` override, running payroll fails with a clear `400` telling
the admin to configure `customBands` first — it never silently falls back
to Nigeria's law for a non-Nigerian org.

## Calculation (`payroll-tax.util.ts`, pure functions, no DB access)

Per employee, per run:

1. `annualGrossMajor = (Employee.salaryMinor * 12) / 100` — annual, in
   whole currency units (not minor units) so tax-band thresholds like
   ₦50,000,000 fit an `Int32` column without overflow risk.
2. `annualPensionMajor = annualGrossMajor * effectivePensionRatePercent / 100`
   — treated as fully tax-exempt (deducted before PAYE), matching Nigeria's
   treatment under the Pension Reform Act.
3. `annualTaxableMajor = max(0, annualGrossMajor - annualPensionMajor)`,
   then progressive bands are applied in order, each band taxing only the
   slice of income that falls within it (standard marginal-rate PAYE, not
   a flat rate on the whole income).
4. Annual PAYE and pension are divided by 12 and converted back to minor
   units for the monthly payslip.

**Not modeled** (explicitly, not by oversight): rent relief, other
statutory reliefs, loan/benefit-in-kind deductions, unpaid-leave proration
against Attendance/Leave records, overlapping approved leave. All monthly
payslips currently assume `Employee.salaryMinor` is the full month's pay
regardless of attendance/leave taken that month.

## API surface

Same tenant-isolation mechanism as the rest of Phase 4/5. A `PayrollRun` is
immutable once created — correcting a mistake means `PATCH .../cancel` and
starting a fresh run for that period, never editing figures in place (same
principle as SAPOK Pay's ledger: append, don't mutate).

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/organisation/payroll/tax-settings` | `payroll:read` | returns the raw override (if any) AND the resolved `effectiveBands`/`effectivePensionRatePercent` actually used |
| PUT | `/organisation/payroll/tax-settings` | `payroll:manage_settings` | `customBands` validated ascending with a `null`-terminated top band; at least one field required |
| GET | `/organisation/payroll/runs` | `payroll:read` | paginated |
| GET | `/organisation/payroll/runs/:id` | `payroll:read` | includes all payslips |
| POST | `/organisation/payroll/runs` | `payroll:create` | `{periodYear, periodMonth}` — duplicate period → `409`; no tax bands configured → `400` |
| PATCH | `/organisation/payroll/runs/:id/cancel` | `payroll:create` | cancelling an already-cancelled run → `400` |

New permissions: `payroll:read`, `payroll:create`, `payroll:manage_settings`.
Same known limitation as the rest of Phase 5 — pre-existing organisations'
`SUPER_ADMIN` roles won't auto-sync these new keys.

## Verified

- Fresh organisation's tax settings resolve to the Nigeria defaults with no
  override configured.
- Employee on ₦500,000/month, no override: computed PAYE (₦65,300/mo),
  pension (₦40,000/mo) and net (₦394,700/mo) hand-checked against the band
  table and matched exactly, including the full `bandsApplied` trail in the
  payslip's `breakdown`.
- An `ACTIVE` employee with no `salaryMinor` set is skipped, not defaulted
  to zero pay — reflected in the run's `skippedEmployeeCount`.
- Running payroll twice for the same `(organisationId, periodYear, periodMonth)`
  correctly rejected (`409`).
- Overriding `pensionRatePercent` to 10% changed a subsequent run's pension
  and PAYE figures correctly (higher pre-tax deduction lowers taxable
  income, hand-checked again).
- Invalid `customBands` (non-ascending thresholds; missing the
  `null`-terminated top band) both correctly rejected (`400`).
- Cancelling a run sets `status: CANCELLED`; cancelling it again correctly
  rejected (`400`).
- **Tenant isolation**: a second organisation's payroll run list is empty,
  fetching the first org's run by ID returns a clean `404`, and the second
  org's tax settings are completely unaffected by the first org's override.

## What's not built yet

Documents, Compliance. Also not built for Payroll specifically: payslip
PDF/export, any bank-payout integration (this is exactly where `sapok-pay`
integration will eventually plug in — see the main README's Phase 6-9
rows), and any attendance/leave-based proration.

## Frontend

Built in the Phase 4/5 catch-up pass — see
[`docs/organisation-desktop-frontend.md`](organisation-desktop-frontend.md)
for what was built (tax settings editor, run-payroll form, runs list with
expandable payslips) and its verification status (compiles and builds
cleanly; not yet visually tested in a browser).
