import { Module } from "@nestjs/common";
import { OrganisationStructureController } from "./organisation-structure.controller";
import { OrganisationStructureService } from "./organisation-structure.service";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { OrganisationAccessGuard } from "../common/guards/organisation-access.guard";
import { EntitlementsService } from "../billing/entitlements.service";

@Module({
  controllers: [OrganisationStructureController],
  providers: [OrganisationStructureService, PermissionsGuard, OrganisationAccessGuard, EntitlementsService],
})
export class OrganisationStructureModule {}
