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
| 7 | NEXORA AI Foundation — Python service, AI gateway, model abstraction, conversations, permissions | **Verified working end-to-end** — integrated the standalone `sapok-ai` project (see `../sapok-ai`, itself now a completed 15-phase build) rather than building a second implementation inside Core API; one SAPOK AI Developer account per Organisation, permission-aware knowledge search enforced through the same `PermissionsGuard` every other endpoint uses — see [`docs/phase-7-ai-foundation.md`](docs/phase-7-ai-foundation.md) |
| 8 | NEXORA Knowledge — document ingestion, embeddings, pgvector, RAG | **Verified working end-to-end** — organisations ingest real text knowledge entries into `sapok-ai`, gated by their own real permission catalog; a two-user, permission-aware retrieval test confirmed one user's role sees a gated entry and another's doesn't. A later security review then found and fixed two authorization bugs in this phase's read endpoints (a gated entry's content was readable by any `assistant:use` holder, and route ids allowed path traversal onto other SAPOK AI endpoints) — now covered by Core API's first jest spec; see [`docs/phase-8-nexora-knowledge.md`](docs/phase-8-nexora-knowledge.md) |
| 9 | NEXORA AI Actions — tool registry, authorized business actions, approval workflows | **Verified working end-to-end** — a real, NEXORA-native action-approval system (not a `sapok-ai` integration this time: the actions are NEXORA business logic gated by NEXORA's own RBAC, which SAPOK AI has no way to enforce). First action tool: payroll disbursement, with server-enforced maker-checker approval — see [`docs/phase-9-ai-actions.md`](docs/phase-9-ai-actions.md) |
| 10 | NEXORA Intelligence Platform — feedback, evaluation, training data, model registry | **Feedback and evaluation verified working; training data and model registry deliberately not built** — organisations rate assistant replies and see their own feedback trend (via a new tenant-scoped `sapok-ai` endpoint); Control Center shows platform-wide adoption and action volume from NEXORA's own data. SAPOK AI's training-data export is cross-tenant so it stays out of NEXORA entirely, and there is no trained model to put in a registry — see [`docs/phase-10-intelligence-platform.md`](docs/phase-10-intelligence-platform.md) |
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
Phase 4 (org login, departments, branches, organisation users, organisation
roles), Phase 5 (employees, attendance, leave, payroll — including
disbursement — documents, compliance), **Phase 7** (a conversation list,
message thread, and permission-aware knowledge-search panel at
`/assistant`, gated by the new `assistant:use` permission the same way
every other nav item is gated by its own), **Phase 8** (a "Manage
knowledge" panel on the same page, gated by a stricter
`assistant:manage_knowledge` permission — add/list/delete knowledge
entries, with a required-permission dropdown sourced from the org's own
real permission catalog), **Phase 9** (an "Actions" panel — propose a
registered business action, approve/reject/execute it, with the approve
button disabled when the viewer is the action's own proposer), **Phase 10**
(thumbs up/down under every assistant reply, plus a reply-feedback summary
card; Control Center's dashboard gains an "AI assistant" adoption card), and
a real **Dashboard** landing page for Organisation Desktop (headcount,
attendance, leave, department distribution, payroll, items needing attention,
recent activity — every widget backed by real data, sections gated by the
caller's own permissions) — see
[`docs/organisation-desktop-frontend.md`](docs/organisation-desktop-frontend.md),
[`docs/phase-7-ai-foundation.md`](docs/phase-7-ai-foundation.md),
[`docs/phase-8-nexora-knowledge.md`](docs/phase-8-nexora-knowledge.md),
[`docs/phase-9-ai-actions.md`](docs/phase-9-ai-actions.md),
[`docs/phase-10-intelligence-platform.md`](docs/phase-10-intelligence-platform.md) and
[`docs/organisation-dashboard.md`](docs/organisation-dashboard.md) for exactly what
was built and, importantly, **what was and wasn't verified**:
every new API-client method was curl-verified directly against the running
backend, and the whole app type-checks and production-builds cleanly, but
the Dashboard and Assistant pages have now also been driven through the real
sign-in form and real clicks in headless Chrome (the dashboard in dark and
light themes, the assistant page in dark) with screenshots reviewed. **Every other page has still not been visually tested
in a real browser in this environment** — treat those as "should work" rather
than "confirmed working" until someone clicks through them. **Process carried
forward**: every module's frontend gets built in the same pass as its
backend (or, where a backend shipped ahead of its UI, closed out in a
dedicated catch-up pass immediately after) rather than left indefinitely
backend-only. **Phase 10 was the explicit checkpoint the project owner asked
to be notified about — it has now been reached.** Phase 11 (Security +
Quality) is next.

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
