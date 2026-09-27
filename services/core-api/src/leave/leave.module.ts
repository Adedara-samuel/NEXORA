import { Module } from "@nestjs/common";
import { LeaveController } from "./leave.controller";
import { LeaveService } from "./leave.service";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { OrganisationAccessGuard } from "../common/guards/organisation-access.guard";
import { EntitlementsService } from "../billing/entitlements.service";

@Module({
  controllers: [LeaveController],
  providers: [LeaveService, PermissionsGuard, OrganisationAccessGuard, EntitlementsService],
})
export class LeaveModule {}
