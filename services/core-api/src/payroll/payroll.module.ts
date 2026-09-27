import { Module } from "@nestjs/common";
import { PayrollController } from "./payroll.controller";
import { PayrollService } from "./payroll.service";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { OrganisationAccessGuard } from "../common/guards/organisation-access.guard";
import { EntitlementsService } from "../billing/entitlements.service";
import { PayoutsModule } from "../payouts/payouts.module";

@Module({
  imports: [PayoutsModule],
  controllers: [PayrollController],
  providers: [PayrollService, PermissionsGuard, OrganisationAccessGuard, EntitlementsService],
})
export class PayrollModule {}
