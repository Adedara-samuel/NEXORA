# NEXORA

Enterprise-grade, multi-tenant organisational management platform. Owned and
operated by **SAPOK TECH**.

NEXORA consists of two user-facing applications sharing one backend:

- **NEXORA Control Center** (`apps/control-center`) — the web app SAPOK TECH
  platform administrators use to onboard organisations, manage subscriptions
  and modules, and monitor the ecosystem.
- **NEXORA Organisation Desktop** (`apps/organisation-desktop`) — one Tauri
  desktop application used by every organisation; the authenticated session
  determines organisation identity, subscription, enabled modules, roles and
  permissions.

Both talk to the **NEXORA Core API** (`services/core-api`, NestJS), the
single source of truth. PostgreSQL (with pgvector for future AI phases) and
Redis back the API; the **NEXORA AI Service** (`services/ai-service`,
Python/FastAPI) arrives in Phase 7.

## Monorepo layout

```
apps/
  control-center/        Next.js — platform administration web app
  organisation-desktop/  Tauri + React — organisation-facing desktop app
services/
  core-api/               NestJS + Prisma — the backend for both apps
  ai-service/              Python/FastAPI — NEXORA Intelligence Layer (Phase 7+)
workers/
  payroll-worker/          BullMQ workers — each not started until the phase
  payment-worker/          that needs it (see each worker's README)
  notification-worker/
  document-worker/
  ai-worker/
packages/
  ui/          shared shadcn/ui-based component library
  types/       shared TypeScript domain types
  validation/  shared Zod schemas (used by both frontend forms and API DTOs)
  api-client/  typed HTTP client for the Core API
  config/      shared tsconfig/tailwind/eslint config
infrastructure/
  database/   Postgres init scripts (extensions)
  nginx/      reverse proxy config (Phase 12)
docs/
scripts/
```

## Prerequisites

- Node.js 20+ and `pnpm` (`corepack enable` will pick up the pinned version)
- Docker Desktop (Postgres + Redis run in containers; the API/web apps run
  natively for fast local iteration)
- Rust + `cargo` — only required when building the actual Tauri desktop
  shell (`apps/organisation-desktop/src-tauri`); the React frontend runs
  fine without it via `pnpm dev` (browser preview)
- Python 3.11+ — only required from Phase 7 onward (`services/ai-service`)

## Getting started

```bash
cp .env.example .env                 # fill in real secrets before anything but local dev
cp .env services/core-api/.env       # Prisma CLI only reads .env from its own cwd
pnpm install

pnpm docker:up                       # starts Postgres (pgvector) + Redis only
pnpm --filter @nexora/types build    # shared packages need a real dist/ build —
pnpm --filter @nexora/validation build # core-api runs compiled JS, not raw TS source
pnpm --filter @nexora/core-api prisma:migrate -- --name init
pnpm core-api:prisma:seed            # seeds a few platform users to log in with

pnpm core-api:dev                    # http://localhost:4000/api/v1 (Swagger at /api/v1/docs)
pnpm control-center:dev              # http://localhost:3000
```

Seeded platform accounts (password `ChangeMe123!` for all, override via
`SEED_SUPER_ADMIN_PASSWORD`):

| Email | Status |
|---|---|
| `admin@sapoktech.com` | ACTIVE — super admin |
| `support@sapoktech.com` | ACTIVE |
| `finance@sapoktech.com` | ACTIVE |
| `offboarded@sapoktech.com` | DISABLED — exercises the inactive-user rejection path |

Log in at `http://localhost:3000/login`.

To also run the Core API itself in Docker (closer to production):
`pnpm docker:up:all` instead of `pnpm docker:up`.

### Deploying Control Center separately (e.g. Vercel)

No repo split needed. Point a Vercel project at this repo with **Root
Directory** set to `apps/control-center` — Vercel's pnpm-workspace support
builds it (and its `@nexora/*` dependencies) as an independent deployment
with its own URL and env vars (`NEXT_PUBLIC_CORE_API_URL` pointing at wherever
the Core API is hosted). The Core API itself needs a host that runs
persistent Node services (Railway/Render/Fly/a VPS) rather than Vercel's
serverless model — Postgres connections, BullMQ workers, and long-lived
processes don't fit the serverless request lifecycle.

## Development phases

This platform is built incrementally. Status:

