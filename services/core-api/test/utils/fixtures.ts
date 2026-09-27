import type { INestApplication } from "@nestjs/common";
import { api, data, unique } from "./e2e-app";

const PLATFORM_ADMIN = { email: "admin@sapoktech.com", password: "ChangeMe123!" };
const DEFAULT_PASSWORD = "Password123!";

export async function platformLogin(app: INestApplication): Promise<string> {
  const res = await api(app).post("/api/v1/auth/platform/login").send(PLATFORM_ADMIN);
  if (res.status !== 200) throw new Error(`platform login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return data<{ accessToken: string }>(res).accessToken;
}

/**
 * A fully set-up, fully-entitled organisation: created, admin provisioned,
 * activated, and put on the Enterprise plan (every module) so tests that
 * aren't specifically about module entitlement (Phase 11) don't need to
 * think about it. Returns the SUPER_ADMIN's own access token.
 */
export async function createActiveOrganisation(app: INestApplication, platformToken: string, namePrefix: string) {
  const slug = unique(namePrefix);
  const orgRes = await api(app)
    .post("/api/v1/organisations")
    .set("Authorization", `Bearer ${platformToken}`)
    .send({ name: `${namePrefix} Co`, slug, contactEmail: `${slug}@example.com` });
  if (orgRes.status !== 201) throw new Error(`create organisation failed: ${orgRes.status} ${JSON.stringify(orgRes.body)}`);
  const organisationId = data<{ id: string }>(orgRes).id;

  const adminEmail = `owner-${slug}@example.com`;
  const adminRes = await api(app)
    .post(`/api/v1/organisations/${organisationId}/admin`)
    .set("Authorization", `Bearer ${platformToken}`)
    .send({ email: adminEmail, password: DEFAULT_PASSWORD, firstName: "Org", lastName: "Owner" });
  if (adminRes.status !== 201) throw new Error(`provision admin failed: ${adminRes.status} ${JSON.stringify(adminRes.body)}`);

  await api(app).patch(`/api/v1/organisations/${organisationId}/status`).set("Authorization", `Bearer ${platformToken}`).send({ status: "ACTIVE" });

  const plansRes = await api(app).get("/api/v1/billing/plans").set("Authorization", `Bearer ${platformToken}`);
  const enterprise = data<{ id: string; name: string }[]>(plansRes).find((p) => p.name === "Enterprise");
  if (!enterprise) throw new Error("Enterprise plan not found — has prisma/seed.ts been run?");
  await api(app)
    .post(`/api/v1/organisations/${organisationId}/subscription`)
    .set("Authorization", `Bearer ${platformToken}`)
    .send({ planId: enterprise.id, status: "ACTIVE" });

  const loginRes = await api(app).post("/api/v1/auth/organisation/login").send({ organisationSlug: slug, email: adminEmail, password: DEFAULT_PASSWORD });
  if (loginRes.status !== 200) throw new Error(`org admin login failed: ${loginRes.status} ${JSON.stringify(loginRes.body)}`);

  return { organisationId, slug, adminEmail, adminToken: data<{ accessToken: string }>(loginRes).accessToken };
}

/** A role with exactly the given permissions (often none), for RBAC negative-path testing. */
export async function createOrgRoleWithPermissions(app: INestApplication, adminToken: string, permissionKeys: string[]): Promise<string> {
  const res = await api(app)
    .post("/api/v1/organisation/roles")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ name: `TEST_ROLE_${unique("").replace(/[^0-9]/g, "")}`, permissionKeys });
  if (res.status !== 201) throw new Error(`create role failed: ${res.status} ${JSON.stringify(res.body)}`);
  return data<{ id: string }>(res).id;
}

export async function createOrgUserWithRole(app: INestApplication, adminToken: string, slug: string, roleId: string) {
  const email = `${unique("user")}@example.com`;
  const res = await api(app)
    .post("/api/v1/organisation/users")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ email, firstName: "Test", lastName: "User", password: DEFAULT_PASSWORD, roleIds: [roleId] });
  if (res.status !== 201) throw new Error(`create org user failed: ${res.status} ${JSON.stringify(res.body)}`);

  const loginRes = await api(app).post("/api/v1/auth/organisation/login").send({ organisationSlug: slug, email, password: DEFAULT_PASSWORD });
  if (loginRes.status !== 200) throw new Error(`org user login failed: ${loginRes.status} ${JSON.stringify(loginRes.body)}`);
  return { email, token: data<{ accessToken: string }>(loginRes).accessToken };
}
