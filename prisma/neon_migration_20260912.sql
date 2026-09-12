-- Migration Script: Production Neon Database Schema Sync
-- Date: 2026-09-12
-- Safe, non-destructive migration inside atomic transaction

BEGIN;

-- 1. Customer: add companyName and index
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "companyName" TEXT;
CREATE INDEX IF NOT EXISTS "Customer_companyName_idx" ON "Customer"("companyName");

-- 2. Purchase: add discount and netAmount
ALTER TABLE "Purchase" ADD COLUMN IF NOT EXISTS "discount" DECIMAL(12, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE "Purchase" ADD COLUMN IF NOT EXISTS "netAmount" DECIMAL(12, 2) NOT NULL DEFAULT 0.00;
-- Populate netAmount with totalAmount for historical purchases
UPDATE "Purchase" SET "netAmount" = "totalAmount" WHERE "netAmount" = 0.00 AND "totalAmount" > 0;

-- 3. PurchaseItem: add saleRate, packSize, looseQuantity, and alter quantity to DECIMAL(12, 3)
ALTER TABLE "PurchaseItem" ADD COLUMN IF NOT EXISTS "saleRate" DECIMAL(12, 2) DEFAULT 0.00;
ALTER TABLE "PurchaseItem" ADD COLUMN IF NOT EXISTS "packSize" DECIMAL(12, 3) DEFAULT 1.000;
ALTER TABLE "PurchaseItem" ADD COLUMN IF NOT EXISTS "looseQuantity" DECIMAL(12, 3) DEFAULT 0.000;
ALTER TABLE "PurchaseItem" ALTER COLUMN "quantity" TYPE DECIMAL(12, 3) USING "quantity"::DECIMAL(12, 3);

-- 4. Product: add packSize, alter quantity and reorderLevel to DECIMAL(12, 3)
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "packSize" DECIMAL(12, 3) DEFAULT 1.000;
ALTER TABLE "Product" ALTER COLUMN "quantity" SET DEFAULT 0.000;
ALTER TABLE "Product" ALTER COLUMN "quantity" TYPE DECIMAL(12, 3) USING "quantity"::DECIMAL(12, 3);
ALTER TABLE "Product" ALTER COLUMN "reorderLevel" SET DEFAULT 10.000;
ALTER TABLE "Product" ALTER COLUMN "reorderLevel" TYPE DECIMAL(12, 3) USING "reorderLevel"::DECIMAL(12, 3);

-- 5. WarehouseStock: alter quantity to DECIMAL(12, 3)
ALTER TABLE "WarehouseStock" ALTER COLUMN "quantity" SET DEFAULT 0.000;
ALTER TABLE "WarehouseStock" ALTER COLUMN "quantity" TYPE DECIMAL(12, 3) USING "quantity"::DECIMAL(12, 3);

-- 6. SaleItem: add packSize, looseQuantity, and alter quantity to DECIMAL(12, 3)
ALTER TABLE "SaleItem" ADD COLUMN IF NOT EXISTS "packSize" DECIMAL(12, 3) DEFAULT 1.000;
ALTER TABLE "SaleItem" ADD COLUMN IF NOT EXISTS "looseQuantity" DECIMAL(12, 3) DEFAULT 0.000;
ALTER TABLE "SaleItem" ALTER COLUMN "quantity" TYPE DECIMAL(12, 3) USING "quantity"::DECIMAL(12, 3);

-- 7. StockMovement: alter quantityBefore, quantityChange, quantityAfter to DECIMAL(12, 3)
ALTER TABLE "StockMovement" ALTER COLUMN "quantityBefore" TYPE DECIMAL(12, 3) USING "quantityBefore"::DECIMAL(12, 3);
ALTER TABLE "StockMovement" ALTER COLUMN "quantityChange" TYPE DECIMAL(12, 3) USING "quantityChange"::DECIMAL(12, 3);
ALTER TABLE "StockMovement" ALTER COLUMN "quantityAfter" TYPE DECIMAL(12, 3) USING "quantityAfter"::DECIMAL(12, 3);

COMMIT;

