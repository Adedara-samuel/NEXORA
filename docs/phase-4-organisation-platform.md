# Phase 4 — Organisation Platform

Status: **verified working end-to-end**. Builds on Phase 2's platform RBAC
pattern, reusing the exact same shape for the organisation side.

## What this phase adds

1. **Org-side authentication** — `OrganisationUser`, a completely separate
   identity space from `PlatformUser`.
2. **Org-side RBAC** — `OrganisationPermission` / `OrganisationRole` /
   `OrganisationRolePermission` / `OrganisationUserRole`, the same shape as
   Phase 2's platform RBAC, but every role belongs to exactly one
   organisation.
3. **Departments and branches** — simple org-structure entities a user can
   belong to.
4. **Platform-initiated admin provisioning** — the one place a platform
   admin acts on an organisation's behalf, since an org has no login at all
   until this runs.

## The tenant-isolation boundary — the actual point of this phase

Email is unique **per-organisation**, not globally
(`@@unique([organisationId, email])` on `OrganisationUser`) — two different
organisations can each have an `hr@company.com` account. So org login needs
three things, not two: `organisationSlug`, `email`, `password`
(`POST /auth/organisation/login`).

Every org-scoped controller (`OrganisationUsersController`,
`OrganisationRbacController`, `OrganisationStructureController`) derives
`organisationId` from the caller's own JWT via
`@CurrentOrganisationId()` (`common/decorators/current-organisation-id.decorator.ts`)
— **never** from a URL param or request body. This is the actual
tenant-isolation mechanism: there is no code path where a client can supply
which organisation's data they want to see. Verified directly: onboarded
two organisations, gave each its own admin, and confirmed org B's admin
sees an empty user/department list and only its own `SUPER_ADMIN` role —
none of org A's data, despite both orgs existing in the same database.

The one deliberate exception is `POST /organisations/:id/admin`
(platform-scoped, takes `:id` from the URL) — provisioning an org's first
admin has to be platform-initiated, because no org user exists yet to
self-serve with.

## Data model

```
OrganisationPermission ──┐
                          ├─< OrganisationRolePermission >─┐
OrganisationRole ─────────┘                                │
     │ (scoped to ONE organisation:                        │
     │  @@unique([organisationId, name]))                  │
     └─< OrganisationUserRole >──── OrganisationUser ───────┘
                                          │
                                          ├── Department (optional)
                                          └── Branch (optional)
```

Contrast with Phase 2's `PlatformRole`: that's **one global catalog**
shared across all platform users. `OrganisationRole` is **per-tenant** —
each organisation defines its own roles from the shared
`OrganisationPermission` catalog (which, like `PlatformPermission`, is
fixed/seeded — a tenant can't invent new permission keys, only decide which
existing ones each of their own roles gets).

Migration: `20260905140650_phase4_organisation_platform`.

## How org-scoped permissions work

Identical mechanism to Phase 2, just a second `scope` value. At
login/refresh, `AuthService.issueTokens` calls
`OrganisationRbacService.getUserRbac(organisationUserId)` when
`scope === "organisation"`, flattening that user's org roles into
`roles`/`permissions` arrays embedded in the JWT — same
`PermissionsGuard`/`@RequirePermissions(...)` mechanism from Phase 2
enforces them, unchanged.

`AccessTokenPayload` for an organisation-scope token now carries
`organisationId` (which org) alongside `roles`/`permissions` (what that
user can do within it) — confirmed by decoding a real issued token:

```json
{
  "sub": "<organisationUserId>",
  "scope": "organisation",
  "organisationId": "<organisationId>",
  "roles": ["SUPER_ADMIN"],
  "permissions": ["org_users:read", "org_users:create", "..."]
}
```

## API surface

| Method | Path | Permission | Notes |
|---|---|---|---|
| POST | `/auth/organisation/login` | public | needs `organisationSlug` + `email` + `password` |
| GET | `/organisation/users/me` | auth only | self-service profile lookup |
| GET | `/organisation/users` | `org_users:read` | paginated, org-scoped |
| POST | `/organisation/users` | `org_users:create` | assign roles/department/branch at creation |
| PATCH | `/organisation/users/:id` | `org_users:update` | |
| GET | `/organisation/roles`, `/organisation/permissions` | `org_roles:read` | |
| POST | `/organisation/roles` | `org_roles:manage` | |
| PATCH` / `DELETE` `/organisation/roles/:id` | `org_roles:manage` | system role (`SUPER_ADMIN`) can't be deleted |
| GET/POST | `/organisation/departments`, `/organisation/branches` | `departments:read`/`manage`, `branches:read`/`manage` | |
| POST | `/organisations/:id/admin` | `organisations:update` (platform scope) | provisions the org's first `SUPER_ADMIN`; auto-creates that org's `SUPER_ADMIN` role if it doesn't exist yet (`OrganisationRbacService.ensureSuperAdminRole`, idempotent) |

## Seeded permission catalog

9 org permissions across 4 categories (`org_users`, `org_roles`,
`departments`, `branches`) — see `prisma/seed.ts`'s
`ORGANISATION_PERMISSIONS`. No roles are globally seeded (unlike platform's
`SUPER_ADMIN`/`SUPPORT`/`FINANCE`) — each organisation's `SUPER_ADMIN` role
is created on-demand, the first time `provisionAdmin` runs for that org.

## Frontend

**Not built yet.** This phase is API-only — no Control Center or
Organisation Desktop UI consumes any of this. That's the natural next slice
of work once this phase's backend is trusted.

## Known gaps / deferred on purpose

- No org-side password-reset or invite-by-email flow — an org admin sets a
  new user's initial password directly, same cut as Phase 2's platform
  users.
- No department/branch update or delete endpoints — list + create only.
  Deleting a department with users still assigned needs a real decision
  (reassign? block? nullify?) that wasn't worth guessing at for this phase.
- Role *renaming* isn't supported (only description/permissions), same
  reasoning as Phase 2.
