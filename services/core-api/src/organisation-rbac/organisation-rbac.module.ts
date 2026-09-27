import { Module } from "@nestjs/common";
import { OrganisationRbacController } from "./organisation-rbac.controller";
import { OrganisationRbacService } from "./organisation-rbac.service";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { OrganisationAccessGuard } from "../common/guards/organisation-access.guard";
import { EntitlementsService } from "../billing/entitlements.service";

@Module({
  controllers: [OrganisationRbacController],
  providers: [OrganisationRbacService, PermissionsGuard, OrganisationAccessGuard, EntitlementsService],
  exports: [OrganisationRbacService],
})
export class OrganisationRbacModule {}
