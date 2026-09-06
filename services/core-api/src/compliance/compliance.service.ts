import { Injectable } from "@nestjs/common";
import type { CreateComplianceRecordInput, ListComplianceRecordsQuery, UpdateComplianceRecordInput } from "@nexora/validation";
import type { ComplianceRecord, PaginatedResult } from "@nexora/types";
import type { ComplianceRecord as PrismaComplianceRecord, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { NotFoundApiException, ValidationApiException } from "../common/exceptions/api.exception";

@Injectable()
export class ComplianceService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organisationId: string, query: ListComplianceRecordsQuery): Promise<PaginatedResult<ComplianceRecord>> {
    const where: Prisma.ComplianceRecordWhereInput = {
      organisationId,
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const [total, records] = await this.prisma.$transaction([
      this.prisma.complianceRecord.count({ where }),
      this.prisma.complianceRecord.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return { items: records.map((record) => this.toComplianceRecord(record)), total, page: query.page, pageSize: query.pageSize };
  }

  async findById(organisationId: string, id: string): Promise<ComplianceRecord> {
    const record = await this.getOwned(organisationId, id);
    return this.toComplianceRecord(record);
  }

  async create(organisationId: string, input: CreateComplianceRecordInput, actorId: string): Promise<ComplianceRecord> {
    if (input.employeeId) await this.assertEmployeeOwned(organisationId, input.employeeId);
    if (input.documentId) await this.assertDocumentOwned(organisationId, input.documentId);

    const record = await this.prisma.complianceRecord.create({
      data: {
        organisationId,
        employeeId: input.employeeId,
        title: input.title,
        description: input.description,
        dueDate: input.dueDate,
        documentId: input.documentId,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        actorType: "ORGANISATION_USER",
        organisationId,
        action: "COMPLIANCE_RECORD_CREATED",
        resourceType: "ComplianceRecord",
        resourceId: record.id,
        metadata: { title: record.title, employeeId: record.employeeId },
      },
    });

    return this.toComplianceRecord(record);
  }

  async update(organisationId: string, id: string, input: UpdateComplianceRecordInput, actorId: string): Promise<ComplianceRecord> {
    await this.getOwned(organisationId, id);

    if (input.documentId) await this.assertDocumentOwned(organisationId, input.documentId);
    if (input.status === "COMPLIANT" && !input.completedDate) {
      throw new ValidationApiException("completedDate is required when setting status to COMPLIANT");
    }

    const record = await this.prisma.complianceRecord.update({
      where: { id },
      data: {
        title: input.title,
        description: input.description,
        status: input.status,
        dueDate: input.dueDate,
        completedDate: input.completedDate,
        documentId: input.documentId,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        actorType: "ORGANISATION_USER",
        organisationId,
        action: "COMPLIANCE_RECORD_UPDATED",
        resourceType: "ComplianceRecord",
        resourceId: record.id,
        metadata: { status: record.status },
      },
    });

    return this.toComplianceRecord(record);
  }

  private async getOwned(organisationId: string, id: string): Promise<PrismaComplianceRecord> {
    const record = await this.prisma.complianceRecord.findUnique({ where: { id } });
    if (!record || record.organisationId !== organisationId) {
      throw new NotFoundApiException("Compliance record not found", "COMPLIANCE_RECORD_NOT_FOUND");
    }
    return record;
  }

  private async assertEmployeeOwned(organisationId: string, employeeId: string): Promise<void> {
    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee || employee.organisationId !== organisationId) {
      throw new ValidationApiException("employeeId does not exist in this organisation");
    }
  }

  private async assertDocumentOwned(organisationId: string, documentId: string): Promise<void> {
    const document = await this.prisma.document.findUnique({ where: { id: documentId } });
    if (!document || document.organisationId !== organisationId) {
      throw new ValidationApiException("documentId does not exist in this organisation");
    }
  }

  private toComplianceRecord(record: PrismaComplianceRecord): ComplianceRecord {
    return {
      id: record.id,
      organisationId: record.organisationId,
      employeeId: record.employeeId,
      title: record.title,
      description: record.description,
      status: record.status,
      dueDate: record.dueDate?.toISOString() ?? null,
      completedDate: record.completedDate?.toISOString() ?? null,
      documentId: record.documentId,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
