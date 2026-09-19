import { Module } from "@nestjs/common";
import { PayoutsModule } from "../payouts/payouts.module";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { AssistantActionRegistry } from "./assistant-action-registry";
import { AssistantActionsService } from "./assistant-actions.service";
import { AssistantController } from "./assistant.controller";
import { AssistantService } from "./assistant.service";
import { DisbursePayrollRunTool } from "./tools/disburse-payroll-run.tool";

@Module({
  imports: [PayoutsModule],
  controllers: [AssistantController],
  providers: [AssistantService, AssistantActionsService, AssistantActionRegistry, DisbursePayrollRunTool, PermissionsGuard],
})
export class AssistantModule {}
