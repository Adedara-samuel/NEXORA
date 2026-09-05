import { Module } from "@nestjs/common";
import { PayrollController } from "./payroll.controller";
import { PayrollService } from "./payroll.service";
import { PermissionsGuard } from "../common/guards/permissions.guard";

@Module({
  controllers: [PayrollController],
  providers: [PayrollService, PermissionsGuard],
})
export class PayrollModule {}
