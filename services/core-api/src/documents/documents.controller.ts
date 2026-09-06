import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import {
  createDocumentSchema,
  listDocumentsQuerySchema,
  updateDocumentSchema,
  type CreateDocumentInput,
  type ListDocumentsQuery,
  type UpdateDocumentInput,
} from "@nexora/validation";
import type { AccessTokenPayload } from "@nexora/types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { CurrentOrganisationId } from "../common/decorators/current-organisation-id.decorator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { DocumentsService } from "./documents.service";

@ApiTags("documents")
@UseGuards(PermissionsGuard)
@Controller("organisation/documents")
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @RequirePermissions("documents:read")
  @Get()
  list(@CurrentOrganisationId() organisationId: string, @Query(new ZodValidationPipe(listDocumentsQuerySchema)) query: ListDocumentsQuery) {
    return this.documents.list(organisationId, query);
  }

  @RequirePermissions("documents:read")
  @Get(":id")
  findById(@CurrentOrganisationId() organisationId: string, @Param("id") id: string) {
    return this.documents.findById(organisationId, id);
  }

  @RequirePermissions("documents:create")
  @Post()
  create(
    @CurrentOrganisationId() organisationId: string,
    @Body(new ZodValidationPipe(createDocumentSchema)) body: CreateDocumentInput,
    @CurrentUser() actor: AccessTokenPayload,
  ) {
    return this.documents.create(organisationId, body, actor.sub);
  }

  @RequirePermissions("documents:update")
  @Patch(":id")
  update(
    @CurrentOrganisationId() organisationId: string,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateDocumentSchema)) body: UpdateDocumentInput,
    @CurrentUser() actor: AccessTokenPayload,
  ) {
    return this.documents.update(organisationId, id, body, actor.sub);
  }
}
