import { Module } from "@nestjs/common";
import { OrganisationDashboardController } from "./organisation-dashboard.controller";
import { OrganisationDashboardService } from "./organisation-dashboard.service";
import { OrganisationAccessGuard } from "../common/guards/organisation-access.guard";
import { EntitlementsService } from "../billing/entitlements.service";

@Module({
  controllers: [OrganisationDashboardController],
  providers: [OrganisationDashboardService, OrganisationAccessGuard, EntitlementsService],
})
export class OrganisationDashboardModule {}
