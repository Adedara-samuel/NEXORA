import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcrypt";
import type { CreatePlatformUserInput, ListPlatformUsersQuery, UpdatePlatformUserInput } from "@nexora/validation";
import type { PaginatedResult, PlatformUser } from "@nexora/types";
import { PrismaService } from "../prisma/prisma.service";
import { ConflictApiException, NotFoundApiException, ValidationApiException } from "../common/exceptions/api.exception";
import type { Prisma } from "@prisma/client";

type PlatformUserWithRoles = Prisma.PlatformUserGetPayload<{ include: { roles: { include: { role: true } } } }>;

@Injectable()
export class PlatformUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async list(query: ListPlatformUsersQuery): Promise<PaginatedResult<PlatformUser>> {
    const where: Prisma.PlatformUserWhereInput = {
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
      this.prisma.platformUser.count({ where }),
      this.prisma.platformUser.findMany({
        where,
        include: { roles: { include: { role: true } } },
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return {
      items: users.map((user) => this.toPlatformUser(user)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async findById(id: string): Promise<PlatformUser> {
    const user = await this.prisma.platformUser.findUnique({
      where: { id },
      include: { roles: { include: { role: true } } },
    });
    if (!user) throw new NotFoundApiException("Platform user not found", "PLATFORM_USER_NOT_FOUND");
    return this.toPlatformUser(user);
  }

  async create(input: CreatePlatformUserInput, actorId: string): Promise<PlatformUser> {
    const existing = await this.prisma.platformUser.findUnique({ where: { email: input.email } });
    if (existing) throw new ConflictApiException("A platform user with this email already exists", "EMAIL_TAKEN");

    await this.assertRoleIdsExist(input.roleIds);

    const passwordHash = await bcrypt.hash(input.password, this.config.get<number>("BCRYPT_SALT_ROUNDS", 12));

    const user = await this.prisma.platformUser.create({
      data: {
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        passwordHash,
        roles: { createMany: { data: input.roleIds.map((roleId) => ({ roleId })) } },
      },
      include: { roles: { include: { role: true } } },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        actorType: "PLATFORM_USER",
        action: "PLATFORM_USER_CREATED",
        resourceType: "PlatformUser",
        resourceId: user.id,
        metadata: { email: user.email, roleIds: input.roleIds },
      },
    });

    return this.toPlatformUser(user);
  }

  async update(id: string, input: UpdatePlatformUserInput, actorId: string): Promise<PlatformUser> {
    const existing = await this.prisma.platformUser.findUnique({ where: { id } });
    if (!existing) throw new NotFoundApiException("Platform user not found", "PLATFORM_USER_NOT_FOUND");

    if (input.roleIds) await this.assertRoleIdsExist(input.roleIds);

    const user = await this.prisma.$transaction(async (tx) => {
      if (input.roleIds) {
        await tx.platformUserRole.deleteMany({ where: { platformUserId: id } });
        await tx.platformUserRole.createMany({ data: input.roleIds.map((roleId) => ({ platformUserId: id, roleId })) });
      }
      return tx.platformUser.update({
        where: { id },
        data: {
          firstName: input.firstName,
          lastName: input.lastName,
          status: input.status,
        },
        include: { roles: { include: { role: true } } },
      });
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        actorType: "PLATFORM_USER",
        action: "PLATFORM_USER_UPDATED",
        resourceType: "PlatformUser",
        resourceId: user.id,
        metadata: { ...input },
      },
    });

    return this.toPlatformUser(user);
  }

  private async assertRoleIdsExist(roleIds: string[]): Promise<void> {
    if (roleIds.length === 0) return;
    const found = await this.prisma.platformRole.findMany({ where: { id: { in: roleIds } }, select: { id: true } });
    if (found.length !== roleIds.length) {
      const foundIds = new Set(found.map((role) => role.id));
      const missing = roleIds.filter((id) => !foundIds.has(id));
      throw new ValidationApiException("One or more roleIds do not exist", { missing });
    }
  }

  private toPlatformUser(user: PlatformUserWithRoles): PlatformUser {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
      roles: user.roles.map((userRole) => userRole.role.name),
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }
}
