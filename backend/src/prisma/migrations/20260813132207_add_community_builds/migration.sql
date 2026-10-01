-- CreateTable
CREATE TABLE "community_builds" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "layout" TEXT,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "community_builds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_build_items" (
    "id" TEXT NOT NULL,
    "buildId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "productId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,

    CONSTRAINT "community_build_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "community_builds_ownerId_idx" ON "community_builds"("ownerId");

-- CreateIndex
CREATE INDEX "community_builds_isActive_idx" ON "community_builds"("isActive");

-- CreateIndex
CREATE INDEX "community_build_items_buildId_idx" ON "community_build_items"("buildId");

-- CreateIndex
CREATE INDEX "community_build_items_productId_idx" ON "community_build_items"("productId");

-- CreateIndex
CREATE INDEX "community_build_items_variantId_idx" ON "community_build_items"("variantId");

-- AddForeignKey
ALTER TABLE "community_builds" ADD CONSTRAINT "community_builds_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_build_items" ADD CONSTRAINT "community_build_items_buildId_fkey" FOREIGN KEY ("buildId") REFERENCES "community_builds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_build_items" ADD CONSTRAINT "community_build_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_build_items" ADD CONSTRAINT "community_build_items_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
