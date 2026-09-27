import type { INestApplication } from "@nestjs/common";
import { api, createE2eApp, errorCode } from "./utils/e2e-app";
import { createActiveOrganisation, createOrgRoleWithPermissions, createOrgUserWithRole, platformLogin } from "./utils/fixtures";

/**
 * Proves permission checks are neither too loose (a role without the
 * permission gets through) nor too strict (a role WITH exactly the right
 * permission is still blocked) — against the real PermissionsGuard, for
 * real HTTP requests, on an Enterprise-plan organisation (so Phase 11's
 * module gating is never what's actually blocking these — only RBAC is
 * under test here).
 */
describe("RBAC enforcement (e2e)", () => {
  let app: INestApplication;
  let org: Awaited<ReturnType<typeof createActiveOrganisation>>;
  let noPermissionsToken: string;
  let readOnlyEmployeesToken: string;

  beforeAll(async () => {
    const created = await createE2eApp();
    app = created.app;
    const platformToken = await platformLogin(app);
    org = await createActiveOrganisation(app, platformToken, "rbac");

    const noPermissionsRole = await createOrgRoleWithPermissions(app, org.adminToken, []);
    noPermissionsToken = (await createOrgUserWithRole(app, org.adminToken, org.slug, noPermissionsRole)).token;

    const readOnlyRole = await createOrgRoleWithPermissions(app, org.adminToken, ["employees:read"]);
    readOnlyEmployeesToken = (await createOrgUserWithRole(app, org.adminToken, org.slug, readOnlyRole)).token;
  });

  afterAll(async () => {
    await app.close();
  });

  const deniedCases: { method: "get" | "post"; path: string; body?: object }[] = [
    { method: "get", path: "/api/v1/organisation/employees" },
    { method: "post", path: "/api/v1/organisation/employees", body: { employeeNumber: "X", firstName: "A", lastName: "B", hireDate: "2026-01-01" } },
    { method: "post", path: "/api/v1/organisation/attendance", body: { employeeId: "00000000-0000-0000-0000-000000000000", date: "2026-01-01", status: "PRESENT" } },
    { method: "post", path: "/api/v1/organisation/leave", body: { type: "ANNUAL", startDate: "2026-01-01", endDate: "2026-01-02" } },
    { method: "get", path: "/api/v1/organisation/payroll/tax-settings" },
    { method: "post", path: "/api/v1/organisation/documents", body: { title: "X", fileUrl: "https://example.com/x.pdf" } },
    { method: "post", path: "/api/v1/organisation/compliance", body: { title: "X" } },
    { method: "post", path: "/api/v1/organisation/departments", body: { name: "X" } },
    { method: "post", path: "/api/v1/organisation/users", body: { email: "x@example.com", firstName: "X", lastName: "Y", password: "Password123!" } },
    { method: "post", path: "/api/v1/organisation/roles", body: { name: "SHOULD_NOT_EXIST", permissionKeys: [] } },
    { method: "post", path: "/api/v1/organisation/assistant/knowledge", body: { title: "X", content: "Y" } },
  ];

  it.each(deniedCases)("a role with NO permissions gets 403 MISSING_PERMISSION on $method $path", async ({ method, path, body }) => {
    const res = await api(app)[method](path).set("Authorization", `Bearer ${noPermissionsToken}`).send(body);
    expect(res.status).toBe(403);
    expect(errorCode(res)).toBe("MISSING_PERMISSION");
  });

  it("a role with exactly employees:read CAN list employees", async () => {
    const res = await api(app).get("/api/v1/organisation/employees").set("Authorization", `Bearer ${readOnlyEmployeesToken}`);
    expect(res.status).toBe(200);
  });

  it("a role with exactly employees:read still CANNOT create an employee", async () => {
    const res = await api(app)
      .post("/api/v1/organisation/employees")
      .set("Authorization", `Bearer ${readOnlyEmployeesToken}`)
      .send({ employeeNumber: "X", firstName: "A", lastName: "B", hireDate: "2026-01-01" });
    expect(res.status).toBe(403);
    expect(errorCode(res)).toBe("MISSING_PERMISSION");
  });

  it("the organisation's own SUPER_ADMIN — full permissions — CAN create an employee (positive control, proves the suite isn't vacuous)", async () => {
    const res = await api(app)
      .post("/api/v1/organisation/employees")
      .set("Authorization", `Bearer ${org.adminToken}`)
      .send({ employeeNumber: `E2E-${Date.now()}`, firstName: "Admin", lastName: "Created", hireDate: "2026-01-01" });
    expect(res.status).toBe(201);
  });

  it("no token at all is rejected before any permission check runs", async () => {
    const res = await api(app).get("/api/v1/organisation/employees");
    expect(res.status).toBe(401);
  });
});
