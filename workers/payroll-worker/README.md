# NEXORA Payroll Worker

BullMQ + Redis background worker for payroll calculation, approval-stage
transitions, and payment-batch orchestration (architecture sections 32, 52).

**Not started.** Built in **Phase 6 (NEXORA PAY)**, once the Payroll domain
models and business logic exist in `services/core-api` for this worker to
operate on. Will share `@nexora/types` and connect to the same Postgres/Redis
instances as the Core API.
