import { Module } from "@nestjs/common";
import { PayrollController } from "./payroll.controller";
import { PayrollService } from "./payroll.service";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { PayoutsModule } from "../payouts/payouts.module";

@Module({
  imports: [PayoutsModule],
  controllers: [PayrollController],
  providers: [PayrollService, PermissionsGuard],
})
export class PayrollModule {}
