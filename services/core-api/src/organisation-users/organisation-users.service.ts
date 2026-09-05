import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcrypt";
import type {
  CreateOrganisationUserInput,
  ListOrganisationUsersQuery,
  UpdateOrganisationUserInput,
} from "@nexora/validation";
import type { OrganisationUser, PaginatedResult } from "@nexora/types";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ConflictApiException, NotFoundApiException, ValidationApiException } from "../common/exceptions/api.exception";

type OrganisationUserWithRoles = Prisma.OrganisationUserGetPayload<{ include: { roles: { include: { role: true } } } }>;

@Injectable()
export class OrganisationUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async list(organisationId: string, query: ListOrganisationUsersQuery): Promise<PaginatedResult<OrganisationUser>> {
    const where: Prisma.OrganisationUserWhereInput = {
      organisationId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { email: { contains: query.search, mode: "insensitive" } },
              { firstName: { contains: query.search, mode: "insensitive" } },
              { lastName: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [total, users] = await this.prisma.$transaction([
      this.prisma.organisationUser.count({ where }),
      this.prisma.organisationUser.findMany({
        where,
        include: { roles: { include: { role: true } } },
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return {
      items: users.map((user) => this.toOrganisationUser(user)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async findById(organisationId: string, id: string): Promise<OrganisationUser> {
    const user = await this.getOwned(organisationId, id);
    return this.toOrganisationUser(user);
  }

  async create(organisationId: string, input: CreateOrganisationUserInput, actorId: string): Promise<OrganisationUser> {
    const existing = await this.prisma.organisationUser.findUnique({
      where: { organisationId_email: { organisationId, email: input.email } },
    });
    if (existing) throw new ConflictApiException("A user with this email already exists in this organisation", "EMAIL_TAKEN");

    await this.assertRoleIdsExist(organisationId, input.roleIds);
    if (input.departmentId) await this.assertDepartmentOwned(organisationId, input.departmentId);
    if (input.branchId) await this.assertBranchOwned(organisationId, input.branchId);

    const passwordHash = await bcrypt.hash(input.password, this.config.get<number>("BCRYPT_SALT_ROUNDS", 12));

    const user = await this.prisma.organisationUser.create({
      data: {
        organisationId,
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        passwordHash,
        departmentId: input.departmentId,
        branchId: input.branchId,
        roles: { createMany: { data: input.roleIds.map((roleId) => ({ roleId })) } },
      },
      include: { roles: { include: { role: true } } },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        actorType: "ORGANISATION_USER",
        organisationId,
        action: "ORGANISATION_USER_CREATED",
        resourceType: "OrganisationUser",
        resourceId: user.id,
        metadata: { email: user.email, roleIds: input.roleIds },
      },
    });

    return this.toOrganisationUser(user);
  }

  async update(organisationId: string, id: string, input: UpdateOrganisationUserInput, actorId: string): Promise<OrganisationUser> {
    await this.getOwned(organisationId, id);

    if (input.roleIds) await this.assertRoleIdsExist(organisationId, input.roleIds);
    if (input.departmentId) await this.assertDepartmentOwned(organisationId, input.departmentId);
    if (input.branchId) await this.assertBranchOwned(organisationId, input.branchId);

    const user = await this.prisma.$transaction(async (tx) => {
      if (input.roleIds) {
        await tx.organisationUserRole.deleteMany({ where: { organisationUserId: id } });
        await tx.organisationUserRole.createMany({ data: input.roleIds.map((roleId) => ({ organisationUserId: id, roleId })) });
      }
      return tx.organisationUser.update({
        where: { id },
        data: {
          firstName: input.firstName,
          lastName: input.lastName,
          status: input.status,
          departmentId: input.departmentId,
          branchId: input.branchId,
        },
        include: { roles: { include: { role: true } } },
      });
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        actorType: "ORGANISATION_USER",
        organisationId,
        action: "ORGANISATION_USER_UPDATED",
        resourceType: "OrganisationUser",
        resourceId: user.id,
        metadata: { ...input },
      },
    });

    return this.toOrganisationUser(user);
  }

  private async getOwned(organisationId: string, id: string): Promise<OrganisationUserWithRoles> {
    const user = await this.prisma.organisationUser.findUnique({
      where: { id },
      include: { roles: { include: { role: true } } },
    });
    if (!user || user.organisationId !== organisationId) {
      throw new NotFoundApiException("User not found", "ORGANISATION_USER_NOT_FOUND");
    }
    return user;
  }

  private async assertRoleIdsExist(organisationId: string, roleIds: string[]): Promise<void> {
    if (roleIds.length === 0) return;
    const found = await this.prisma.organisationRole.findMany({ where: { id: { in: roleIds }, organisationId }, select: { id: true } });
    if (found.length !== roleIds.length) {
      const foundIds = new Set(found.map((role) => role.id));
      const missing = roleIds.filter((id) => !foundIds.has(id));
      throw new ValidationApiException("One or more roleIds do not exist in this organisation", { missing });
    }
  }

  private async assertDepartmentOwned(organisationId: string, departmentId: string): Promise<void> {
    const department = await this.prisma.department.findUnique({ where: { id: departmentId } });
    if (!department || department.organisationId !== organisationId) {
      throw new ValidationApiException("departmentId does not exist in this organisation");
    }
  }

  private async assertBranchOwned(organisationId: string, branchId: string): Promise<void> {
    const branch = await this.prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch || branch.organisationId !== organisationId) {
      throw new ValidationApiException("branchId does not exist in this organisation");
    }
  }

  private toOrganisationUser(user: OrganisationUserWithRoles): OrganisationUser {
    return {
      id: user.id,
      organisationId: user.organisationId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
      roles: user.roles.map((userRole) => userRole.role.name),
      departmentId: user.departmentId,
      branchId: user.branchId,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }
}
