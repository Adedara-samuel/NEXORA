import { Injectable } from "@nestjs/common";
import type { AssistantActionToolDescriptor } from "@nexora/types";
import { DisbursePayrollRunTool } from "./tools/disburse-payroll-run.tool";
import type { AssistantActionTool } from "./assistant-action-tool";

/**
 * Deliberately separate from the read-side of the assistant (conversations,
 * knowledge search) — action tools mutate real business state, so the
 * registry that holds them is its own explicit list, not something a
 * knowledge-search call could ever reach. Adding a second tool means
 * adding it to the constructor list below and to AssistantModule's
 * providers, nothing more.
 */
@Injectable()
export class AssistantActionRegistry {
  private readonly tools: Map<string, AssistantActionTool>;

  constructor(disbursePayrollRun: DisbursePayrollRunTool) {
    this.tools = new Map([[disbursePayrollRun.name, disbursePayrollRun]]);
  }

  get(name: string): AssistantActionTool | undefined {
    return this.tools.get(name);
  }

  list(): AssistantActionToolDescriptor[] {
    return [...this.tools.values()].map((tool) => ({
      name: tool.name,
      description: tool.description,
      requiredPermission: tool.requiredPermission,
    }));
  }
}
