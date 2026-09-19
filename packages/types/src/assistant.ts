/** Phase 7 — mirrors SAPOK AI's own conversation/message shapes exactly
 * (see ../../../sapok-ai/api/app/routers/conversations.py), since
 * AssistantService proxies straight through rather than reshaping. */

export interface AssistantConversation {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

export type AssistantMessageRole = "user" | "assistant" | "system";

export interface AssistantMessage {
  id: string;
  conversationId: string;
  role: AssistantMessageRole;
  content: string;
  provider: string | null;
  createdAt: string;
}

export interface AssistantConversationWithMessages extends AssistantConversation {
  messages: AssistantMessage[];
}

export interface PostAssistantMessageResult {
  userMessage: AssistantMessage;
  assistantMessage: AssistantMessage;
}

/**
 * The result of a permission-aware knowledge search — SAPOK AI Phase 9's
 * internal endpoint, called with the caller's own JWT permissions, never
 * SAPOK AI's unrestricted developer-scoped search. Empty until Phase 8
 * (NEXORA Knowledge) actually ingests organisation documents into SAPOK AI.
 */
export interface AssistantKnowledgeResult {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  /** Present on the internal permission-aware search (Phase 8+) — shows
   * why a chunk was eligible: null means open to anyone with assistant
   * access, a key means the caller's own permissions included it. */
  requiredPermission?: string | null;
  chunkIndex: number;
  content: string;
  distance: number;
}

/**
 * Phase 8 — a knowledge base entry: text content an organisation wants the
 * assistant to be able to retrieve, ingested (chunked + embedded) into
 * SAPOK AI. Deliberately separate from Phase 5's `OrganisationDocument`
 * (employee file attachments — ID scans, contracts, a `fileUrl` with no
 * extracted text) — those aren't the same concept as an article meant to
 * inform the assistant, and NEXORA has no file-fetching/text-extraction
 * capability that would let a fileUrl be ingested meaningfully anyway.
 */
export interface AssistantKnowledgeEntry {
  id: string;
  title: string;
  status: string;
  chunkCount: number;
  /** Null means visible to any org user with `assistant:use`; set to gate
   * this entry to only the org's own permission holders (e.g. "payroll:read"
   * for a payroll policy) — checked against the caller's real JWT
   * permissions on every search, never trusted from the client. */
  requiredPermission: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssistantKnowledgeChunk {
  id: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  createdAt: string;
}

export interface AssistantKnowledgeEntryWithChunks extends AssistantKnowledgeEntry {
  chunks: AssistantKnowledgeChunk[];
}

/**
 * Phase 9 — a real NEXORA business action, proposed and approved by real
 * organisation users through the same PermissionsGuard/RequirePermissions
 * every other endpoint uses (each registered tool declares the exact
 * permission it needs — see AssistantActionToolDescriptor). Lives in
 * NEXORA's own database, NOT SAPOK AI's action_requests: these are NEXORA
 * business actions gated by NEXORA's own RBAC, which SAPOK AI has no way
 * to enforce. State machine mirrors SAPOK AI's own action-approval design
 * (a proven pattern) without reusing its rows:
 * PENDING_APPROVAL -> APPROVED -> EXECUTED (or -> FAILED), or
 * PENDING_APPROVAL -> REJECTED. Approval requires a DIFFERENT user than
 * the proposer ("maker-checker") — enforced server-side, not just in the UI.
 */
export type AssistantActionStatus = "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "EXECUTED" | "FAILED";

export interface AssistantActionRequest {
  id: string;
  toolName: string;
  arguments: Record<string, unknown>;
  reasoning: string | null;
  status: AssistantActionStatus;
  result: Record<string, unknown> | null;
  proposedById: string;
  decidedById: string | null;
  createdAt: string;
  decidedAt: string | null;
  executedAt: string | null;
}

export interface AssistantActionToolDescriptor {
  name: string;
  description: string;
  /** The exact permission propose/approve/reject/execute all check against
   * the caller's own JWT permissions — the literal enforcement of "an AI
   * agent should never do anything the user's own permissions wouldn't
   * already allow." */
  requiredPermission: string;
}

/**
 * Phase 10 — human feedback on an assistant reply, proxied to SAPOK AI's own
 * message_feedback (one row per message, upserted: changing your mind updates
 * it rather than adding a second rating).
 */
export type AssistantFeedbackRating = "UP" | "DOWN";

export interface AssistantMessageFeedback {
  id: string;
  messageId: string;
  rating: AssistantFeedbackRating;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * The calling organisation's OWN feedback trend, per provider — SAPOK AI's
 * developer-scoped summary (one SAPOK AI developer account per organisation),
 * never its platform-wide admin aggregate.
 */
export interface AssistantFeedbackSummary {
  byProvider: { provider: string | null; upCount: number; downCount: number; totalRated: number }[];
}
