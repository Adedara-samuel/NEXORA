import { Module } from "@nestjs/common";
import { OrganisationDashboardController } from "./organisation-dashboard.controller";
import { OrganisationDashboardService } from "./organisation-dashboard.service";

@Module({
  controllers: [OrganisationDashboardController],
  providers: [OrganisationDashboardService],
})
export class OrganisationDashboardModule {}
