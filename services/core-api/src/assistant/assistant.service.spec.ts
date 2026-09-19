import type { AccessTokenPayload } from "@nexora/types";
import { NotFoundApiException } from "../common/exceptions/api.exception";
import { AssistantService } from "./assistant.service";

/**
 * Regression tests for two real authorization bugs found by probing (see
 * docs/phase-8-nexora-knowledge.md, "Security review"): a user holding only
 * `assistant:use` could list and read the content of a permission-gated
 * knowledge entry, and a caller-supplied id was interpolated into an
 * outbound SAPOK AI URL, so `..%2Fdocuments%2F<id>` reached a different
 * endpoint with the organisation's own API key. No database, no network:
 * Prisma and `fetch` are stubbed, and the tests assert on what would have
 * been sent.
 */

const ID = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
const OTHER_ID = "9b2d5f52-6c1e-4a3e-8f7a-0a1b2c3d4e5f";

function makeService() {
  const prisma = {
    // Already provisioned, so ensureProvisioned returns the cached key
    // without touching the network — every fetch below is the call under test.
    organisation: { findUniqueOrThrow: jest.fn().mockResolvedValue({ aiProviderDeveloperId: "dev-1", aiProviderApiKey: "sapokai_live_test" }) },
    organisationPermission: { findUnique: jest.fn() },
  };
  const config = { get: jest.fn().mockReturnValue("http://sapok-ai.test"), getOrThrow: jest.fn() };
  return new AssistantService(prisma as never, config as never);
}

function actor(permissions: string[]): AccessTokenPayload {
  return { sub: "user-1", scope: "organisation", organisationId: "org-1", permissions, tokenType: "access" };
}

function stubFetch(body: unknown, status = 200) {
  return jest.spyOn(global, "fetch").mockImplementation(async () => new Response(JSON.stringify(body), { status }));
}

const entry = (overrides: Partial<{ id: string; requiredPermission: string | null }> = {}) => ({
  id: ID,
  title: "Payroll policy",
  status: "READY",
  chunkCount: 1,
  requiredPermission: "payroll:read" as string | null,
  createdAt: "2026-09-19T00:00:00Z",
  updatedAt: "2026-09-19T00:00:00Z",
  ...overrides,
});

afterEach(() => jest.restoreAllMocks());

describe("AssistantService.getKnowledgeEntry — a gated entry's content requires its own permission", () => {
  it("returns an ungated entry to anyone with assistant access", async () => {
    stubFetch({ ...entry({ requiredPermission: null }), chunks: [{ content: "open" }] });
    await expect(makeService().getKnowledgeEntry("org-1", actor(["assistant:use"]), ID)).resolves.toMatchObject({ id: ID });
  });

  it("returns a gated entry to a caller who holds the required permission", async () => {
    stubFetch({ ...entry(), chunks: [{ content: "secret" }] });
    await expect(makeService().getKnowledgeEntry("org-1", actor(["assistant:use", "payroll:read"]), ID)).resolves.toMatchObject({ id: ID });
  });

  it("answers 404 — not 403 — to a caller who lacks it, so existence isn't confirmed", async () => {
    stubFetch({ ...entry(), chunks: [{ content: "secret" }] });
    const attempt = makeService().getKnowledgeEntry("org-1", actor(["assistant:use"]), ID);
    await expect(attempt).rejects.toBeInstanceOf(NotFoundApiException);
    await expect(attempt).rejects.toMatchObject({ code: "KNOWLEDGE_ENTRY_NOT_FOUND" });
  });

  it("does not let managing knowledge stand in for reading it", async () => {
    stubFetch({ ...entry(), chunks: [{ content: "secret" }] });
    await expect(makeService().getKnowledgeEntry("org-1", actor(["assistant:use", "assistant:manage_knowledge"]), ID)).rejects.toBeInstanceOf(NotFoundApiException);
  });
});

describe("AssistantService.listKnowledgeEntries — a gated entry's existence is gated too", () => {
  const entries = [entry({ id: ID, requiredPermission: "payroll:read" }), entry({ id: OTHER_ID, requiredPermission: null })];

  it("hides entries the caller lacks the permission for", async () => {
    stubFetch(entries);
    const visible = await makeService().listKnowledgeEntries("org-1", actor(["assistant:use"]));
    expect(visible.map((e) => e.id)).toEqual([OTHER_ID]);
  });

  it("shows a gated entry to a caller who holds its permission", async () => {
    stubFetch(entries);
    const visible = await makeService().listKnowledgeEntries("org-1", actor(["assistant:use", "payroll:read"]));
    expect(visible.map((e) => e.id)).toEqual([ID, OTHER_ID]);
  });

  it("shows every entry's metadata to a knowledge manager so they can manage it", async () => {
    stubFetch(entries);
    const visible = await makeService().listKnowledgeEntries("org-1", actor(["assistant:use", "assistant:manage_knowledge"]));
    expect(visible.map((e) => e.id)).toEqual([ID, OTHER_ID]);
  });
});

describe("AssistantService — ids are validated before they can shape an outbound URL", () => {
  // Express decodes %2F in route params, so these arrive as real path segments.
  const traversal = [`../documents/${ID}`, "..", "../../internal/tools/execute", `${ID}/../../documents`, "not-a-uuid", ""];

  it.each(traversal)("rejects %j on every route that interpolates an id, without making any request", async (bad) => {
    const fetchSpy = stubFetch({});
    const service = makeService();
    const calls = [
      service.getConversation("org-1", bad),
      service.postMessage("org-1", bad, "hi"),
      service.submitMessageFeedback("org-1", bad, ID, "UP", undefined),
      service.submitMessageFeedback("org-1", ID, bad, "UP", undefined),
      service.getKnowledgeEntry("org-1", actor(["assistant:use", "payroll:read"]), bad),
      service.deleteKnowledgeEntry("org-1", bad),
    ];
    for (const call of calls) await expect(call).rejects.toBeInstanceOf(NotFoundApiException);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("still sends a well-formed id through unchanged", async () => {
    const fetchSpy = stubFetch({ id: ID, title: null, createdAt: "x", updatedAt: "x", messages: [] });
    await makeService().getConversation("org-1", ID);
    expect(fetchSpy).toHaveBeenCalledWith(`http://sapok-ai.test/api/v1/conversations/${ID}`, expect.anything());
  });
});
