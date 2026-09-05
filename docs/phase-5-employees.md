# Phase 5, slice 1 — Employees

Status: **verified working end-to-end**. Phase 5 as a whole ("Business
Modules") covers employees, attendance, leave, documents, compliance, and
payroll — six sub-domains. This is the first slice; the other five aren't
built yet (see [What's not built](#whats-not-built-yet) below). Employees
came first because every other sub-module needs an employee to attach to.

## Why `Employee` is a separate model from `OrganisationUser`

Not every employee has (or needs) a login account, and not every
`OrganisationUser` is necessarily an employee (a contractor with admin
access, for instance). `Employee.organisationUserId` is an optional link
for the case where an employee also has system access — nothing requires
it. Migration: `20260905144310_phase5_employees`.

## Data model

```
Organisation ──< Employee >── Department (optional)
                    │      └─ Branch (optional)
                    └── OrganisationUser (optional, 1:1 link)
```

`employeeNumber` is unique per-organisation
(`@@unique([organisationId, employeeNumber])`), not globally — same pattern
as `OrganisationUser.email`. `salaryMinor` is nullable and stored in minor
currency units — nullable because not every employee record is created
with salary info up front, but present now so payroll (later in this
phase) doesn't need a schema change to use it.

## API surface

All org-scoped, same tenant-isolation mechanism as Phase 4
(`@CurrentOrganisationId()`, never a client-supplied org ID):

| Method | Path | Permission |
|---|---|---|
| GET | `/organisation/employees` | `employees:read` — paginated, filter by status/department/branch/search |
| GET | `/organisation/employees/:id` | `employees:read` |
| POST | `/organisation/employees` | `employees:create` |
| PATCH | `/organisation/employees/:id` | `employees:update` — setting `status: "TERMINATED"` requires `terminationDate` in the same request, enforced server-side |

New permissions (`prisma/seed.ts`): `employees:read`, `employees:create`,
`employees:update`.

**Known limitation, not a bug**: a pre-existing organisation's `SUPER_ADMIN`
role was created before these permissions existed and won't have them
automatically — `OrganisationRbacService.ensureSuperAdminRole` only runs
once per organisation (the first time an admin is provisioned) and doesn't
retroactively sync new permissions into already-created roles. A fresh
organisation gets all current permissions; an old one needs its role
manually updated via `PATCH /organisation/roles/:id`. Worth a proper
"resync system roles" mechanism eventually, not built yet.

## Verified

- Created an employee with a department, salary, and hire date.
- Duplicate `employeeNumber` within the same org correctly rejected (`409`).
- Setting `status: "TERMINATED"` without `terminationDate` correctly
  rejected (`400`); with it, succeeds.
- **Tenant isolation**: a second organisation's employee list is empty
  (doesn't see the first org's employee), and fetching the first org's
  employee by ID directly returns a clean `404` — not `403` (which would
  confirm the record exists), not the data.

## What's not built yet

Attendance, Leave, Documents, Compliance, Payroll — none of these exist.
Payroll specifically needs a real decision made before it's built: it will
default to Nigerian PAYE tax computation, with each organisation able to
configure its own country's tax rules (confirmed with the project owner) —
this is real, legally-relevant business logic, not something to guess at
quickly.

## Frontend

Built in the Phase 4/5 catch-up pass — see
[`docs/organisation-desktop-frontend.md`](organisation-desktop-frontend.md)
for what was built and its verification status (compiles and builds
cleanly; not yet visually tested in a browser).
