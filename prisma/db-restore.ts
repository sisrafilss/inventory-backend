import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log("==========================================");
  console.log("   DATABASE RESTORE SCRIPT (JSON SNAPSHOT)");
  console.log("==========================================");

  const snapshotPath = path.join(process.cwd(), "prisma", "db-snapshot.json");

  if (!fs.existsSync(snapshotPath)) {
    console.error(`Snapshot file not found at: ${snapshotPath}`);
    console.error("Please run 'npm run db:dump' first to generate a snapshot.");
    process.exit(1);
  }

  const raw = fs.readFileSync(snapshotPath, "utf-8");
  const snapshot = JSON.parse(raw);
  const data = snapshot.data;

  console.log(`Snapshot exported at: ${snapshot.exportedAt}`);
  console.log("Beginning atomic restore inside database transaction...\n");

  await prisma.$transaction(
    async (tx) => {
      // 1. Delete in reverse dependency order
      console.log("Clearing existing data...");
      await tx.auditLog.deleteMany();
      await tx.partyPayment.deleteMany();
      await tx.expense.deleteMany();
      await tx.stockMovement.deleteMany();
      await tx.saleItem.deleteMany();
      await tx.sale.deleteMany();
      await tx.purchaseItem.deleteMany();
      await tx.purchase.deleteMany();
      await tx.warehouseStock.deleteMany();
      await tx.product.deleteMany();
      await tx.user.deleteMany();
      await tx.customer.deleteMany();
      await tx.supplier.deleteMany();
      await tx.warehouse.deleteMany();
      await tx.category.deleteMany();
      await tx.company.deleteMany();
      await tx.storeSetting.deleteMany();

      // Helper chunker for large table inserts
      const insertInBatches = async (table: any, items: any[], tableName: string) => {
        if (!items || items.length === 0) return;
        const chunkSize = 100;
        for (let i = 0; i < items.length; i += chunkSize) {
          const chunk = items.slice(i, i + chunkSize);
          await table.createMany({ data: chunk });
        }
        console.log(`Restored ${items.length} ${tableName}`);
      };

      // 2. Insert in dependency order
      console.log("\nRestoring records...");
      await insertInBatches(tx.storeSetting, data.storeSettings, "StoreSettings");
      await insertInBatches(tx.company, data.companies, "Companies");
      await insertInBatches(tx.category, data.categories, "Categories");
      await insertInBatches(tx.warehouse, data.warehouses, "Warehouses");
      await insertInBatches(tx.supplier, data.suppliers, "Suppliers");
      await insertInBatches(tx.customer, data.customers, "Customers");
      await insertInBatches(tx.user, data.users, "Users");
      await insertInBatches(tx.product, data.products, "Products");
      await insertInBatches(tx.warehouseStock, data.warehouseStocks, "WarehouseStocks");
      await insertInBatches(tx.purchase, data.purchases, "Purchases");
      await insertInBatches(tx.purchaseItem, data.purchaseItems, "PurchaseItems");
      await insertInBatches(tx.sale, data.sales, "Sales");
      await insertInBatches(tx.saleItem, data.saleItems, "SaleItems");
      await insertInBatches(tx.stockMovement, data.stockMovements, "StockMovements");
      await insertInBatches(tx.expense, data.expenses, "Expenses");
      await insertInBatches(tx.partyPayment, data.partyPayments, "PartyPayments");
      await insertInBatches(tx.auditLog, data.auditLogs, "AuditLogs");
    },
    {
      maxWait: 60000,
      timeout: 120000,
    }
  );

  console.log("\n==========================================");
  console.log("   DATABASE RESTORE COMPLETED SUCCESSFULLY! ");
  console.log("==========================================");
}

main()
  .catch((e) => {
    console.error("Failed to restore database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
