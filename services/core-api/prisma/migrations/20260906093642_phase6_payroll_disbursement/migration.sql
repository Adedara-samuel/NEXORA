-- CreateEnum
CREATE TYPE "PayrollDisbursementStatus" AS ENUM ('NOT_DISBURSED', 'DISBURSING', 'DISBURSED', 'PARTIALLY_DISBURSED', 'FAILED');

-- CreateEnum
CREATE TYPE "PayslipDisbursementStatus" AS ENUM ('PAID', 'FAILED', 'SKIPPED');

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "bankAccountNumber" TEXT,
ADD COLUMN     "bankCode" TEXT;

-- AlterTable
ALTER TABLE "organisations" ADD COLUMN     "paymentProviderApiKey" TEXT,
ADD COLUMN     "paymentProviderMerchantId" TEXT;

-- AlterTable
ALTER TABLE "payroll_runs" ADD COLUMN     "disbursementBatchReference" TEXT,
ADD COLUMN     "disbursementStatus" "PayrollDisbursementStatus" NOT NULL DEFAULT 'NOT_DISBURSED';

-- AlterTable
ALTER TABLE "payslips" ADD COLUMN     "disbursementFailureReason" TEXT,
ADD COLUMN     "disbursementStatus" "PayslipDisbursementStatus";
