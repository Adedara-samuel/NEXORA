import { Injectable } from "@nestjs/common";
import type { CreateDocumentInput, ListDocumentsQuery, UpdateDocumentInput } from "@nexora/validation";
import type { OrganisationDocument, PaginatedResult } from "@nexora/types";
import type { Document as PrismaDocument, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { NotFoundApiException, ValidationApiException } from "../common/exceptions/api.exception";

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organisationId: string, query: ListDocumentsQuery): Promise<PaginatedResult<OrganisationDocument>> {
    const where: Prisma.DocumentWhereInput = {
      organisationId,
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.category ? { category: query.category } : {}),
    };

    const [total, documents] = await this.prisma.$transaction([
      this.prisma.document.count({ where }),
      this.prisma.document.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return { items: documents.map((document) => this.toDocument(document)), total, page: query.page, pageSize: query.pageSize };
  }

  async findById(organisationId: string, id: string): Promise<OrganisationDocument> {
    const document = await this.getOwned(organisationId, id);
    return this.toDocument(document);
  }

  async create(organisationId: string, input: CreateDocumentInput, actorId: string): Promise<OrganisationDocument> {
    if (input.employeeId) await this.assertEmployeeOwned(organisationId, input.employeeId);

    const document = await this.prisma.document.create({
      data: {
        organisationId,
        employeeId: input.employeeId,
        title: input.title,
        category: input.category,
        fileUrl: input.fileUrl,
        expiryDate: input.expiryDate,
        uploadedById: actorId,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        actorType: "ORGANISATION_USER",
        organisationId,
        action: "DOCUMENT_ADDED",
        resourceType: "Document",
        resourceId: document.id,
        metadata: { title: document.title, category: document.category, employeeId: document.employeeId },
      },
    });

    return this.toDocument(document);
  }

  async update(organisationId: string, id: string, input: UpdateDocumentInput, actorId: string): Promise<OrganisationDocument> {
    await this.getOwned(organisationId, id);

    const document = await this.prisma.document.update({
      where: { id },
      data: {
        title: input.title,
        category: input.category,
        fileUrl: input.fileUrl,
        expiryDate: input.expiryDate,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        actorType: "ORGANISATION_USER",
        organisationId,
        action: "DOCUMENT_UPDATED",
        resourceType: "Document",
        resourceId: document.id,
        metadata: { title: document.title },
      },
    });

    return this.toDocument(document);
  }

  private async getOwned(organisationId: string, id: string): Promise<PrismaDocument> {
    const document = await this.prisma.document.findUnique({ where: { id } });
    if (!document || document.organisationId !== organisationId) {
      throw new NotFoundApiException("Document not found", "DOCUMENT_NOT_FOUND");
    }
    return document;
  }

  private async assertEmployeeOwned(organisationId: string, employeeId: string): Promise<void> {
    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee || employee.organisationId !== organisationId) {
      throw new ValidationApiException("employeeId does not exist in this organisation");
    }
  }

  private toDocument(document: PrismaDocument): OrganisationDocument {
    return {
      id: document.id,
      organisationId: document.organisationId,
      employeeId: document.employeeId,
      title: document.title,
      category: document.category,
      fileUrl: document.fileUrl,
      expiryDate: document.expiryDate?.toISOString() ?? null,
      uploadedById: document.uploadedById,
      createdAt: document.createdAt.toISOString(),
      updatedAt: document.updatedAt.toISOString(),
    };
  }
}
