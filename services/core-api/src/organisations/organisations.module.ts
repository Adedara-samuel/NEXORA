import { Module } from "@nestjs/common";
import { OrganisationsController } from "./organisations.controller";
import { OrganisationsService } from "./organisations.service";
import { PermissionsGuard } from "../common/guards/permissions.guard";

@Module({
  controllers: [OrganisationsController],
  providers: [OrganisationsService, PermissionsGuard],
})
export class OrganisationsModule {}
