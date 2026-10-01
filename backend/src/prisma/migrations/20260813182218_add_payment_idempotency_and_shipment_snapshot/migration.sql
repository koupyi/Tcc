-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "idempotencyKey" TEXT;

-- AlterTable
ALTER TABLE "shipments" ADD COLUMN     "snapshotCity" TEXT,
ADD COLUMN     "snapshotComplement" TEXT,
ADD COLUMN     "snapshotNeighborhood" TEXT,
ADD COLUMN     "snapshotNumber" TEXT,
ADD COLUMN     "snapshotRecipientName" TEXT,
ADD COLUMN     "snapshotState" TEXT,
ADD COLUMN     "snapshotStreet" TEXT,
ADD COLUMN     "snapshotZipCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "payments_idempotencyKey_key" ON "payments"("idempotencyKey");
