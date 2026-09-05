import { Module } from "@nestjs/common";
import { OrganisationUsersController } from "./organisation-users.controller";
import { OrganisationUsersService } from "./organisation-users.service";
import { PermissionsGuard } from "../common/guards/permissions.guard";

@Module({
  controllers: [OrganisationUsersController],
  providers: [OrganisationUsersService, PermissionsGuard],
})
export class OrganisationUsersModule {}
