import { Module } from "@nestjs/common";
import { PlatformUsersController } from "./platform-users.controller";
import { PlatformUsersService } from "./platform-users.service";
import { PermissionsGuard } from "../common/guards/permissions.guard";

@Module({
  controllers: [PlatformUsersController],
  providers: [PlatformUsersService, PermissionsGuard],
})
export class PlatformUsersModule {}
