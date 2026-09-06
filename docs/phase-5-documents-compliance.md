# Phase 5, slices 5-6 — Documents & Compliance (Phase 5 complete)

Status: **verified working end-to-end (backend); frontend built in the same
pass, compiles/builds cleanly but not visually tested in a browser — see**
[`docs/organisation-desktop-frontend.md`](organisation-desktop-frontend.md).
This closes out Phase 5 — employees, attendance, leave, payroll, documents
and compliance are all built. Migration: `20260905162343_phase5_documents_compliance`.

## Why Documents is metadata-only

NEXORA doesn't run its own file storage yet (no S3/blob integration
exists anywhere in the platform). Rather than block this module on that
infrastructure decision, `Document.fileUrl` is a plain URL string the
organisation points at wherever they already keep the file (their own
Drive, S3 bucket, etc.) — same "don't build the hard infrastructure piece
twice, mock/defer it and document the gap" approach used for SAPOK Pay's
mock bank and NEXORA's mock payment gateway. Real file upload/storage is a
deliberate, explicit gap — not an oversight.

## Data model

```
Organisation ──< Document ──> Employee (optional — null = company-wide)
Organisation ──< ComplianceRecord ──> Employee (optional — null = org-wide)
                                  └──> Document (optional evidence link)
```

Both `employeeId` fields are optional by design: a document or compliance
obligation can belong to one employee (an ID, a certification) or to the
organisation as a whole (a company policy, a business license) — there's
no separate "organisation document" model, just a nullable FK.

## API surface

Same tenant-isolation mechanism as the rest of Phase 4/5.

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/organisation/documents` | `documents:read` | filter by `employeeId`, `category` |
| GET | `/organisation/documents/:id` | `documents:read` | |
| POST | `/organisation/documents` | `documents:create` | `fileUrl` must be a valid URL (`400` otherwise) |
| PATCH | `/organisation/documents/:id` | `documents:update` | |
| GET | `/organisation/compliance` | `compliance:read` | filter by `employeeId`, `status` |
| GET | `/organisation/compliance/:id` | `compliance:read` | |
| POST | `/organisation/compliance` | `compliance:create` | always created `PENDING`; optional `documentId` must belong to the same org |
| PATCH | `/organisation/compliance/:id` | `compliance:update` | setting `status: "COMPLIANT"` requires `completedDate` in the **same request**, enforced server-side — identical rule to Employee's `TERMINATED` + `terminationDate` |

New permissions: `documents:read`, `documents:create`, `documents:update`,
`compliance:read`, `compliance:create`, `compliance:update`. Same known
limitation as the rest of Phase 5 — pre-existing organisations'
`SUPER_ADMIN` roles won't auto-sync these new keys.

## Verified

- Created an employee-scoped document and a company-wide document
  (`employeeId: null`) in the same organisation.
- Invalid `fileUrl` (not a URL) correctly rejected (`400`).
- Created a compliance record, then confirmed setting `status: "COMPLIANT"`
  without `completedDate` is rejected (`400`); with it, succeeds — and
  linking a `documentId` as evidence in the same request works.
- A compliance record referencing a non-existent/foreign `documentId`
  correctly rejected (`400`), same pattern as `employeeId`/`departmentId`
  cross-tenant checks elsewhere.
- **Tenant isolation**: a second organisation's document and compliance
  lists are empty, and fetching the first org's records by ID directly
  returns a clean `404`.

## What's not built yet (Phase 5 is otherwise complete)

Real file upload/storage (see "Why Documents is metadata-only" above), no
automatic status transition to `EXPIRED` when a `dueDate`/document
`expiryDate` passes (status changes are manual today — a scheduled job to
flip these automatically would be a natural follow-up, not built).

## Frontend

Built in the same pass as the backend (the process change recorded in the
main README) — see
[`docs/organisation-desktop-frontend.md`](organisation-desktop-frontend.md).
