import type { INestApplication } from "@nestjs/common";
import { api, createE2eApp, data, errorCode } from "./utils/e2e-app";
import { createActiveOrganisation, platformLogin } from "./utils/fixtures";

/**
 * The single most important guarantee in a multi-tenant system: organisation
 * A can never read, list, or modify organisation B's data. Every
 * organisation-scoped controller derives its tenant from the caller's OWN
 * JWT (`CurrentOrganisationId`, never a client-supplied id) — this suite
 * exercises that promise end-to-end, against the real app and real
 * Postgres, across every business module, rather than trusting that the
 * pattern was applied correctly everywhere by reading the code.
 *
 * Convention asserted throughout: a cross-tenant read/write gets the same
 * 404 an unknown id would — never 403, which would leak that the resource
 * exists in someone else's organisation.
 *
 * Deliberately excludes the assistant/knowledge routes: those proxy to
 * SAPOK AI (a separate service, not running as part of this repo's own test
 * setup) and are isolated by a completely different mechanism — one SAPOK
 * AI API key per Organisation, not a Prisma `organisationId` filter — which
 * is exactly what `assistant.service.spec.ts` already covers (mocked, so it
 * doesn't need SAPOK AI up) alongside the real permission-gating bugs found
 * and fixed in Phase 8. Making this suite depend on a sibling service being
 * started would trade real coverage for a fragile precondition.
 */
describe("Tenant isolation (e2e)", () => {
  let app: INestApplication;
  let orgA: Awaited<ReturnType<typeof createActiveOrganisation>>;
  let orgB: Awaited<ReturnType<typeof createActiveOrganisation>>;

  // Org A's resources, created once and probed from Org B throughout.
  let employeeId: string;
  let documentId: string;
  let complianceRecordId: string;
  let departmentId: string;

  beforeAll(async () => {
    const created = await createE2eApp();
    app = created.app;
    const platformToken = await platformLogin(app);
    orgA = await createActiveOrganisation(app, platformToken, "tenant-a");
    orgB = await createActiveOrganisation(app, platformToken, "tenant-b");

    const dept = await api(app).post("/api/v1/organisation/departments").set("Authorization", `Bearer ${orgA.adminToken}`).send({ name: "Engineering" });
    departmentId = data<{ id: string }>(dept).id;

    const employee = await api(app)
      .post("/api/v1/organisation/employees")
      .set("Authorization", `Bearer ${orgA.adminToken}`)
      .send({ employeeNumber: "EMP-001", firstName: "Ada", lastName: "Lovelace", hireDate: "2026-01-01", departmentId });
    employeeId = data<{ id: string }>(employee).id;

    const document = await api(app)
      .post("/api/v1/organisation/documents")
      .set("Authorization", `Bearer ${orgA.adminToken}`)
      .send({ title: "Passport scan", fileUrl: "https://example.com/passport.pdf", employeeId });
    documentId = data<{ id: string }>(document).id;

    const compliance = await api(app)
      .post("/api/v1/organisation/compliance")
      .set("Authorization", `Bearer ${orgA.adminToken}`)
      .send({ title: "Background check", employeeId });
    complianceRecordId = data<{ id: string }>(compliance).id;
  });

  afterAll(async () => {
    await app.close();
  });

  it("org B cannot read org A's employee by id", async () => {
    const res = await api(app).get(`/api/v1/organisation/employees/${employeeId}`).set("Authorization", `Bearer ${orgB.adminToken}`);
    expect(res.status).toBe(404);
  });

  it("org B cannot update org A's employee", async () => {
    const res = await api(app).patch(`/api/v1/organisation/employees/${employeeId}`).set("Authorization", `Bearer ${orgB.adminToken}`).send({ firstName: "Hacked" });
    expect(res.status).toBe(404);
  });

  it("org A's employee never appears in org B's employee list", async () => {
    const res = await api(app).get("/api/v1/organisation/employees").set("Authorization", `Bearer ${orgB.adminToken}`);
    expect(res.status).toBe(200);
    const ids = data<{ items: { id: string }[] }>(res).items.map((e) => e.id);
    expect(ids).not.toContain(employeeId);
  });

  it("org B cannot read org A's document by id", async () => {
    const res = await api(app).get(`/api/v1/organisation/documents/${documentId}`).set("Authorization", `Bearer ${orgB.adminToken}`);
    expect(res.status).toBe(404);
  });

  it("org A's document never appears in org B's document list", async () => {
    const res = await api(app).get("/api/v1/organisation/documents").set("Authorization", `Bearer ${orgB.adminToken}`);
    const ids = data<{ items: { id: string }[] }>(res).items.map((d) => d.id);
    expect(ids).not.toContain(documentId);
  });

  it("org B cannot read org A's compliance record by id", async () => {
    const res = await api(app).get(`/api/v1/organisation/compliance/${complianceRecordId}`).set("Authorization", `Bearer ${orgB.adminToken}`);
    expect(res.status).toBe(404);
  });

  it("org A's compliance record never appears in org B's compliance list", async () => {
    const res = await api(app).get("/api/v1/organisation/compliance").set("Authorization", `Bearer ${orgB.adminToken}`);
    const ids = data<{ items: { id: string }[] }>(res).items.map((c) => c.id);
    expect(ids).not.toContain(complianceRecordId);
  });

  it("org A's department never appears in org B's department list", async () => {
    const res = await api(app).get("/api/v1/organisation/departments").set("Authorization", `Bearer ${orgB.adminToken}`);
    const ids = data<{ id: string }[]>(res).map((d) => d.id);
    expect(ids).not.toContain(departmentId);
  });

  it("org B's own dashboard summary reflects only its own (empty) data, never org A's", async () => {
    const res = await api(app).get("/api/v1/organisation/dashboard/summary").set("Authorization", `Bearer ${orgB.adminToken}`);
    expect(res.status).toBe(200);
    const summary = data<{ employees?: { total: number } }>(res);
    expect(summary.employees?.total).toBe(0);
  });

  it("a platform token is rejected by the organisation-scope check itself, on a route with no permission gate to hide behind", async () => {
    // /organisation/employees would 403 MISSING_PERMISSION first (a
    // platform user's JWT simply has none of the organisation permission
    // keys) — that's correct too, but it tests PermissionsGuard, not the
    // scope check. The dashboard has no @RequirePermissions at all, so a
    // platform token reaches CurrentOrganisationId's own rejection.
    const platformToken = await platformLogin(app);
    const res = await api(app).get("/api/v1/organisation/dashboard/summary").set("Authorization", `Bearer ${platformToken}`);
    expect(res.status).toBe(403);
    expect(errorCode(res)).toBe("ORGANISATION_ONLY");
  });

  it("a platform token also can't reach an organisation route THROUGH the permission gate (belt and suspenders)", async () => {
    const platformToken = await platformLogin(app);
    const res = await api(app).get("/api/v1/organisation/employees").set("Authorization", `Bearer ${platformToken}`);
    expect(res.status).toBe(403);
    expect(errorCode(res)).toBe("MISSING_PERMISSION");
  });
});
