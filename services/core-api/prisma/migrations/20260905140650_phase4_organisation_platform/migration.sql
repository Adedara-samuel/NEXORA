-- CreateEnum
CREATE TYPE "OrganisationUserStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- AlterTable
ALTER TABLE "refresh_tokens" ADD COLUMN     "organisationUserId" TEXT;

-- CreateTable
CREATE TABLE "organisation_users" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "status" "OrganisationUserStatus" NOT NULL DEFAULT 'ACTIVE',
    "departmentId" TEXT,
    "branchId" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organisation_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organisation_permissions" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organisation_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organisation_roles" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organisation_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organisation_role_permissions" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "organisation_role_permissions_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "organisation_user_roles" (
    "organisationUserId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organisation_user_roles_pkey" PRIMARY KEY ("organisationUserId","roleId")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "organisation_users_organisationId_idx" ON "organisation_users"("organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "organisation_users_organisationId_email_key" ON "organisation_users"("organisationId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "organisation_permissions_key_key" ON "organisation_permissions"("key");

-- CreateIndex
CREATE INDEX "organisation_roles_organisationId_idx" ON "organisation_roles"("organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "organisation_roles_organisationId_name_key" ON "organisation_roles"("organisationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "departments_organisationId_name_key" ON "departments"("organisationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "branches_organisationId_name_key" ON "branches"("organisationId", "name");

-- CreateIndex
CREATE INDEX "refresh_tokens_organisationUserId_idx" ON "refresh_tokens"("organisationUserId");

-- AddForeignKey
ALTER TABLE "organisation_users" ADD CONSTRAINT "organisation_users_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organisation_users" ADD CONSTRAINT "organisation_users_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organisation_users" ADD CONSTRAINT "organisation_users_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organisation_roles" ADD CONSTRAINT "organisation_roles_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organisation_role_permissions" ADD CONSTRAINT "organisation_role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "organisation_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organisation_role_permissions" ADD CONSTRAINT "organisation_role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "organisation_permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organisation_user_roles" ADD CONSTRAINT "organisation_user_roles_organisationUserId_fkey" FOREIGN KEY ("organisationUserId") REFERENCES "organisation_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organisation_user_roles" ADD CONSTRAINT "organisation_user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "organisation_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_organisationUserId_fkey" FOREIGN KEY ("organisationUserId") REFERENCES "organisation_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
