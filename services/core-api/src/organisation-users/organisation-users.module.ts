import { Module } from "@nestjs/common";
import { OrganisationUsersController } from "./organisation-users.controller";
import { OrganisationUsersService } from "./organisation-users.service";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { OrganisationAccessGuard } from "../common/guards/organisation-access.guard";
import { EntitlementsService } from "../billing/entitlements.service";

@Module({
  controllers: [OrganisationUsersController],
  providers: [OrganisationUsersService, PermissionsGuard, OrganisationAccessGuard, EntitlementsService],
})
export class OrganisationUsersModule {}
