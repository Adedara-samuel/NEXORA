import { Body, Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import {
  createAssistantConversationSchema,
  createAssistantKnowledgeEntrySchema,
  postAssistantMessageSchema,
  proposeAssistantActionSchema,
  searchAssistantKnowledgeSchema,
  submitAssistantMessageFeedbackSchema,
  type CreateAssistantConversationInput,
  type CreateAssistantKnowledgeEntryInput,
  type PostAssistantMessageInput,
  type ProposeAssistantActionInput,
  type SearchAssistantKnowledgeInput,
  type SubmitAssistantMessageFeedbackInput,
} from "@nexora/validation";
import type { AccessTokenPayload } from "@nexora/types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { CurrentOrganisationId } from "../common/decorators/current-organisation-id.decorator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { AssistantActionsService } from "./assistant-actions.service";
import { AssistantService } from "./assistant.service";

@ApiTags("assistant")
@UseGuards(PermissionsGuard)
@RequirePermissions("assistant:use")
@Controller("organisation/assistant")
export class AssistantController {
  constructor(
    private readonly assistant: AssistantService,
    private readonly assistantActions: AssistantActionsService,
  ) {}

  @Post("conversations")
  createConversation(@CurrentOrganisationId() organisationId: string, @Body(new ZodValidationPipe(createAssistantConversationSchema)) body: CreateAssistantConversationInput) {
    return this.assistant.createConversation(organisationId, body.title);
  }

  @Get("conversations")
  listConversations(@CurrentOrganisationId() organisationId: string) {
    return this.assistant.listConversations(organisationId);
  }

  @Get("conversations/:id")
  getConversation(@CurrentOrganisationId() organisationId: string, @Param("id") id: string) {
    return this.assistant.getConversation(organisationId, id);
  }

  @Post("conversations/:id/messages")
  postMessage(
    @CurrentOrganisationId() organisationId: string,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(postAssistantMessageSchema)) body: PostAssistantMessageInput,
  ) {
    return this.assistant.postMessage(organisationId, id, body.content);
  }

  @Post("conversations/:id/messages/:messageId/feedback")
  submitMessageFeedback(
    @CurrentOrganisationId() organisationId: string,
    @Param("id") id: string,
    @Param("messageId") messageId: string,
    @Body(new ZodValidationPipe(submitAssistantMessageFeedbackSchema)) body: SubmitAssistantMessageFeedbackInput,
  ) {
    return this.assistant.submitMessageFeedback(organisationId, id, messageId, body.rating, body.comment);
  }

  @Get("feedback-summary")
  getFeedbackSummary(@CurrentOrganisationId() organisationId: string) {
    return this.assistant.getFeedbackSummary(organisationId);
  }

  @Post("knowledge/search")
  searchKnowledge(
    @CurrentOrganisationId() organisationId: string,
    @CurrentUser() actor: AccessTokenPayload,
    @Body(new ZodValidationPipe(searchAssistantKnowledgeSchema)) body: SearchAssistantKnowledgeInput,
  ) {
    return this.assistant.searchKnowledge(organisationId, actor, body.query, body.limit);
  }

  @Get("knowledge")
  listKnowledgeEntries(@CurrentOrganisationId() organisationId: string, @CurrentUser() actor: AccessTokenPayload) {
    return this.assistant.listKnowledgeEntries(organisationId, actor);
  }

  @Get("knowledge/:id")
  getKnowledgeEntry(@CurrentOrganisationId() organisationId: string, @CurrentUser() actor: AccessTokenPayload, @Param("id") id: string) {
    return this.assistant.getKnowledgeEntry(organisationId, actor, id);
  }

  // Overrides the controller-level `assistant:use` requirement — adding to
  // (and removing from) the knowledge base is a more sensitive, admin-like
  // action than chatting or searching it, same "one permission per real
  // capability" reasoning as payroll:read vs payroll:manage_settings.
  @RequirePermissions("assistant:manage_knowledge")
  @Post("knowledge")
  createKnowledgeEntry(@CurrentOrganisationId() organisationId: string, @Body(new ZodValidationPipe(createAssistantKnowledgeEntrySchema)) body: CreateAssistantKnowledgeEntryInput) {
    return this.assistant.createKnowledgeEntry(organisationId, body.title, body.content, body.requiredPermission);
  }

  // 200 + { deleted: true }, not a bare 204 — same convention as every
  // other delete in this API (see organisation-rbac.controller.ts's
  // deleteRole), even though SAPOK AI's own DELETE /documents/:id itself
  // returns 204 with no body.
  @RequirePermissions("assistant:manage_knowledge")
  @Delete("knowledge/:id")
  async deleteKnowledgeEntry(@CurrentOrganisationId() organisationId: string, @Param("id") id: string) {
    await this.assistant.deleteKnowledgeEntry(organisationId, id);
    return { deleted: true };
  }

  // ---------------------------------------------------------------------
  // Phase 9 — AI Actions. Every route below still requires the controller
  // -level `assistant:use` just to reach it, but propose/approve/reject/
  // execute ALSO check the specific tool's own `requiredPermission`
  // against the caller's real JWT permissions inside AssistantActionsService
  // — a static @RequirePermissions(...) can't express "whichever permission
  // this particular tool needs," since that depends on the request body.
  // ---------------------------------------------------------------------

  @Get("actions/tools")
  listActionTools() {
    return this.assistantActions.listAvailableTools();
  }

  @Post("actions")
  proposeAction(
    @CurrentOrganisationId() organisationId: string,
    @CurrentUser() actor: AccessTokenPayload,
    @Body(new ZodValidationPipe(proposeAssistantActionSchema)) body: ProposeAssistantActionInput,
  ) {
    return this.assistantActions.propose(organisationId, actor, body.toolName, body.arguments, body.reasoning);
  }

  @Get("actions")
  listActions(@CurrentOrganisationId() organisationId: string) {
    return this.assistantActions.list(organisationId);
  }

  @Get("actions/:id")
  getAction(@CurrentOrganisationId() organisationId: string, @Param("id") id: string) {
    return this.assistantActions.getById(organisationId, id);
  }

  @Post("actions/:id/approve")
  approveAction(@CurrentOrganisationId() organisationId: string, @CurrentUser() actor: AccessTokenPayload, @Param("id") id: string) {
    return this.assistantActions.approve(organisationId, actor, id);
  }

  @Post("actions/:id/reject")
  rejectAction(@CurrentOrganisationId() organisationId: string, @CurrentUser() actor: AccessTokenPayload, @Param("id") id: string) {
    return this.assistantActions.reject(organisationId, actor, id);
  }

  @Post("actions/:id/execute")
  executeAction(@CurrentOrganisationId() organisationId: string, @CurrentUser() actor: AccessTokenPayload, @Param("id") id: string) {
    return this.assistantActions.execute(organisationId, actor, id);
  }
}
