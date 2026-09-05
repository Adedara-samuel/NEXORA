import { Injectable } from "@nestjs/common";
import type { CreateOrganisationRoleInput, UpdateOrganisationRoleInput } from "@nexora/validation";
import type { Permission, Role } from "@nexora/types";
import { PrismaService } from "../prisma/prisma.service";
import {
  ConflictApiException,
  ForbiddenApiException,
  NotFoundApiException,
  ValidationApiException,
} from "../common/exceptions/api.exception";

@Injectable()
export class OrganisationRbacService {
  constructor(private readonly prisma: PrismaService) {}

  /** The permission catalog is global/seeded, same shape for every organisation. */
  async listPermissions(): Promise<Permission[]> {
    const permissions = await this.prisma.organisationPermission.findMany({
      orderBy: [{ category: "asc" }, { key: "asc" }],
    });
    return permissions.map((permission) => ({
      id: permission.id,
      key: permission.key,
      description: permission.description,
      category: permission.category,
    }));
  }

  async listRoles(organisationId: string): Promise<Role[]> {
    const roles = await this.prisma.organisationRole.findMany({
      where: { organisationId },
      include: { permissions: { include: { permission: true } } },
      orderBy: { name: "asc" },
    });
    return roles.map((role) => this.toRole(role));
  }

  async createRole(organisationId: string, input: CreateOrganisationRoleInput, actorId: string): Promise<Role> {
    const existing = await this.prisma.organisationRole.findUnique({
      where: { organisationId_name: { organisationId, name: input.name } },
    });
    if (existing) throw new ConflictApiException("A role with this name already exists", "ROLE_NAME_TAKEN");

    const permissionIds = await this.assertPermissionKeysExist(input.permissionKeys);

    const role = await this.prisma.organisationRole.create({
      data: {
        organisationId,
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
        actorType: "ORGANISATION_USER",
        organisationId,
        action: "ORGANISATION_ROLE_CREATED",
        resourceType: "OrganisationRole",
        resourceId: role.id,
        metadata: { name: role.name, permissionKeys: input.permissionKeys },
      },
    });

    return this.toRole(role);
  }

  async updateRole(organisationId: string, roleId: string, input: UpdateOrganisationRoleInput, actorId: string): Promise<Role> {
    await this.getOwnedRole(organisationId, roleId);

    const permissionIds = input.permissionKeys ? await this.assertPermissionKeysExist(input.permissionKeys) : undefined;

    const role = await this.prisma.$transaction(async (tx) => {
      if (permissionIds) {
        await tx.organisationRolePermission.deleteMany({ where: { roleId } });
        await tx.organisationRolePermission.createMany({
          data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
        });
      }
      return tx.organisationRole.update({
        where: { id: roleId },
        data: { description: input.description },
        include: { permissions: { include: { permission: true } } },
      });
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        actorType: "ORGANISATION_USER",
        organisationId,
        action: "ORGANISATION_ROLE_UPDATED",
        resourceType: "OrganisationRole",
        resourceId: role.id,
        metadata: { ...input },
      },
    });

    return this.toRole(role);
  }

  async deleteRole(organisationId: string, roleId: string, actorId: string): Promise<void> {
    const existing = await this.getOwnedRole(organisationId, roleId);
    if (existing.isSystem) {
      throw new ForbiddenApiException("System roles cannot be deleted", "SYSTEM_ROLE_PROTECTED");
    }

    await this.prisma.organisationRole.delete({ where: { id: roleId } });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        actorType: "ORGANISATION_USER",
        organisationId,
        action: "ORGANISATION_ROLE_DELETED",
        resourceType: "OrganisationRole",
        resourceId: roleId,
        metadata: { name: existing.name },
      },
    });
  }

  /** Flattened role names + permission keys for an org user — embedded in the JWT at login/refresh. */
  async getUserRbac(organisationUserId: string): Promise<{ roles: string[]; permissions: string[] }> {
    const userRoles = await this.prisma.organisationUserRole.findMany({
      where: { organisationUserId },
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

  /**
   * Idempotent — creates the org's SUPER_ADMIN role (all permissions) the
   * first time it's needed (provisioning that org's first admin user), or
   * returns the existing one on subsequent calls.
   */
  async ensureSuperAdminRole(organisationId: string): Promise<{ id: string }> {
    const existing = await this.prisma.organisationRole.findUnique({
      where: { organisationId_name: { organisationId, name: "SUPER_ADMIN" } },
    });
    if (existing) return { id: existing.id };

    const allPermissions = await this.prisma.organisationPermission.findMany({ select: { id: true } });
    const role = await this.prisma.organisationRole.create({
      data: {
        organisationId,
        name: "SUPER_ADMIN",
        description: "Full access within this organisation",
        isSystem: true,
        permissions: { createMany: { data: allPermissions.map((permission) => ({ permissionId: permission.id })) } },
      },
    });
    return { id: role.id };
  }

  private async getOwnedRole(organisationId: string, roleId: string) {
    const role = await this.prisma.organisationRole.findUnique({ where: { id: roleId } });
    if (!role || role.organisationId !== organisationId) {
      throw new NotFoundApiException("Role not found", "ROLE_NOT_FOUND");
    }
    return role;
  }

  private async assertPermissionKeysExist(keys: string[]): Promise<string[]> {
    if (keys.length === 0) return [];
    const found = await this.prisma.organisationPermission.findMany({ where: { key: { in: keys } } });
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
