import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AccessTokenPayload } from "@nexora/types";
import type {
  AssistantConversation,
  AssistantConversationWithMessages,
  AssistantFeedbackSummary,
  AssistantKnowledgeEntry,
  AssistantKnowledgeEntryWithChunks,
  AssistantKnowledgeResult,
  AssistantMessageFeedback,
  PostAssistantMessageResult,
} from "@nexora/types";
import { PrismaService } from "../prisma/prisma.service";
import { NotFoundApiException, ValidationApiException } from "../common/exceptions/api.exception";

const CONVERSATION_NOT_FOUND = { code: "CONVERSATION_NOT_FOUND", message: "Conversation not found" } as const;
const MESSAGE_NOT_FOUND = { code: "MESSAGE_NOT_FOUND", message: "Message not found" } as const;
const KNOWLEDGE_ENTRY_NOT_FOUND = { code: "KNOWLEDGE_ENTRY_NOT_FOUND", message: "Knowledge entry not found" } as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Talks to SAPOK AI (a separate standalone service, see ../sapok-ai) — the
 * "AI gateway" half of Phase 7. One SAPOK AI Developer account per
 * Organisation (ensureProvisioned, same shape as PayoutsService's SAPOK
 * Pay Merchant provisioning): an org's conversations and knowledge base
 * can never mix with another's, because they live under entirely separate
 * SAPOK AI accounts, not just separate rows filtered by a shared tenant id.
 *
 * Design constraint carried from this repo's own README: knowledge search
 * always goes through SAPOK AI's *permission-aware* internal endpoint
 * (POST /internal/knowledge/search, service-authenticated), asserting the
 * calling NEXORA user's own JWT permissions — never the org's unrestricted
 * developer-scoped search. An AI agent acting on a user's behalf should
 * never see anything that user's own permissions wouldn't already allow.
 */
