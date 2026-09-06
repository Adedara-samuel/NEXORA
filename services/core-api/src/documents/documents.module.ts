import { Module } from "@nestjs/common";
import { DocumentsController } from "./documents.controller";
import { DocumentsService } from "./documents.service";
import { PermissionsGuard } from "../common/guards/permissions.guard";

@Module({
  controllers: [DocumentsController],
  providers: [DocumentsService, PermissionsGuard],
})
export class DocumentsModule {}
