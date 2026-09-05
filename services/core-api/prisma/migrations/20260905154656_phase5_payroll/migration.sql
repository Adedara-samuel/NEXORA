-- CreateEnum
CREATE TYPE "PayrollRunStatus" AS ENUM ('COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "organisations" ADD COLUMN     "countryCode" TEXT NOT NULL DEFAULT 'NG';

-- CreateTable
CREATE TABLE "tax_bands" (
    "id" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "upToMajor" INTEGER,
    "ratePercent" INTEGER NOT NULL,

    CONSTRAINT "tax_bands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organisation_tax_settings" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "customBands" JSONB,
    "pensionRatePercent" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organisation_tax_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_runs" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "status" "PayrollRunStatus" NOT NULL DEFAULT 'COMPLETED',
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "totalGrossMinor" INTEGER NOT NULL DEFAULT 0,
    "totalDeductionsMinor" INTEGER NOT NULL DEFAULT 0,
    "totalNetMinor" INTEGER NOT NULL DEFAULT 0,
    "skippedEmployeeCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payslips" (
    "id" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "grossMinor" INTEGER NOT NULL,
    "pensionMinor" INTEGER NOT NULL DEFAULT 0,
    "payeMinor" INTEGER NOT NULL DEFAULT 0,
    "otherDeductionsMinor" INTEGER NOT NULL DEFAULT 0,
    "netMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "breakdown" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payslips_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tax_bands_countryCode_order_key" ON "tax_bands"("countryCode", "order");

-- CreateIndex
CREATE UNIQUE INDEX "organisation_tax_settings_organisationId_key" ON "organisation_tax_settings"("organisationId");

-- CreateIndex
CREATE INDEX "payroll_runs_organisationId_idx" ON "payroll_runs"("organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_runs_organisationId_periodYear_periodMonth_key" ON "payroll_runs"("organisationId", "periodYear", "periodMonth");

-- CreateIndex
CREATE INDEX "payslips_organisationId_idx" ON "payslips"("organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "payslips_payrollRunId_employeeId_key" ON "payslips"("payrollRunId", "employeeId");

-- AddForeignKey
ALTER TABLE "organisation_tax_settings" ADD CONSTRAINT "organisation_tax_settings_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "payroll_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
