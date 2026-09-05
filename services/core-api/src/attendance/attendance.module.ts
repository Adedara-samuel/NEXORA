import { Module } from "@nestjs/common";
import { AttendanceController } from "./attendance.controller";
import { AttendanceService } from "./attendance.service";
import { PermissionsGuard } from "../common/guards/permissions.guard";

@Module({
  controllers: [AttendanceController],
  providers: [AttendanceService, PermissionsGuard],
})
export class AttendanceModule {}
