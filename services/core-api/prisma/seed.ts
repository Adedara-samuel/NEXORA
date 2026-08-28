import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

/**
 * Phase 1 seed: a handful of platform users to log in and interact with,
 * so the Control Center isn't a single-account demo. Platform roles/
 * permissions (section 11) aren't modelled yet, so these are plain rows —
 * Phase 2 adds the RBAC join and assigns real roles to each.
 *
 * All dev passwords are intentionally simple and printed below — never
 * used outside local development.
 */
async function main(): Promise<void> {
  const defaultPassword = process.env.SEED_SUPER_ADMIN_PASSWORD ?? "ChangeMe123!";
  const passwordHash = await bcrypt.hash(defaultPassword, 12);

  const users = [
    {
      email: process.env.SEED_SUPER_ADMIN_EMAIL ?? "admin@sapoktech.com",
      firstName: "SAPOK",
      lastName: "Admin",
      status: "ACTIVE" as const,
    },
    {
      email: "support@sapoktech.com",
      firstName: "Ada",
      lastName: "Nwosu",
      status: "ACTIVE" as const,
    },
    {
      email: "finance@sapoktech.com",
      firstName: "Tunde",
      lastName: "Bakare",
      status: "ACTIVE" as const,
    },
    {
      email: "offboarded@sapoktech.com",
      firstName: "Chidi",
      lastName: "Eze",
      // Seeded disabled on purpose — exercises the "inactive user can't log in" path.
      status: "DISABLED" as const,
    },
  ];

  for (const data of users) {
    const user = await prisma.platformUser.upsert({
      where: { email: data.email },
      update: {},
      create: { ...data, passwordHash },
    });
    console.log(`Seeded platform user: ${user.email} (${user.status}, id: ${user.id})`);
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