@Injectable()
export class AssistantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Idempotent in the same limited sense as SAPOK Pay's merchant
   * provisioning: the developer account and API key are cached on the
   * Organisation row after the first call. SAPOK AI's signup is NOT
   * idempotent by external reference (unlike SAPOK Pay's), so if the cache
   * were ever lost after a successful signup, there is no way to recover
   * the original API key — see the EMAIL_TAKEN branch below.
   */
  async ensureProvisioned(organisationId: string): Promise<{ developerId: string; apiKey: string }> {
    const organisation = await this.prisma.organisation.findUniqueOrThrow({ where: { id: organisationId } });
    if (organisation.aiProviderDeveloperId && organisation.aiProviderApiKey) {
      return { developerId: organisation.aiProviderDeveloperId, apiKey: organisation.aiProviderApiKey };
    }

    const signupResponse = await fetch(`${this.sapokAiUrl()}/api/v1/auth/developer/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `org-${organisation.id}@nexora.internal`,
        // Randomly generated and immediately discarded — this account is
        // only ever used via its API key, never a real SAPOK AI login,
        // same reasoning as the SAPOK Pay merchant's password.
        password: randomUUID() + randomUUID(),
        organisation_name: organisation.name,
      }),
    });
    const signupBody = (await signupResponse.json()) as { access_token?: string; error?: { code: string; message: string } };

    if (signupResponse.status === 409 || signupBody.error?.code === "EMAIL_TAKEN") {
      throw new ValidationApiException(
        "This organisation already has a SAPOK AI developer account, but NEXORA doesn't have its API key on file — SAPOK AI only shows a raw key once, at creation. Contact SAPOK AI support to resolve.",
      );
    }
    if (!signupResponse.ok || !signupBody.access_token) {
      throw new ValidationApiException(`Could not provision a SAPOK AI developer account for this organisation: ${signupBody.error?.message ?? "unknown error"}`);
    }

    const meResponse = await fetch(`${this.sapokAiUrl()}/api/v1/developers/me`, {
      headers: { Authorization: `Bearer ${signupBody.access_token}` },
    });
    const me = (await meResponse.json()) as { id: string };

    const keyResponse = await fetch(`${this.sapokAiUrl()}/api/v1/api-keys`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${signupBody.access_token}` },
      body: JSON.stringify({ name: "NEXORA Core API" }),
    });
    const key = (await keyResponse.json()) as { rawKey?: string; error?: { message: string } };
    if (!keyResponse.ok || !key.rawKey) {
      throw new ValidationApiException(`SAPOK AI developer account created, but issuing its API key failed: ${key.error?.message ?? "unknown error"}`);
    }

    await this.prisma.organisation.update({
      where: { id: organisationId },
      data: { aiProviderDeveloperId: me.id, aiProviderApiKey: key.rawKey },
    });

    return { developerId: me.id, apiKey: key.rawKey };
  }

  async createConversation(organisationId: string, title: string | undefined): Promise<AssistantConversation> {
    const { apiKey } = await this.ensureProvisioned(organisationId);
    return this.sapokAiFetch(apiKey, "POST", "/api/v1/conversations", { title });
  }

  async listConversations(organisationId: string): Promise<AssistantConversation[]> {
    const { apiKey } = await this.ensureProvisioned(organisationId);
    return this.sapokAiFetch(apiKey, "GET", "/api/v1/conversations");
  }

  async getConversation(organisationId: string, conversationId: string): Promise<AssistantConversationWithMessages> {
    const { apiKey } = await this.ensureProvisioned(organisationId);
    return this.sapokAiFetch(apiKey, "GET", `/api/v1/conversations/${this.safeId(conversationId, CONVERSATION_NOT_FOUND)}`, undefined, {
      code: "CONVERSATION_NOT_FOUND",
      message: "Conversation not found",
    });
  }

  async postMessage(organisationId: string, conversationId: string, content: string): Promise<PostAssistantMessageResult> {
    const { apiKey } = await this.ensureProvisioned(organisationId);
    return this.sapokAiFetch(apiKey, "POST", `/api/v1/conversations/${this.safeId(conversationId, CONVERSATION_NOT_FOUND)}/messages`, { content }, {
      code: "CONVERSATION_NOT_FOUND",
      message: "Conversation not found",
    });
  }

  /**
   * Phase 10 — human feedback on an assistant reply. Proxied to SAPOK AI's
   * own message_feedback (upserted there: rating the same reply twice
   * updates the one row). SAPOK AI enforces that only an assistant-role
   * message can be rated and that the conversation belongs to this
   * organisation's developer account — a 404 either way.
   */
  async submitMessageFeedback(
    organisationId: string,
    conversationId: string,
    messageId: string,
    rating: "UP" | "DOWN",
    comment: string | undefined,
  ): Promise<AssistantMessageFeedback> {
    const { apiKey } = await this.ensureProvisioned(organisationId);
    return this.sapokAiFetch(apiKey, "POST", `/api/v1/conversations/${this.safeId(conversationId, CONVERSATION_NOT_FOUND)}/messages/${this.safeId(messageId, MESSAGE_NOT_FOUND)}/feedback`, { rating, comment }, {
      code: "MESSAGE_NOT_FOUND",
      message: "Message not found",
    });
  }

  /**
   * This organisation's own feedback trend — SAPOK AI's developer-scoped
   * summary, never its platform-wide admin one.
   */
  async getFeedbackSummary(organisationId: string): Promise<AssistantFeedbackSummary> {
    const { apiKey } = await this.ensureProvisioned(organisationId);
    return this.sapokAiFetch(apiKey, "GET", "/api/v1/conversations/feedback-summary");
  }

  /**
   * Phase 8 — ingests real text content into SAPOK AI's knowledge base
   * (chunked + embedded there, not duplicated in NEXORA's own database —
   * same "proxy, don't duplicate" shape as PayoutsService's wallet calls).
   * Deliberately separate from Phase 5's employee Document attachments
   * (`fileUrl`, no extracted text) — see AssistantKnowledgeEntry's own
   * docstring in @nexora/types for why those aren't the same concept.
   *
   * `requiredPermission`, when given, is validated against this org's real
   * permission catalog first — an unrecognised key would otherwise create
   * an entry no role could ever be granted access to, silently.
   */
  async createKnowledgeEntry(organisationId: string, title: string, content: string, requiredPermission: string | undefined): Promise<AssistantKnowledgeEntry> {
    if (requiredPermission) {
      const permission = await this.prisma.organisationPermission.findUnique({ where: { key: requiredPermission } });
      if (!permission) throw new ValidationApiException(`Unknown permission key: ${requiredPermission}`);
    }
    const { apiKey } = await this.ensureProvisioned(organisationId);
    return this.sapokAiFetch(apiKey, "POST", "/api/v1/documents", { title, content, required_permission: requiredPermission ?? null });
  }

  /**
   * A permission-gated entry's *existence* is itself gated: a caller who lacks
   * its requiredPermission never sees it listed, the same as search. Only
   * `assistant:manage_knowledge` holders see every entry — and only its
   * metadata (title, status, gate); the list carries no content, and reading
   * content still requires holding the entry's own permission (see
   * getKnowledgeEntry).
   */
  async listKnowledgeEntries(organisationId: string, actor: AccessTokenPayload): Promise<AssistantKnowledgeEntry[]> {
    const { apiKey } = await this.ensureProvisioned(organisationId);
    const entries = await this.sapokAiFetch<AssistantKnowledgeEntry[]>(apiKey, "GET", "/api/v1/documents");
    if ((actor.permissions ?? []).includes("assistant:manage_knowledge")) return entries;
    return entries.filter((entry) => this.canAccessEntry(actor, entry));
  }

  /**
   * Returns the entry's full content, so unlike the list this requires the
   * entry's own permission even for a knowledge manager — managing what the
   * assistant knows doesn't imply being allowed to read payroll policy. A
   * caller who fails the check gets the same 404 as a nonexistent id, never
   * a 403 that would confirm the entry exists.
   */
  async getKnowledgeEntry(organisationId: string, actor: AccessTokenPayload, id: string): Promise<AssistantKnowledgeEntryWithChunks> {
    const { apiKey } = await this.ensureProvisioned(organisationId);
    const entry = await this.sapokAiFetch<AssistantKnowledgeEntryWithChunks>(apiKey, "GET", `/api/v1/documents/${this.safeId(id, KNOWLEDGE_ENTRY_NOT_FOUND)}`, undefined, KNOWLEDGE_ENTRY_NOT_FOUND);
    if (!this.canAccessEntry(actor, entry)) throw new NotFoundApiException(KNOWLEDGE_ENTRY_NOT_FOUND.message, KNOWLEDGE_ENTRY_NOT_FOUND.code);
    return entry;
  }

  async deleteKnowledgeEntry(organisationId: string, id: string): Promise<void> {
    const { apiKey } = await this.ensureProvisioned(organisationId);
    await this.sapokAiFetch(apiKey, "DELETE", `/api/v1/documents/${this.safeId(id, KNOWLEDGE_ENTRY_NOT_FOUND)}`, undefined, KNOWLEDGE_ENTRY_NOT_FOUND);
  }

  /**
   * The permission-aware path — see this class's own docstring. `actor`'s
   * `permissions` (flattened from their NEXORA role, embedded in their own
   * JWT) is what's asserted to SAPOK AI, never a blanket "everything this
   * org owns." Has real knowledge entries to search now that
   * `createKnowledgeEntry` (Phase 8) exists.
   */
  async searchKnowledge(organisationId: string, actor: AccessTokenPayload, query: string, limit?: number): Promise<AssistantKnowledgeResult[]> {
    const { developerId } = await this.ensureProvisioned(organisationId);
    const response = await fetch(`${this.sapokAiUrl()}/api/v1/internal/knowledge/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Service-Auth": this.config.getOrThrow<string>("SAPOK_AI_SERVICE_SECRET"),
      },
      body: JSON.stringify({ developer_id: developerId, query, permissions: actor.permissions ?? [], limit }),
    });
    const results = (await response.json()) as AssistantKnowledgeResult[] | { error?: { message: string } };
    if (!response.ok) {
      const error = results as { error?: { message: string } };
      throw new ValidationApiException(`SAPOK AI knowledge search failed: ${error.error?.message ?? "unknown error"}`);
    }
    return results as AssistantKnowledgeResult[];
  }

  /**
   * Every id below is interpolated into an outbound SAPOK AI URL, so it must
   * be a bare UUID — never a caller-supplied string. Express decodes %2F in
   * route params, so an unchecked id such as `..%2Fdocuments%2F<id>` becomes
   * a real path traversal onto a *different* SAPOK AI endpoint, reached with
   * this organisation's own API key and none of NEXORA's permission checks
   * (found by probing: it returned a permission-gated document's content to a
   * user who lacked the permission). Validated where the URL is built, not
   * only in the controller, so no future caller can skip it.
   */
  private safeId(id: string, notFound: { code: string; message: string }): string {
    if (!UUID_PATTERN.test(id)) throw new NotFoundApiException(notFound.message, notFound.code);
    return id;
  }

  /** Whether `actor` holds the permission an entry is gated behind (null = open). */
  private canAccessEntry(actor: AccessTokenPayload, entry: { requiredPermission: string | null }): boolean {
    return entry.requiredPermission === null || (actor.permissions ?? []).includes(entry.requiredPermission);
  }

  private async sapokAiFetch<T>(
    apiKey: string,
    method: string,
    path: string,
    body?: unknown,
    notFound?: { code: string; message: string },
  ): Promise<T> {
    const response = await fetch(`${this.sapokAiUrl()}${path}`, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (response.status === 404 && notFound) {
      throw new NotFoundApiException(notFound.message, notFound.code);
    }
    // DELETE (204) and any other empty-body success response has nothing
    // for response.json() to parse — parsing it anyway throws.
    if (response.status === 204) {
      return undefined as T;
    }
    const parsed = await response.json();
    if (!response.ok) {
      const error = parsed as { error?: { message: string } };
      throw new ValidationApiException(`SAPOK AI request failed: ${error.error?.message ?? "unknown error"}`);
    }
    return parsed as T;
  }

  private sapokAiUrl(): string {
    return this.config.get<string>("SAPOK_AI_API_URL", "http://localhost:4200");
  }
}
