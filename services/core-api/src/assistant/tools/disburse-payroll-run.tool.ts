import { Injectable } from "@nestjs/common";
import { PayoutsService } from "../../payouts/payouts.service";
import { ValidationApiException } from "../../common/exceptions/api.exception";
import type { AssistantActionTool } from "../assistant-action-tool";

/**
 * The first, and so far only, registered action tool — chosen for the
 * same reason SAPOK AI's own first action tool was deletion: disbursing
 * payroll is real money leaving the organisation, irreversible once SAPOK
 * Pay processes it, and the clearest possible example of "never
 * AI-initiated alone." Wraps PayoutsService.disburseRun exactly as-is —
 * the same method, the same audit trail, the same SAPOK Pay call the
 * direct `POST /organisation/payroll/runs/:id/disburse` endpoint already
 * uses. This tool adds an approval gate in front of it; it does not
 * duplicate or bypass any of its logic.
 */
@Injectable()
export class DisbursePayrollRunTool implements AssistantActionTool {
  name = "disburse_payroll_run";
  description = "Disburse a completed payroll run's net pay via SAPOK Pay. Irreversible once executed.";
  requiredPermission = "payroll:disburse";

  constructor(private readonly payouts: PayoutsService) {}

  async execute(organisationId: string, actorId: string, args: Record<string, unknown>): Promise<unknown> {
    const payrollRunId = args.payrollRunId;
    if (typeof payrollRunId !== "string" || !payrollRunId.trim()) {
      throw new ValidationApiException("disburse_payroll_run requires a 'payrollRunId' string argument");
    }
    return this.payouts.disburseRun(organisationId, payrollRunId, actorId);
  }
}
