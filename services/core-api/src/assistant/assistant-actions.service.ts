import { Injectable } from "@nestjs/common";
import type { AssistantActionRequest as AssistantActionRequestModel, Prisma } from "@prisma/client";
import type { AccessTokenPayload, AssistantActionRequest, AssistantActionToolDescriptor } from "@nexora/types";
import { PrismaService } from "../prisma/prisma.service";
import { ForbiddenApiException, NotFoundApiException, ValidationApiException } from "../common/exceptions/api.exception";
import { AssistantActionRegistry } from "./assistant-action-registry";
import type { AssistantActionTool } from "./assistant-action-tool";

/**
 * Phase 9 — prepare -> human review -> human approval -> execute, entirely
 * within NEXORA's own database and its own PermissionsGuard-equivalent
 * check (`requirePermission` below asserts the exact same `permissions[]`
 * a `@RequirePermissions(...)` decorator would check, just resolved
 * dynamically since which permission applies depends on which tool was
 * proposed). See AssistantActionTool's own docstring for why nothing here
 * runs automatically.
 */
@Injectable()
export class AssistantActionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: AssistantActionRegistry,
  ) {}

  listAvailableTools(): AssistantActionToolDescriptor[] {
    return this.registry.list();
  }

  async propose(organisationId: string, actor: AccessTokenPayload, toolName: string, args: Record<string, unknown>, reasoning: string | undefined): Promise<AssistantActionRequest> {
    const tool = this.requireTool(toolName);
    this.requirePermission(actor, tool);

    const action = await this.prisma.assistantActionRequest.create({
      data: {
        organisationId,
        toolName,
        arguments: args as Prisma.InputJsonValue,
        reasoning,
        proposedById: actor.sub,
      },
    });
    return this.toDto(action);
  }

  async list(organisationId: string): Promise<AssistantActionRequest[]> {
    const actions = await this.prisma.assistantActionRequest.findMany({
      where: { organisationId },
      orderBy: { createdAt: "desc" },
    });
    return actions.map((action) => this.toDto(action));
  }

  async getById(organisationId: string, id: string): Promise<AssistantActionRequest> {
    const action = await this.getOwned(organisationId, id);
    return this.toDto(action);
  }

  async approve(organisationId: string, actor: AccessTokenPayload, id: string): Promise<AssistantActionRequest> {
    const action = await this.getOwned(organisationId, id);
    const tool = this.requireTool(action.toolName);
    this.requirePermission(actor, tool);

    if (action.status !== "PENDING_APPROVAL") {
      throw new ValidationApiException(`Cannot approve an action in status ${action.status}`);
    }
    // Maker-checker: whoever clicks "propose" can never also be the one
    // who clicks "approve," even if they hold the required permission
    // twice over (e.g. the organisation's only SUPER_ADMIN) — a real
    // second person has to look at it. This is a deliberate constraint,
    // not a bug: if a solo-admin organisation finds this too strict for
    // their situation, that's a real product conversation to have, not
    // something to quietly bypass here.
    if (action.proposedById === actor.sub) {
      throw new ForbiddenApiException("You proposed this action — a different authorised user must approve it", "SELF_APPROVAL_FORBIDDEN");
    }

    const updated = await this.prisma.assistantActionRequest.update({
      where: { id },
      data: { status: "APPROVED", decidedById: actor.sub, decidedAt: new Date() },
    });
    return this.toDto(updated);
  }

  async reject(organisationId: string, actor: AccessTokenPayload, id: string): Promise<AssistantActionRequest> {
    const action = await this.getOwned(organisationId, id);
    const tool = this.requireTool(action.toolName);
    this.requirePermission(actor, tool);

    if (action.status !== "PENDING_APPROVAL") {
      throw new ValidationApiException(`Cannot reject an action in status ${action.status}`);
    }

    const updated = await this.prisma.assistantActionRequest.update({
      where: { id },
      data: { status: "REJECTED", decidedById: actor.sub, decidedAt: new Date() },
    });
    return this.toDto(updated);
  }

  async execute(organisationId: string, actor: AccessTokenPayload, id: string): Promise<AssistantActionRequest> {
    const action = await this.getOwned(organisationId, id);
    const tool = this.requireTool(action.toolName);
    this.requirePermission(actor, tool);

    if (action.status !== "APPROVED") {
      throw new ValidationApiException(`Cannot execute an action in status ${action.status}`);
    }

    try {
      const result = await tool.execute(organisationId, actor.sub, action.arguments as Record<string, unknown>);
      const updated = await this.prisma.assistantActionRequest.update({
        where: { id },
        data: { status: "EXECUTED", result: (result ?? null) as Prisma.InputJsonValue, executedAt: new Date() },
      });
      return this.toDto(updated);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      await this.prisma.assistantActionRequest.update({
        where: { id },
        data: { status: "FAILED", result: { error: message }, executedAt: new Date() },
      });
      throw error;
    }
  }

  private async getOwned(organisationId: string, id: string): Promise<AssistantActionRequestModel> {
    const action = await this.prisma.assistantActionRequest.findUnique({ where: { id } });
    if (!action || action.organisationId !== organisationId) {
      throw new NotFoundApiException("Action request not found", "ACTION_NOT_FOUND");
    }
    return action;
  }

  private requireTool(toolName: string): AssistantActionTool {
    const tool = this.registry.get(toolName);
    if (!tool) throw new NotFoundApiException(`Unknown action tool: ${toolName}`, "ACTION_TOOL_NOT_FOUND");
    return tool;
  }

  private requirePermission(actor: AccessTokenPayload, tool: AssistantActionTool): void {
    if (!actor.permissions?.includes(tool.requiredPermission)) {
      throw new ForbiddenApiException(`This action requires the '${tool.requiredPermission}' permission`, "MISSING_PERMISSION");
    }
  }

  private toDto(action: AssistantActionRequestModel): AssistantActionRequest {
    return {
      id: action.id,
      toolName: action.toolName,
      arguments: action.arguments as Record<string, unknown>,
      reasoning: action.reasoning,
      status: action.status as AssistantActionRequest["status"],
      result: action.result as Record<string, unknown> | null,
      proposedById: action.proposedById,
      decidedById: action.decidedById,
      createdAt: action.createdAt.toISOString(),
      decidedAt: action.decidedAt?.toISOString() ?? null,
      executedAt: action.executedAt?.toISOString() ?? null,
    };
  }
}
