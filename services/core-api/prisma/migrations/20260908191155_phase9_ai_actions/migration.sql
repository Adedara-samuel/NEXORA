-- CreateEnum
CREATE TYPE "AssistantActionStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'EXECUTED', 'FAILED');

-- CreateTable
CREATE TABLE "assistant_action_requests" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "arguments" JSONB NOT NULL,
    "reasoning" TEXT,
    "status" "AssistantActionStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "result" JSONB,
    "proposedById" TEXT NOT NULL,
    "decidedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),

    CONSTRAINT "assistant_action_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assistant_action_requests_organisationId_idx" ON "assistant_action_requests"("organisationId");

-- AddForeignKey
ALTER TABLE "assistant_action_requests" ADD CONSTRAINT "assistant_action_requests_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
