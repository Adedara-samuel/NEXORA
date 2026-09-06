# Organisation Desktop — Phase 4/5 catch-up frontend pass

Status: **built, type-checked, and production-built successfully — NOT
visually verified in a browser.** This environment has no browser/screenshot
tool, so "it renders correctly and the interactions work" has not actually
been observed; only that every file compiles, the module graph resolves
with no broken imports, and the API calls are typed against the exact same
request/response shapes the backend was curl-verified against in
[`phase-5-employees.md`](phase-5-employees.md),
[`phase-5-attendance-leave.md`](phase-5-attendance-leave.md) and
[`phase-5-payroll.md`](phase-5-payroll.md). Treat this as "should work,
compiles cleanly, wiring is type-safe" rather than "confirmed working" —
someone needs to actually click through it before it's trusted for real use.

## Why this exists

Phase 4 (organisation platform) and Phase 5 (employees, attendance, leave,
payroll) were all built backend-only, one after another, with no UI —
flagged explicitly in the main [`README.md`](../README.md)'s "Frontend
status" section after the project owner asked. This started as a one-time
catch-up pass for Phase 5's four modules; Phase 4's own catch-up
(departments, branches, organisation users, organisation roles) followed
once Phase 6 (payroll disbursement) made it clear every backend surface
needed a matching frontend, not just the newest one.

## What was built

All in `apps/organisation-desktop` (Vite + React, not yet compiled as an
actual Tauri desktop binary — still the "web preview" mode noted in the
main README):

