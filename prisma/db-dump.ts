import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log("==========================================");
  console.log("   DATABASE DUMP SCRIPT (JSON SNAPSHOT)   ");
  console.log("==========================================");

  const snapshotPath = path.join(process.cwd(), "prisma", "db-snapshot.json");

  console.log("Fetching database records...");

  const [
    storeSettings,
    companies,
    categories,
    warehouses,
    suppliers,
    customers,
    users,
    products,
    warehouseStocks,
    purchases,
    purchaseItems,
    sales,
    saleItems,
    stockMovements,
    expenses,
    partyPayments,
    auditLogs,
  ] = await Promise.all([
    prisma.storeSetting.findMany(),
    prisma.company.findMany(),
    prisma.category.findMany(),
    prisma.warehouse.findMany(),
    prisma.supplier.findMany(),
    prisma.customer.findMany(),
    prisma.user.findMany(),
    prisma.product.findMany(),
    prisma.warehouseStock.findMany(),
    prisma.purchase.findMany(),
    prisma.purchaseItem.findMany(),
    prisma.sale.findMany(),
    prisma.saleItem.findMany(),
    prisma.stockMovement.findMany(),
    prisma.expense.findMany(),
    prisma.partyPayment.findMany(),
    prisma.auditLog.findMany(),
  ]);

  const snapshot = {
    exportedAt: new Date().toISOString(),
    counts: {
      storeSettings: storeSettings.length,
      companies: companies.length,
      categories: categories.length,
      warehouses: warehouses.length,
      suppliers: suppliers.length,
      customers: customers.length,
      users: users.length,
      products: products.length,
      warehouseStocks: warehouseStocks.length,
      purchases: purchases.length,
      purchaseItems: purchaseItems.length,
      sales: sales.length,
      saleItems: saleItems.length,
      stockMovements: stockMovements.length,
      expenses: expenses.length,
      partyPayments: partyPayments.length,
      auditLogs: auditLogs.length,
    },
    data: {
      storeSettings,
      companies,
      categories,
      warehouses,
      suppliers,
      customers,
      users,
      products,
      warehouseStocks,
      purchases,
      purchaseItems,
      sales,
      saleItems,
      stockMovements,
      expenses,
      partyPayments,
      auditLogs,
    },
  };

  fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2), "utf-8");

  console.log(`\nSnapshot saved successfully to: ${snapshotPath}`);
  console.log("Records Summary:");
  Object.entries(snapshot.counts).forEach(([k, v]) => {
    console.log(`  - ${k}: ${v}`);
  });
  console.log("\nDump complete!");
}

main()
  .catch((e) => {
    console.error("Failed to dump database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
