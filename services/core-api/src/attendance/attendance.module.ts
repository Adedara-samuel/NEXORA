import { Module } from "@nestjs/common";
import { AttendanceController } from "./attendance.controller";
import { AttendanceService } from "./attendance.service";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { OrganisationAccessGuard } from "../common/guards/organisation-access.guard";
import { EntitlementsService } from "../billing/entitlements.service";

@Module({
  controllers: [AttendanceController],
  providers: [AttendanceService, PermissionsGuard, OrganisationAccessGuard, EntitlementsService],
})
export class AttendanceModule {}
