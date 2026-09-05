import { Module } from "@nestjs/common";
import { OrganisationStructureController } from "./organisation-structure.controller";
import { OrganisationStructureService } from "./organisation-structure.service";
import { PermissionsGuard } from "../common/guards/permissions.guard";

@Module({
  controllers: [OrganisationStructureController],
  providers: [OrganisationStructureService, PermissionsGuard],
})
export class OrganisationStructureModule {}
