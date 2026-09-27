import type { AccessTokenPayload } from "@nexora/types";
import { AssistantActionsService } from "./assistant-actions.service";
import { ForbiddenApiException, NotFoundApiException, ValidationApiException } from "../common/exceptions/api.exception";

/**
 * Phase 12 (AI security / RBAC): the maker-checker guarantee documented in
 * docs/phase-9-ai-actions.md — a proposer can never also be their own
 * approver, even holding the permission twice over — had no test coverage
 * of its own. This closes that, alongside the permission and tenant checks
 * every one of propose/approve/reject/execute repeats independently.
 */

const ORG_ID = "org-1";
const ACTION_ID = "action-1";
const PROPOSER = "user-proposer";
const APPROVER = "user-approver";
const TOOL_NAME = "disburse_payroll_run";
const REQUIRED_PERMISSION = "payroll:disburse";

function actor(sub: string, permissions: string[]): AccessTokenPayload {
  return { sub, scope: "organisation", organisationId: ORG_ID, permissions, tokenType: "access" };
}

function makeAction(overrides: Partial<{ organisationId: string; status: string; proposedById: string }> = {}) {
  return {
    id: ACTION_ID,
    organisationId: ORG_ID,
    toolName: TOOL_NAME,
    arguments: {},
    reasoning: null,
    status: "PENDING_APPROVAL",
    result: null,
    proposedById: PROPOSER,
    decidedById: null,
    createdAt: new Date(),
    decidedAt: null,
    executedAt: null,
    ...overrides,
  };
}

function makeService(action: ReturnType<typeof makeAction> | null, toolExecute: jest.Mock = jest.fn()) {
  const prisma = {
    assistantActionRequest: {
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve(makeAction({ ...data, proposedById: data.proposedById }))),
      findUnique: jest.fn().mockResolvedValue(action),
      update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...(action ?? makeAction()), ...data })),
    },
  };
  const tool = { requiredPermission: REQUIRED_PERMISSION, execute: toolExecute };
  const registry = { get: jest.fn().mockReturnValue(tool), list: jest.fn() };
  return { service: new AssistantActionsService(prisma as never, registry as never), prisma, registry, tool };
}

describe("AssistantActionsService.propose", () => {
  it("rejects a proposer who lacks the tool's required permission", async () => {
    const { service } = makeService(null);
    await expect(service.propose(ORG_ID, actor(PROPOSER, []), TOOL_NAME, {}, undefined)).rejects.toBeInstanceOf(ForbiddenApiException);
  });

  it("stamps the proposer's own id on the created action", async () => {
    const { service, prisma } = makeService(null);
    await service.propose(ORG_ID, actor(PROPOSER, [REQUIRED_PERMISSION]), TOOL_NAME, { runId: "r1" }, "month-end");
    expect(prisma.assistantActionRequest.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ proposedById: PROPOSER }) }));
  });

  it("rejects an unknown tool name before ever touching the database", async () => {
    const { service, registry, prisma } = makeService(null);
    registry.get.mockReturnValue(undefined);
    await expect(service.propose(ORG_ID, actor(PROPOSER, [REQUIRED_PERMISSION]), "not_a_real_tool", {}, undefined)).rejects.toBeInstanceOf(NotFoundApiException);
    expect(prisma.assistantActionRequest.create).not.toHaveBeenCalled();
  });
});

describe("AssistantActionsService — tenant isolation", () => {
  it("treats an action belonging to a different organisation as not found", async () => {
    const { service } = makeService(makeAction({ organisationId: "someone-elses-org" }));
    await expect(service.getById(ORG_ID, ACTION_ID)).rejects.toBeInstanceOf(NotFoundApiException);
  });
});

describe("AssistantActionsService.approve — maker-checker", () => {
  it("forbids the proposer from approving their own action, even holding the permission", async () => {
    const { service } = makeService(makeAction({ proposedById: PROPOSER }));
    const attempt = service.approve(ORG_ID, actor(PROPOSER, [REQUIRED_PERMISSION]), ACTION_ID);
    await expect(attempt).rejects.toBeInstanceOf(ForbiddenApiException);
    await expect(attempt).rejects.toMatchObject({ code: "SELF_APPROVAL_FORBIDDEN" });
  });

  it("allows a different authorised user to approve", async () => {
    const { service, prisma } = makeService(makeAction({ proposedById: PROPOSER }));
    await service.approve(ORG_ID, actor(APPROVER, [REQUIRED_PERMISSION]), ACTION_ID);
    expect(prisma.assistantActionRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "APPROVED", decidedById: APPROVER }) }),
    );
  });

  it("rejects an approver who lacks the required permission, even if they didn't propose it", async () => {
    const { service } = makeService(makeAction({ proposedById: PROPOSER }));
    await expect(service.approve(ORG_ID, actor(APPROVER, []), ACTION_ID)).rejects.toBeInstanceOf(ForbiddenApiException);
  });

  it("refuses to approve an action that isn't PENDING_APPROVAL", async () => {
    const { service } = makeService(makeAction({ proposedById: PROPOSER, status: "APPROVED" }));
    await expect(service.approve(ORG_ID, actor(APPROVER, [REQUIRED_PERMISSION]), ACTION_ID)).rejects.toBeInstanceOf(ValidationApiException);
  });
});

describe("AssistantActionsService.execute", () => {
  it("refuses to execute an action that isn't APPROVED", async () => {
    const { service } = makeService(makeAction({ status: "PENDING_APPROVAL" }));
    await expect(service.execute(ORG_ID, actor(APPROVER, [REQUIRED_PERMISSION]), ACTION_ID)).rejects.toBeInstanceOf(ValidationApiException);
  });

  it("marks the action EXECUTED with the tool's result on success", async () => {
    const toolExecute = jest.fn().mockResolvedValue({ disbursed: true });
    const { service, prisma } = makeService(makeAction({ status: "APPROVED" }), toolExecute);
    await service.execute(ORG_ID, actor(APPROVER, [REQUIRED_PERMISSION]), ACTION_ID);
    expect(toolExecute).toHaveBeenCalled();
    expect(prisma.assistantActionRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "EXECUTED", result: { disbursed: true } }) }),
    );
  });

  it("marks the action FAILED and re-throws when the tool itself throws", async () => {
    const toolExecute = jest.fn().mockRejectedValue(new Error("SAPOK Pay unreachable"));
    const { service, prisma } = makeService(makeAction({ status: "APPROVED" }), toolExecute);
    await expect(service.execute(ORG_ID, actor(APPROVER, [REQUIRED_PERMISSION]), ACTION_ID)).rejects.toThrow("SAPOK Pay unreachable");
    expect(prisma.assistantActionRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "FAILED", result: { error: "SAPOK Pay unreachable" } }) }),
    );
  });
});
