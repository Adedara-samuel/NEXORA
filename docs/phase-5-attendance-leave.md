# Phase 5, slices 2-3 — Attendance & Leave

Status: **verified working end-to-end**. Both depend on `Employee`
(Phase 5 slice 1, see [`docs/phase-5-employees.md`](phase-5-employees.md)) —
every record references an `employeeId`, never a raw name. Migration:
`20260905153904_phase5_attendance_leave`.

## Data model

```
Employee ──< Attendance   (one row per employee per calendar day)
Employee ──< LeaveRequest (approvedBy → OrganisationUser, not Employee)
```

`Attendance` has `@@unique([employeeId, date])` — a second record for the
same employee on the same day is rejected (`409`), not overwritten;
correcting a day means `PATCH`ing the existing record. `LeaveRequest.approvedBy`
points at `OrganisationUser` rather than `Employee` because approving a
request is an action taken by a logged-in account — an employee without
system access can be the *subject* of a leave request but can't action one.

## API surface

Same tenant-isolation mechanism as the rest of Phase 4/5
(`@CurrentOrganisationId()`, never a client-supplied org ID). Both modules
validate `employeeId` belongs to the caller's own organisation before
touching anything (`400 VALIDATION_ERROR` otherwise, not a 404/403 that
would leak whether the ID exists elsewhere).

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/organisation/attendance` | `attendance:read` | filter by `employeeId`, `status`, `from`/`to` date range |
| GET | `/organisation/attendance/:id` | `attendance:read` | |
| POST | `/organisation/attendance` | `attendance:create` | duplicate `(employeeId, date)` → `409` |
| PATCH | `/organisation/attendance/:id` | `attendance:update` | clock-out, status/notes correction |
| GET | `/organisation/leave` | `leave:read` | filter by `employeeId`, `status` |
| GET | `/organisation/leave/:id` | `leave:read` | |
| POST | `/organisation/leave` | `leave:create` | `endDate < startDate` → `400`; always created `PENDING` |
| PATCH | `/organisation/leave/:id/decision` | `leave:manage` | `{status: APPROVED\|REJECTED\|CANCELLED}` — `REJECTED` requires `rejectionReason` (`400` without it); only a `PENDING` request can be decided (`400` on a second decision) |

New permissions (`prisma/seed.ts`): `attendance:read`, `attendance:create`,
`attendance:update`, `leave:read`, `leave:create`, `leave:manage`. Same
known limitation as Phase 5 slice 1 — pre-existing organisations'
`SUPER_ADMIN` roles won't auto-sync these new keys.

## Verified

- Created an attendance record with a clock-in time; a second record for
  the same employee/date correctly rejected (`409`); `PATCH` to add
  `clockOutAt` succeeds.
- Leave request with `endDate` before `startDate` rejected (`400`).
- Rejecting a leave request without `rejectionReason` rejected (`400`);
  approving sets `approvedById`/`approvedAt` from the acting user.
- Deciding an already-decided (`APPROVED`) leave request a second time
  rejected (`400`) — decisions are final, not re-appliable.
- **Tenant isolation**: a second organisation's attendance/leave lists are
  empty, fetching the first org's records by ID returns a clean `404`, and
  attempting to create an attendance record against another org's
  `employeeId` is rejected as a `400` validation error (the ID simply
  "doesn't exist" from the second org's point of view).

## What's not built yet

Documents, Compliance, Payroll. No overlap-detection between approved
leave requests for the same employee (e.g. two approved ranges that
overlap) — acceptable for now, worth revisiting before this is used for
real payroll deduction logic.

## Frontend

Built in the Phase 4/5 catch-up pass — see
[`docs/organisation-desktop-frontend.md`](organisation-desktop-frontend.md)
for what was built and its verification status (compiles and builds
cleanly; not yet visually tested in a browser).
