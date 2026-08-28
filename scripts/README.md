# NEXORA Scripts

Operational scripts (database backup/restore, environment bootstrap,
release helpers) are added as the phases that need them land. See
`package.json` at the repo root for the current dev-workflow scripts
(`docker:up`, `core-api:prisma:migrate`, etc.) — most day-to-day tasks
don't need a dedicated script yet.
