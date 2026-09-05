import { Module } from "@nestjs/common";
import { RbacController } from "./rbac.controller";
import { RbacService } from "./rbac.service";
import { PermissionsGuard } from "../common/guards/permissions.guard";

@Module({
  controllers: [RbacController],
  providers: [RbacService, PermissionsGuard],
  exports: [RbacService],
})
export class RbacModule {}
