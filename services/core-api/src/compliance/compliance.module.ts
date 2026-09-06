import { Module } from "@nestjs/common";
import { ComplianceController } from "./compliance.controller";
import { ComplianceService } from "./compliance.service";
import { PermissionsGuard } from "../common/guards/permissions.guard";

@Module({
  controllers: [ComplianceController],
  providers: [ComplianceService, PermissionsGuard],
})
export class ComplianceModule {}