| Phase | Scope | Status |
|---|---|---|
| 1 | Foundation — monorepo, Docker, Postgres, Redis, Core API, Prisma, basic UI, shared packages, auth foundation | **Verified working end-to-end** |
| 2 | Control Center — platform auth/users/roles/permissions, organisation management & onboarding | **Verified working end-to-end** — see [`docs/phase-2-platform-rbac-and-organisations.md`](docs/phase-2-platform-rbac-and-organisations.md) |
| 3 | Module + Subscription Engine — plans, subscriptions, billing, receipts, expiry/grace period/suspension, renewal | **Verified working end-to-end** (mock payment gateway) — see [`docs/phase-3-module-subscription-engine.md`](docs/phase-3-module-subscription-engine.md) |
| 4 | Organisation Platform — org auth, Super Admin, user management, custom roles, departments, branches | **Verified working end-to-end** — see [`docs/phase-4-organisation-platform.md`](docs/phase-4-organisation-platform.md) |
| 5 | Business Modules — employees, attendance, leave, documents, compliance, payroll | **Verified working end-to-end (backend)** — see [`docs/phase-5-employees.md`](docs/phase-5-employees.md), [`docs/phase-5-attendance-leave.md`](docs/phase-5-attendance-leave.md), [`docs/phase-5-payroll.md`](docs/phase-5-payroll.md), [`docs/phase-5-documents-compliance.md`](docs/phase-5-documents-compliance.md) |
| 6 | NEXORA PAY — wallet ledger, bank connections, payment batches, reconciliation, payslips | **Complete** — superseded by integrating the standalone `sapok-pay` project (see `../sapok-pay`) rather than building this inside Core API. An organisation can create employees, run payroll, fund its SAPOK Pay wallet, disburse, reconcile the result against SAPOK Pay's own records, and view a per-employee payslip breakdown — entirely from within NEXORA, verified as one continuous flow — see [`docs/phase-6-payroll-disbursement.md`](docs/phase-6-payroll-disbursement.md) |
| 7 | NEXORA AI Foundation — Python service, AI gateway, model abstraction, conversations, permissions | Superseded by integrating the standalone `sapok-ai` project (see `../sapok-ai`) — not yet integrated |
| 8 | NEXORA Knowledge — document ingestion, embeddings, pgvector, RAG | Superseded by `sapok-ai` — not yet integrated |
| 9 | NEXORA AI Actions — tool registry, authorized business actions, approval workflows | Superseded by `sapok-ai` — not yet integrated |
| 10 | NEXORA Intelligence Platform — feedback, evaluation, training data, model registry | Not started |
| 11 | Security + Quality — tenant isolation, financial, RBAC, AI security, E2E, performance testing | Not started |
| 12 | Deployment — production Docker, CI/CD, monitoring, backups, desktop release | Not started |

See the full architecture spec for the detailed requirements behind each
phase. Full PRD/BRD/SRS documentation with flowcharts is maintained as
published artifacts (see project owner for links) and expands as each phase
lands — it is not pre-written ahead of the system it describes.

### Frontend status (tracked explicitly per project owner request)

Control Center's UI (auth, dashboard, organisations, platform users, roles,
billing) is built and mobile-responsive with the custom scrollbar/animation
polish applied. Organisation Desktop now has a full frontend across
**both** Phase 4 (org login, departments, branches, organisation users,
organisation roles) and Phase 5 (employees, attendance, leave, payroll —
including disbursement — documents, compliance) — see
[`docs/organisation-desktop-frontend.md`](docs/organisation-desktop-frontend.md)
for exactly what was built and, importantly, **what was and wasn't
verified**: every new API-client method was curl-verified directly against
the running backend, and the whole app type-checks and production-builds
cleanly, but the pages themselves have not been visually tested in a real
browser in this environment — treat that specific part as "should work"
rather than "confirmed working" until someone clicks through it. **Process
carried forward**: every module's frontend gets built in the same pass as
its backend (or, where a backend shipped ahead of its UI, closed out in a
dedicated catch-up pass immediately after) rather than left indefinitely
backend-only. Phase 10 is the next explicit checkpoint the project owner
asked to be notified about.

### Design constraint carried forward to Phase 9

Phase 9's tool registry must authorize every AI-initiated action through the
**same** `PermissionsGuard` / `@RequirePermissions(...)` mechanism introduced
in Phase 2 (see [`docs/phase-2-platform-rbac-and-organisations.md`](docs/phase-2-platform-rbac-and-organisations.md)) —
not a parallel ACL system built specifically for the AI layer. An AI agent
acting on a user's behalf should never be able to see or do anything that
user's own JWT permissions wouldn't already allow via the normal API. Two
permission systems (one for humans, one for AI) drift apart over time and are
exactly how AI copilots end up leaking data at other companies; one shared
enforcement boundary can't drift from itself.

## Notes on this environment

This development machine has no Rust/Cargo and no Python installed, so:
- `apps/organisation-desktop` currently runs as a plain Vite+React web
  preview (`pnpm dev` → `http://localhost:1420`); the native Tauri shell
  (`src-tauri/`) is scaffolded but has not been built/compiled here.
- `services/ai-service` is not yet scaffolded with code — it starts in
  Phase 7.
