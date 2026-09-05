import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

/**
 * Phase 2 permission catalog. Keys are the strings checked by
 * @RequirePermissions(...) in the API — changing a key here means updating
 * every controller that references it.
 */
const PERMISSIONS: { key: string; description: string; category: string }[] = [
  { key: "platform_users:read", description: "View platform users", category: "platform_users" },
  { key: "platform_users:create", description: "Create platform users", category: "platform_users" },
  { key: "platform_users:update", description: "Update platform users, including status and roles", category: "platform_users" },
  { key: "platform_roles:read", description: "View platform roles and permissions", category: "platform_roles" },
  { key: "platform_roles:manage", description: "Create, edit and delete custom platform roles", category: "platform_roles" },
  { key: "organisations:read", description: "View organisations", category: "organisations" },
  { key: "organisations:create", description: "Onboard new organisations", category: "organisations" },
  { key: "organisations:update", description: "Update organisation details", category: "organisations" },
  { key: "organisations:manage_status", description: "Change organisation lifecycle status", category: "organisations" },
  { key: "billing:read", description: "View plans, subscriptions and invoices", category: "billing" },
  { key: "billing:manage_plans", description: "Create and edit plans and their included modules", category: "billing" },
  { key: "billing:manage_subscriptions", description: "Assign plans, renew and cancel organisation subscriptions", category: "billing" },
];

/** Fixed module catalog — entries correspond to real business modules (Phase 5 onward). */
const MODULES: { key: string; name: string; description: string }[] = [
  { key: "employees", name: "Employees", description: "Staff records and profiles" },
  { key: "attendance", name: "Attendance", description: "Clock-in/out and attendance tracking" },
  { key: "leave", name: "Leave", description: "Leave requests and approvals" },
  { key: "documents", name: "Documents", description: "Document storage and compliance records" },
  { key: "compliance", name: "Compliance", description: "Regulatory compliance tracking" },
  { key: "payroll", name: "Payroll", description: "Payroll processing and payslips" },
];

/** Demo plans — real pricing/tiers are a business decision, replace before launch. */
const PLANS: { name: string; description: string; priceMinor: number; billingCycle: "MONTHLY" | "ANNUALLY"; moduleKeys: string[] }[] = [
  {
    name: "Starter",
    description: "Core HR essentials for small teams",
    priceMinor: 1_500_000,
    billingCycle: "MONTHLY",
    moduleKeys: ["employees", "attendance", "leave"],
  },
  {
    name: "Growth",
    description: "Adds compliance and document management",
    priceMinor: 3_500_000,
    billingCycle: "MONTHLY",
    moduleKeys: ["employees", "attendance", "leave", "documents", "compliance"],
  },
  {
    name: "Enterprise",
    description: "Full platform including payroll",
    priceMinor: 8_000_000,
    billingCycle: "ANNUALLY",
    moduleKeys: ["employees", "attendance", "leave", "documents", "compliance", "payroll"],
  },
];

/** System roles — isSystem: true means they can't be deleted via the API. */
const ROLES: { name: string; description: string; permissions: string[] }[] = [
  {
    name: "SUPER_ADMIN",
    description: "Full platform access",
    permissions: PERMISSIONS.map((permission) => permission.key),
  },
  {
    name: "SUPPORT",
    description: "Read access to platform users and organisations",
    permissions: ["platform_users:read", "organisations:read"],
  },
  {
    name: "FINANCE",
    description: "Read access to organisations and full billing management",
    permissions: ["organisations:read", "billing:read", "billing:manage_subscriptions"],
  },
];

/**
 * Phase 1 seed: a handful of platform users to log in and interact with, so
 * the Control Center isn't a single-account demo.
 *
 * Phase 2: seeds the RBAC catalog (permissions + system roles) and assigns
 * a role to each seeded user.
 *
 * All dev passwords are intentionally simple and printed below — never used
 * outside local development.
 */
