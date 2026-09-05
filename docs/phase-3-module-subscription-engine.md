# Phase 3 — Module + Subscription Engine

Status: **verified working end-to-end**, behind a **mock payment gateway**.
No real payment provider is integrated yet — see [Mock payment gateway](#mock-payment-gateway-important)
below before treating any of this as production-ready for real money.

## What this phase adds

1. **Module catalog** — a fixed list of the business modules Phase 5 will
   actually build (`employees`, `attendance`, `leave`, `documents`,
   `compliance`, `payroll`). Seeded, not user-created, since entries must
   correspond to real features.
2. **Plans** — purchasable tiers (price, billing cycle, included modules).
3. **Subscriptions** — one per `Organisation`, tracking the paid period and
   lifecycle status.
4. **Invoices** — one per billing-cycle charge attempt. A `PAID` invoice
   doubles as the receipt (`receiptNumber`, `paidAt`).

## Data model

```
Module ──< PlanModule >── Plan ──< Subscription >── Organisation
                                       │
                                       └─< Invoice
```

Migration: `20260905092811_phase3_module_subscription_engine`.

Money is stored as `priceMinor` / `amountMinor` — an integer in minor
currency units (e.g. kobo for NGN) — to avoid floating-point rounding.
`currency` defaults to `"NGN"` but is a plain string field, not hardcoded
logic, so it isn't locked to one currency going forward.

## Subscription lifecycle

```
TRIALING ──┐
           ├──► ACTIVE ──(period ends)──► GRACE_PERIOD ──(grace ends)──► SUSPENDED
           │                  ▲
           └──────────────────┘ (renew)

Any state ──(cancel)──► CANCELLED   [terminal]
```

**There is no scheduler/cron yet** (no BullMQ worker started for this — per
the README, workers aren't started until the phase that needs them). Instead,
`SubscriptionsService.refreshStatus` re-derives the effective status from
dates **on every read** and persists it if it changed:

- `now <= currentPeriodEnd` → `ACTIVE` (or `TRIALING` if never activated)
- `currentPeriodEnd < now <= gracePeriodEndsAt` → `GRACE_PERIOD` (grace end is
  stamped the first time this is entered: `currentPeriodEnd + 7 days`)
- `now > gracePeriodEndsAt` → `SUSPENDED`
- `CANCELLED` is sticky — once cancelled, dates no longer matter.

Each system-driven transition writes an `AuditLog` row with
`actorType: "SYSTEM"` (no human actor). This self-healing-on-read approach is
a deliberate simplification for this phase — revisit with a real scheduled
job once a worker process exists.

## Mock payment gateway (important)

`services/core-api/src/billing/payment-gateway.interface.ts` defines a
provider-agnostic `PaymentGateway` interface (`charge(input): Promise<ChargeResult>`).
The only implementation right now is `MockPaymentGateway`, which **always
succeeds** — there is no real card/bank to decline a charge.

To exercise the failure path anyway (e.g. to test what a declined payment
looks like), `POST .../subscription/renew` accepts
`{ "simulateFailure": true }`. This is handled **one layer up**, in
`SubscriptionsService.renew` — it short-circuits before ever calling the
gateway, so `MockPaymentGateway` stays a faithful stand-in for what a real
provider's happy path looks like.

**To integrate a real provider later** (Paystack, Flutterwave, etc.):
implement `PaymentGateway` and swap the class bound to `PAYMENT_GATEWAY` in
`billing.module.ts`:

```ts
{ provide: PAYMENT_GATEWAY, useClass: PaystackGateway } // instead of MockPaymentGateway
```

Nothing else in the billing module needs to change.

## API surface

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/billing/modules` | `billing:read` | fixed catalog |
| GET | `/billing/plans` | `billing:read` | includes `moduleKeys` |
| GET | `/billing/plans/:id` | `billing:read` | |
| POST | `/billing/plans` | `billing:manage_plans` | |
| PATCH | `/billing/plans/:id` | `billing:manage_plans` | price, description, `isActive`, modules |
| GET | `/organisations/:id/subscription` | `billing:read` | 404 `SUBSCRIPTION_NOT_FOUND` if none assigned yet |
| POST | `/organisations/:id/subscription` | `billing:manage_subscriptions` | assign a plan; 409 if one already exists |
| PATCH | `/organisations/:id/subscription` | `billing:manage_subscriptions` | change plan |
| POST | `/organisations/:id/subscription/renew` | `billing:manage_subscriptions` | creates an `Invoice`, charges via the gateway |
| POST | `/organisations/:id/subscription/cancel` | `billing:manage_subscriptions` | immediate, terminal |
| GET | `/organisations/:id/invoices` | `billing:read` | list, newest first |
| GET | `/invoices/:id` | `billing:read` | single invoice/receipt |

New permissions (see `prisma/seed.ts`): `billing:read`,
`billing:manage_plans`, `billing:manage_subscriptions`. `SUPER_ADMIN` has
all three; `FINANCE` has read + manage-subscriptions (not manage-plans —
defining pricing tiers stays a `SUPER_ADMIN` decision).

## Seeded catalog

Demo plans (`prisma/seed.ts`) — **placeholder pricing, replace before any
real launch**:

| Plan | Price | Cycle | Modules |
|---|---|---|---|
| Starter | ₦15,000/mo | Monthly | employees, attendance, leave |
| Growth | ₦35,000/mo | Monthly | + documents, compliance |
| Enterprise | ₦80,000/yr | Annually | + payroll |

## Frontend

- `app/billing/page.tsx` — plan catalog (create a plan + pick its modules,
  gated by `billing:manage_plans`; everyone with `billing:read` can view).
- `app/organisations/page.tsx` — each organisation row shows its
  subscription status and, for users with `billing:manage_subscriptions`:
  assign a plan (if none yet), renew (with a "simulate failure" button for
  testing), or cancel.

## Verifying it locally

```bash
pnpm core-api:prisma:seed   # seeds modules + plans alongside Phase 2's RBAC data
pnpm core-api:dev
```

Onboard an organisation → assign a plan → renew → confirm an `Invoice` with
`status: "PAID"` and a `receiptNumber` appears in `GET /organisations/:id/invoices`.
Renew again with `simulateFailure: true` → confirm a `FAILED` invoice is
recorded and the subscription's period is untouched.

## Known gaps / deferred on purpose

- **No real payment provider** — this is the headline caveat, repeated here
  on purpose. Do not point this at real money.
- No proration on plan change (`changePlan` swaps `planId`, current period
  is untouched).
- No automatic recurring billing — renewal is a manual/triggered action, not
  a background job (see [Subscription lifecycle](#subscription-lifecycle)).
- Module *entitlement enforcement* (actually blocking access to a module an
  org's plan doesn't include) isn't built — that's meaningful once Phase 5's
  business modules exist to gate.
