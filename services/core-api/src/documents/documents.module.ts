import { Module } from "@nestjs/common";
import { DocumentsController } from "./documents.controller";
import { DocumentsService } from "./documents.service";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { OrganisationAccessGuard } from "../common/guards/organisation-access.guard";
import { EntitlementsService } from "../billing/entitlements.service";

@Module({
  controllers: [DocumentsController],
  providers: [DocumentsService, PermissionsGuard, OrganisationAccessGuard, EntitlementsService],
})
export class DocumentsModule {}
