import { Injectable } from "@nestjs/common";
import type { CreateBranchInput, CreateDepartmentInput } from "@nexora/validation";
import type { Branch, Department } from "@nexora/types";
import { PrismaService } from "../prisma/prisma.service";
import { ConflictApiException } from "../common/exceptions/api.exception";

@Injectable()
export class OrganisationStructureService {
  constructor(private readonly prisma: PrismaService) {}

  async listDepartments(organisationId: string): Promise<Department[]> {
    const departments = await this.prisma.department.findMany({ where: { organisationId }, orderBy: { name: "asc" } });
    return departments.map((department) => ({
      id: department.id,
      organisationId: department.organisationId,
      name: department.name,
      createdAt: department.createdAt.toISOString(),
    }));
  }

  async createDepartment(organisationId: string, input: CreateDepartmentInput, actorId: string): Promise<Department> {
    const existing = await this.prisma.department.findUnique({ where: { organisationId_name: { organisationId, name: input.name } } });
    if (existing) throw new ConflictApiException("A department with this name already exists", "DEPARTMENT_NAME_TAKEN");

    const department = await this.prisma.department.create({ data: { organisationId, name: input.name } });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        actorType: "ORGANISATION_USER",
        organisationId,
        action: "DEPARTMENT_CREATED",
        resourceType: "Department",
        resourceId: department.id,
        metadata: { name: department.name },
      },
    });

    return { id: department.id, organisationId: department.organisationId, name: department.name, createdAt: department.createdAt.toISOString() };
  }

  async listBranches(organisationId: string): Promise<Branch[]> {
    const branches = await this.prisma.branch.findMany({ where: { organisationId }, orderBy: { name: "asc" } });
    return branches.map((branch) => ({
      id: branch.id,
      organisationId: branch.organisationId,
      name: branch.name,
      address: branch.address,
      createdAt: branch.createdAt.toISOString(),
    }));
  }

  async createBranch(organisationId: string, input: CreateBranchInput, actorId: string): Promise<Branch> {
    const existing = await this.prisma.branch.findUnique({ where: { organisationId_name: { organisationId, name: input.name } } });
    if (existing) throw new ConflictApiException("A branch with this name already exists", "BRANCH_NAME_TAKEN");

    const branch = await this.prisma.branch.create({ data: { organisationId, name: input.name, address: input.address } });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        actorType: "ORGANISATION_USER",
        organisationId,
        action: "BRANCH_CREATED",
        resourceType: "Branch",
        resourceId: branch.id,
        metadata: { name: branch.name },
      },
    });

    return { id: branch.id, organisationId: branch.organisationId, name: branch.name, address: branch.address, createdAt: branch.createdAt.toISOString() };
  }
}