- **Auth**: `pages/login-page.tsx` (organisation slug + email + password →
  `POST /auth/organisation/login`), `store/auth-store.ts` (persisted JWT +
  decoded roles/permissions, mirrors Control Center's pattern), `lib/jwt.ts`.
- **Shell**: `components/app-shell.tsx` — permission-filtered sidebar nav
  (`lib/nav.ts`), redirects to `/login` when signed out. Built
  mobile-responsive from the start: the sidebar collapses into an
  off-canvas drawer (hamburger toggle) below the `md` breakpoint, rather
  than the fixed-width sidebar Control Center still has (that's a known,
  separate, still-open gap — see the main README).
- **Employees** (`pages/employees-page.tsx`): create form with
  department/branch dropdowns, list, and an inline expand-to-edit panel per
  row (status, termination date, salary).
- **Attendance** (`pages/attendance-page.tsx`): create form (employee,
  date, status, optional clock-in time), list with a one-click "Clock out"
  action on today's open records.
- **Leave** (`pages/leave-page.tsx`): request form, list with
  Approve/Reject (reject requires typing a reason first, matching the
  backend's validation) for pending requests.
- **Payroll** (`pages/payroll-page.tsx`): tax settings card (shows the
  resolved effective bands table, lets an admin override the pension rate
  or fully customise the band table row-by-row), run-payroll form, and a
  runs list where each row expands to its payslips and can be cancelled.
- **Documents** (`pages/documents-page.tsx`): add-document form (title,
  category, optional employee, external file URL, optional expiry date)
  and a list with an "Open" link and an EXPIRED badge once the expiry date
  has passed.
- **Compliance** (`pages/compliance-page.tsx`): add-record form and a list
  with an inline expand-to-edit panel per row (status, with a completed-date
  field that appears when setting status to COMPLIANT, matching the
  backend's same-request validation rule).

These two were built in the same pass as their Phase 5 backend slice
([`docs/phase-5-documents-compliance.md`](phase-5-documents-compliance.md)),
per the process change below — not part of the original Phase 4/5 catch-up
backlog, which only covered employees/attendance/leave/payroll.

- **Payroll disbursement** (`pages/payroll-page.tsx`, extended): each run
  now shows a disbursement-status badge, a "Disburse"/"Retry disbursement"
  button (only shown when `payroll:disburse` is held and the run isn't
  already `DISBURSED`/`PARTIALLY_DISBURSED`), and a per-payslip
  disbursement column with the failure reason inline. The Employees form
  (create + inline edit) now also captures `bankAccountNumber` — without
  it, disbursement has nothing to pay the employee's payslip to and the
  backend marks that payslip `SKIPPED`, which is exactly what happens if
  this field is left blank. Also added: a Wallet card (balance, bank-account
  linking, deposit form), a "Reconcile" button per disbursed run showing a
  match/mismatch table against SAPOK Pay's own records, and a per-payslip
  expandable tax-computation breakdown — see
  [`docs/phase-6-payroll-disbursement.md`](phase-6-payroll-disbursement.md)
  for the full Phase 6 writeup (now complete).
- **Organisation Structure** (`pages/organisation-structure-page.tsx`) —
  Phase 4's catch-up: two-column Departments/Branches page, create-only
  (the backend has no update/delete for either yet, so neither does this).
- **Organisation Users** (`pages/organisation-users-page.tsx`) — create
  form (email/password/name, role checkboxes sourced from
  `organisationRbac.listRoles()`, optional department/branch) and a list
  with inline status + role editing. Deliberately distinct from Employees:
  this is login-capable staff accounts, not HR records.
- **Roles** (`pages/organisation-roles-page.tsx`) — create form and list,
  permissions grouped by category with checkboxes (sourced from
  `organisationRbac.listPermissions()`), inline permission editing, and
  delete (blocked server-side for system roles, disabled client-side to
  match). Role names are coerced to `UPPER_SNAKE_CASE` client-side before
  submitting, matching the backend's validation regex.

## `@nexora/api-client` additions

Extended the shared client (`packages/api-client/src/client.ts`, used by
both Control Center and Organisation Desktop) with `auth.organisationLogin`,
`employees`, `attendance`, `leave`, `payroll` (including `disburse`),
`documents`, `compliance`, a full `organisationStructure` (create, not just
list), `organisationUsers`, and `organisationRbac`. Nothing existing was
changed or renamed. All new methods were curl-verified directly against
the running backend (not just typechecked) — create/list/update/delete for
roles, create/list/update for users, create for departments/branches —
confirming the request/response shapes actually match, not just compile.

## The Vite/CJS bug this pass found and fixed

`vite build` failed the first time with `"organisationLoginSchema" is not
exported by ".../packages/validation/dist/index.js"`. Root cause:
`@nexora/validation` ships a `tsc`-compiled **CommonJS** `dist/` (needed so
Core API's NestJS/Node runtime can `require()` it) built from files that
each do `export * from "./x"` — TypeScript compiles that to its
`__exportStar` helper, which re-exports names via a runtime
`Object.defineProperty` loop, not static assignment. Webpack (Next.js/
Control Center) resolves that kind of CJS interop at runtime and never
noticed a problem; Rollup (Vite's production bundler) requires
statically-visible named exports and can't see through the reflection-based
re-export, so it failed. Fixed with a `resolve.alias` in
`apps/organisation-desktop/vite.config.ts` that points `@nexora/validation`
straight at its TypeScript **source** instead of the compiled dist — esbuild
transpiles that as real ESM, sidestepping CJS interop entirely, the same
way `@nexora/ui` and `@nexora/api-client` already work (both are
source-consumed with no dist build at all). Core API and Control Center are
untouched — this alias only affects how Vite resolves the import for this
one app.

## What's still not built

- Payslip PDF/export, employee self-service view (an employee viewing their
  *own* payslips/leave balance — everything built here is the
  admin/HR-staff surface only).
- Packaging as an actual Tauri desktop binary — still runs as a Vite web
  preview, per the main README's "Notes on this environment" (no Rust/Cargo
  installed here).
- Real browser/interaction testing — see the status note at the top. The
  new API-client methods were curl-verified against the real backend, but
  the *pages* that call them (rendering, form interactions, permission
  gating in the actual UI) have not been clicked through in a browser.
- Control Center (the platform-admin app) still has none of NEXORA's own
  onboarding/monitoring surfaces for SAPOK Pay integration status (e.g.
  whether an organisation has been provisioned as a SAPOK Pay merchant) —
  that state exists on `Organisation.paymentProviderMerchantId` but nothing
  in either frontend surfaces it yet.

## Process change going forward

Recorded in the main README: from Documents/Compliance onward, each
module's frontend gets built in the same pass as its backend, not batched
up afterward like this one had to be.
