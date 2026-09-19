import { z } from "zod";

export const createAssistantConversationSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
});
export type CreateAssistantConversationInput = z.infer<typeof createAssistantConversationSchema>;

export const postAssistantMessageSchema = z.object({
  content: z.string().trim().min(1).max(10_000),
});
export type PostAssistantMessageInput = z.infer<typeof postAssistantMessageSchema>;

export const searchAssistantKnowledgeSchema = z.object({
  query: z.string().trim().min(1).max(2_000),
  limit: z.coerce.number().int().min(1).max(20).optional(),
});
export type SearchAssistantKnowledgeInput = z.infer<typeof searchAssistantKnowledgeSchema>;

export const proposeAssistantActionSchema = z.object({
  toolName: z.string().trim().min(1),
  // Untyped at this boundary, same as SAPOK AI's own tool/action arguments
  // — each tool validates its own expected shape inside execute().
  arguments: z.record(z.unknown()).default({}),
  reasoning: z.string().trim().max(2_000).optional(),
});
export type ProposeAssistantActionInput = z.infer<typeof proposeAssistantActionSchema>;

export const createAssistantKnowledgeEntrySchema = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(200_000),
  // Validated against the org's real permission catalog server-side
  // (AssistantService.createKnowledgeEntry) — a typo here would otherwise
  // silently create a permanently-unreachable-gated entry.
  requiredPermission: z.string().trim().min(1).optional(),
});
export type CreateAssistantKnowledgeEntryInput = z.infer<typeof createAssistantKnowledgeEntrySchema>;

export const submitAssistantMessageFeedbackSchema = z.object({
  rating: z.enum(["UP", "DOWN"]),
  comment: z.string().trim().max(2_000).optional(),
});
export type SubmitAssistantMessageFeedbackInput = z.infer<typeof submitAssistantMessageFeedbackSchema>;
