import { Module } from "@nestjs/common";
import { LeaveController } from "./leave.controller";
import { LeaveService } from "./leave.service";
import { PermissionsGuard } from "../common/guards/permissions.guard";

@Module({
  controllers: [LeaveController],
  providers: [LeaveService, PermissionsGuard],
})
export class LeaveModule {}
