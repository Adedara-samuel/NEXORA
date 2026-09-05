import { Module } from "@nestjs/common";
import { OrganisationRbacController } from "./organisation-rbac.controller";
import { OrganisationRbacService } from "./organisation-rbac.service";
import { PermissionsGuard } from "../common/guards/permissions.guard";

@Module({
  controllers: [OrganisationRbacController],
  providers: [OrganisationRbacService, PermissionsGuard],
  exports: [OrganisationRbacService],
})
export class OrganisationRbacModule {}