async function main(): Promise<void> {
  for (const permission of PERMISSIONS) {
    await prisma.platformPermission.upsert({
      where: { key: permission.key },
      update: { description: permission.description, category: permission.category },
      create: permission,
    });
  }
  console.log(`Seeded ${PERMISSIONS.length} platform permissions.`);

  for (const module of MODULES) {
    await prisma.module.upsert({ where: { key: module.key }, update: { name: module.name, description: module.description }, create: module });
  }
  console.log(`Seeded ${MODULES.length} modules.`);

  for (const planDef of PLANS) {
    const plan = await prisma.plan.upsert({
      where: { name: planDef.name },
      update: { description: planDef.description, priceMinor: planDef.priceMinor, billingCycle: planDef.billingCycle },
      create: {
        name: planDef.name,
        description: planDef.description,
        priceMinor: planDef.priceMinor,
        billingCycle: planDef.billingCycle,
      },
    });
    await prisma.planModule.deleteMany({ where: { planId: plan.id } });
    const modules = await prisma.module.findMany({ where: { key: { in: planDef.moduleKeys } } });
    await prisma.planModule.createMany({ data: modules.map((module) => ({ planId: plan.id, moduleId: module.id })) });
    console.log(`Seeded plan: ${plan.name} (${modules.length} modules)`);
  }

  const roleIdByName = new Map<string, string>();
  for (const roleDef of ROLES) {
    const role = await prisma.platformRole.upsert({
      where: { name: roleDef.name },
      update: { description: roleDef.description, isSystem: true },
      create: { name: roleDef.name, description: roleDef.description, isSystem: true },
    });
    roleIdByName.set(role.name, role.id);

    await prisma.platformRolePermission.deleteMany({ where: { roleId: role.id } });
    const permissions = await prisma.platformPermission.findMany({ where: { key: { in: roleDef.permissions } } });
    await prisma.platformRolePermission.createMany({
      data: permissions.map((permission) => ({ roleId: role.id, permissionId: permission.id })),
    });
    console.log(`Seeded platform role: ${role.name} (${permissions.length} permissions)`);
  }

  const defaultPassword = process.env.SEED_SUPER_ADMIN_PASSWORD ?? "ChangeMe123!";
  const passwordHash = await bcrypt.hash(defaultPassword, 12);

  const users = [
    {
      email: process.env.SEED_SUPER_ADMIN_EMAIL ?? "admin@sapoktech.com",
      firstName: "SAPOK",
      lastName: "Admin",
      status: "ACTIVE" as const,
      role: "SUPER_ADMIN",
    },
    {
      email: "support@sapoktech.com",
      firstName: "Ada",
      lastName: "Nwosu",
      status: "ACTIVE" as const,
      role: "SUPPORT",
    },
    {
      email: "finance@sapoktech.com",
      firstName: "Tunde",
      lastName: "Bakare",
      status: "ACTIVE" as const,
      role: "FINANCE",
    },
    {
      email: "offboarded@sapoktech.com",
      firstName: "Chidi",
      lastName: "Eze",
      // Seeded disabled on purpose — exercises the "inactive user can't log in" path.
      status: "DISABLED" as const,
      role: "SUPPORT",
    },
  ];

  for (const { role: roleName, ...data } of users) {
    const user = await prisma.platformUser.upsert({
      where: { email: data.email },
      update: {},
      create: { ...data, passwordHash },
    });

    const roleId = roleIdByName.get(roleName);
    if (roleId) {
      await prisma.platformUserRole.upsert({
        where: { platformUserId_roleId: { platformUserId: user.id, roleId } },
        update: {},
        create: { platformUserId: user.id, roleId },
      });
    }

    console.log(`Seeded platform user: ${user.email} (${user.status}, role: ${roleName}, id: ${user.id})`);
  }

  console.log(`\nAll seeded users share password: ${defaultPassword} — local dev only.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
