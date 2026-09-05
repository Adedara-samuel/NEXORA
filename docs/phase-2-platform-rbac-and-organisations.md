# Phase 2 — Platform RBAC & Organisation Management

Status: **verified working end-to-end** (local + production). Builds on the
Phase 1 auth foundation (`PlatformUser`, JWT access/refresh tokens).

## What this phase adds

1. **Platform RBAC** — permissions grouped into roles, roles assigned to
   platform users. Replaces the "no roles yet" gap left in Phase 1.
2. **Organisation management & onboarding** — the platform-managed shell
   record for a tenant organisation, with a lifecycle status.

Subscriptions/billing (Phase 3) and organisation-side auth/admin (Phase 4)
build on top of the `Organisation` model introduced here, but neither is in
scope for this phase.

## Data model

```
PlatformPermission ──┐
                      ├─< PlatformRolePermission >─┐
PlatformRole ─────────┘                            │
     │                                              │
     └─< PlatformUserRole >──── PlatformUser ───────┘

Organisation (name, slug, status, contact info, createdBy → PlatformUser)
```

- `PlatformPermission` is a fixed catalog (seeded, not user-created) —
  entries are checked directly against `@RequirePermissions(...)` in code, so
  changing a `key` means updating every controller that references it.
- `PlatformRole.isSystem` roles (`SUPER_ADMIN`, `SUPPORT`, `FINANCE`) can't be
  deleted via the API. Custom roles created through the UI/API are regular
  (non-system) rows.
- `Organisation.status` lifecycle: `PENDING → ACTIVE ⇄ SUSPENDED → ARCHIVED`
  (`ARCHIVED` is terminal). Enforced server-side in
  `OrganisationsService.updateStatus`.

Migration: `20260904180327_phase2_rbac_organisations`.

## How permissions actually work

Permissions are **embedded in the JWT access token at login/refresh**, not
looked up per-request:

1. On login (or refresh), `AuthService.issueTokens` calls
   `RbacService.getUserRbac(userId)`, which flattens the user's roles into a
   `roles: string[]` and `permissions: string[]` pair.
2. Those two arrays are signed into the access token
   (`AccessTokenPayload.roles` / `.permissions`, in `packages/types/src/auth.ts`).
3. `PermissionsGuard` (`common/guards/permissions.guard.ts`), applied per
   controller via `@UseGuards(PermissionsGuard)`, reads `request.user.permissions`
   (populated by the existing `JwtAuthGuard`/Passport strategy) and checks it
   against the `@RequirePermissions(...)` metadata on the route.

**Trade-off, deliberate**: a role change takes effect on the user's *next
token refresh* (access tokens expire in `JWT_ACCESS_EXPIRES_IN`, default
15m), not instantly. There's no per-request DB/Redis lookup. Revisit if
Phase 11 (Security + Quality) needs tighter revocation guarantees.

The frontend mirrors this: `apps/control-center/src/lib/jwt.ts` decodes the
access token client-side (no signature check needed — the API is the real
enforcement boundary) purely to decide **what to render** — see
`components/app-shell.tsx`, which filters the sidebar (`lib/nav.ts`) to only
the items the user's permissions allow.

## API surface

All routes require a valid access token (global `JwtAuthGuard`) plus the
listed permission, unless noted.

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/platform/roles` | `platform_roles:read` | |
| GET | `/platform/permissions` | `platform_roles:read` | full catalog |
| POST | `/platform/roles` | `platform_roles:manage` | create a custom role |
| PATCH | `/platform/roles/:id` | `platform_roles:manage` | update description/permissions |
| DELETE | `/platform/roles/:id` | `platform_roles:manage` | 403 if `isSystem` |
| GET | `/platform/users` | `platform_users:read` | paginated, filter by status/search |
| GET | `/platform/users/me` | auth only | self-service profile lookup |
| GET | `/platform/users/:id` | `platform_users:read` | |
| POST | `/platform/users` | `platform_users:create` | sets initial password directly (no email invite flow yet) |
| PATCH | `/platform/users/:id` | `platform_users:update` | profile, status, role reassignment |
| GET | `/organisations` | `organisations:read` | paginated, filter by status/search |
| GET | `/organisations/:id` | `organisations:read` | |
| POST | `/organisations` | `organisations:create` | auto-slugs from `name` if omitted |
| PATCH | `/organisations/:id` | `organisations:update` | |
| PATCH | `/organisations/:id/status` | `organisations:manage_status` | validates the transition |

Every mutating action writes to `AuditLog` (`actorId`, `action`,
`resourceType`, `resourceId`, `metadata`).

## Seeded roles (`prisma/seed.ts`)

| Role | Permissions |
|---|---|
| `SUPER_ADMIN` | all |
| `SUPPORT` | `platform_users:read`, `organisations:read` |
| `FINANCE` | `organisations:read`, `billing:read`, `billing:manage_subscriptions` (Phase 3) |

Demo accounts (password `ChangeMe123!`, override via `SEED_SUPER_ADMIN_PASSWORD`):
`admin@sapoktech.com` (SUPER_ADMIN), `support@sapoktech.com` (SUPPORT),
`finance@sapoktech.com` (FINANCE), `offboarded@sapoktech.com` (SUPPORT,
seeded `DISABLED` to exercise the inactive-user rejection path).

## Frontend

- `app/roles/page.tsx` — create a role, pick its permissions from the live
  catalog (grouped by category), edit an existing role's permissions inline,
  delete non-system roles.
- `app/platform-users/page.tsx` — create a platform user with role
  assignment, toggle a user's `ACTIVE`/`DISABLED` status.
- `app/organisations/page.tsx` — onboard an organisation, drive its status
  transitions.
- `components/app-shell.tsx` — the permission-gated sidebar shared by every
  authenticated page.

## Verifying it locally

```bash
pnpm docker:up
pnpm --filter @nexora/core-api prisma:migrate -- --name init   # if not already applied
pnpm core-api:prisma:seed
pnpm core-api:dev
pnpm control-center:dev
```

Log in as `admin@sapoktech.com`; the sidebar should show Organisations,
Platform Users and Roles. Log in as `finance@sapoktech.com` and confirm only
Organisations (and Billing, once Phase 3's seed has run) are visible.

## Known gaps / deferred on purpose

- No email-invite flow for new platform users — an admin sets the initial
  password directly.
- No custom-role permission editor for *renaming* a role, only its
  description/permissions (renaming would need to reconcile any code that
  might reference the name — not needed yet since nothing does).
- Role/permission changes propagate on next token refresh, not instantly
  (see trade-off above).
