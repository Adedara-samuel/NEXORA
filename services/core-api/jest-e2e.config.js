/**
 * Separate from jest.config.js on purpose: these tests boot the real Nest
 * app (AppModule) against the actual dev Postgres/Redis — no mocks — so
 * they're slower and, unlike the unit specs, require the stack to be
 * running (`docker compose up -d` / equivalent). Kept out of the default
 * `pnpm test` run for that reason; run explicitly via `pnpm test:e2e`.
 */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: ".",
  testRegex: ".e2e-spec.ts$",
  // Tests share one live database and create/read real rows — run serially
  // (also passed as --runInBand in the npm script) so two files never race
  // each other's organisations.
  maxWorkers: 1,
  testTimeout: 20_000,
  // The real Redis client the app opens (RedisModule) doesn't release its
  // handle within Jest's shutdown window even after app.close() — a known
  // ioredis/ts-jest interaction, not a leak in app code. --forceExit
  // (in the npm script) is the standard, safe way past it: it only forces
  // the *test process* to exit after results are already recorded.
};
