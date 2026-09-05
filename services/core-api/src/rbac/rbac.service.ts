import { Injectable } from "@nestjs/common";
import type { CreateRoleInput, UpdateRoleInput } from "@nexora/validation";
import type { Permission, Role } from "@nexora/types";
import { PrismaService } from "../prisma/prisma.service";
import { ConflictApiException, ForbiddenApiException, NotFoundApiException, ValidationApiException } from "../common/exceptions/api.exception";

@Injectable()
export class RbacService {
  constructor(private readonly prisma: PrismaService) {}

  async listPermissions(): Promise<Permission[]> {
    const permissions = await this.prisma.platformPermission.findMany({
      orderBy: [{ category: "asc" }, { key: "asc" }],
    });
    return permissions.map((permission) => ({
      id: permission.id,
      key: permission.key,
      description: permission.description,
      category: permission.category,
    }));
  }

  async listRoles(): Promise<Role[]> {
    const roles = await this.prisma.platformRole.findMany({
      include: { permissions: { include: { permission: true } } },
      orderBy: { name: "asc" },
    });
    return roles.map((role) => this.toRole(role));
  }

  /** Flattened role names + permission keys for a platform user — embedded in the JWT at login/refresh. */
  async getUserRbac(platformUserId: string): Promise<{ roles: string[]; permissions: string[] }> {
    const userRoles = await this.prisma.platformUserRole.findMany({
      where: { platformUserId },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });

    const roles = userRoles.map((userRole) => userRole.role.name);
    const permissions = new Set<string>();
    for (const userRole of userRoles) {
      for (const rolePermission of userRole.role.permissions) {
        permissions.add(rolePermission.permission.key);
      }
    }

    return { roles, permissions: Array.from(permissions) };
  }

  async createRole(input: CreateRoleInput, actorId: string): Promise<Role> {
    const existing = await this.prisma.platformRole.findUnique({ where: { name: input.name } });
    if (existing) throw new ConflictApiException("A role with this name already exists", "ROLE_NAME_TAKEN");

    const permissionIds = await this.assertPermissionKeysExist(input.permissionKeys);

    const role = await this.prisma.platformRole.create({
      data: {
        name: input.name,
        description: input.description,
        isSystem: false,
        permissions: { createMany: { data: permissionIds.map((permissionId) => ({ permissionId })) } },
      },
      include: { permissions: { include: { permission: true } } },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        actorType: "PLATFORM_USER",
        action: "PLATFORM_ROLE_CREATED",
        resourceType: "PlatformRole",
        resourceId: role.id,
        metadata: { name: role.name, permissionKeys: input.permissionKeys },
      },
    });

    return this.toRole(role);
  }

  async updateRole(id: string, input: UpdateRoleInput, actorId: string): Promise<Role> {
    const existing = await this.prisma.platformRole.findUnique({ where: { id } });
    if (!existing) throw new NotFoundApiException("Role not found", "ROLE_NOT_FOUND");

    const permissionIds = input.permissionKeys ? await this.assertPermissionKeysExist(input.permissionKeys) : undefined;

    const role = await this.prisma.$transaction(async (tx) => {
      if (permissionIds) {
        await tx.platformRolePermission.deleteMany({ where: { roleId: id } });
        await tx.platformRolePermission.createMany({
          data: permissionIds.map((permissionId) => ({ roleId: id, permissionId })),
        });
      }
      return tx.platformRole.update({
        where: { id },
        data: { description: input.description },
        include: { permissions: { include: { permission: true } } },
      });
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        actorType: "PLATFORM_USER",
        action: "PLATFORM_ROLE_UPDATED",
        resourceType: "PlatformRole",
        resourceId: role.id,
        metadata: { ...input },
      },
    });

    return this.toRole(role);
  }

  async deleteRole(id: string, actorId: string): Promise<void> {
    const existing = await this.prisma.platformRole.findUnique({ where: { id } });
    if (!existing) throw new NotFoundApiException("Role not found", "ROLE_NOT_FOUND");
    if (existing.isSystem) {
      throw new ForbiddenApiException("System roles cannot be deleted", "SYSTEM_ROLE_PROTECTED");
    }

    await this.prisma.platformRole.delete({ where: { id } });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        actorType: "PLATFORM_USER",
        action: "PLATFORM_ROLE_DELETED",
        resourceType: "PlatformRole",
        resourceId: id,
        metadata: { name: existing.name },
      },
    });
  }

  private async assertPermissionKeysExist(keys: string[]): Promise<string[]> {
    if (keys.length === 0) return [];
    const found = await this.prisma.platformPermission.findMany({ where: { key: { in: keys } } });
    if (found.length !== keys.length) {
      const foundKeys = new Set(found.map((permission) => permission.key));
      const missing = keys.filter((key) => !foundKeys.has(key));
      throw new ValidationApiException("One or more permissionKeys do not exist", { missing });
    }
    return found.map((permission) => permission.id);
  }

  private toRole(role: {
    id: string;
    name: string;
    description: string | null;
    isSystem: boolean;
    permissions: { permission: { key: string } }[];
  }): Role {
    return {
      id: role.id,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      permissions: role.permissions.map((rolePermission) => rolePermission.permission.key),
    };
  }
}
