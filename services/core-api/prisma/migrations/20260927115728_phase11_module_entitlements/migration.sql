-- CreateTable
CREATE TABLE "organisation_module_overrides" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "reason" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organisation_module_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organisation_module_overrides_organisationId_moduleId_key" ON "organisation_module_overrides"("organisationId", "moduleId");

-- AddForeignKey
ALTER TABLE "organisation_module_overrides" ADD CONSTRAINT "organisation_module_overrides_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organisation_module_overrides" ADD CONSTRAINT "organisation_module_overrides_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organisation_module_overrides" ADD CONSTRAINT "organisation_module_overrides_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "platform_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
