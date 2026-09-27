import { Module } from "@nestjs/common";
import { ComplianceController } from "./compliance.controller";
import { ComplianceService } from "./compliance.service";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { OrganisationAccessGuard } from "../common/guards/organisation-access.guard";
import { EntitlementsService } from "../billing/entitlements.service";

@Module({
  controllers: [ComplianceController],
  providers: [ComplianceService, PermissionsGuard, OrganisationAccessGuard, EntitlementsService],
})
export class ComplianceModule {}
