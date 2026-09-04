import { PrismaClient, Role, UserStatus, StockMovementType } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@inventory.local';
  const adminPassword = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdminInitialPassword123!';
  const adminName = process.env.SUPER_ADMIN_NAME || 'Super Admin';

  console.log(`Checking for Super Admin account (${adminEmail})...`);

  let superAdmin = await prisma.user.findFirst({
    where: {
      OR: [
        { email: adminEmail },
        { role: Role.SUPER_ADMIN }
      ]
    }
  });

  if (!superAdmin) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    superAdmin = await prisma.user.create({
      data: {
        name: adminName,
        email: adminEmail,
        passwordHash,
        role: Role.SUPER_ADMIN,
        status: UserStatus.ACTIVE,
        mustChangePassword: false,
      }
    });
    console.log(`Created default Super Admin (${adminEmail}).`);
  } else {
    console.log(`Super Admin already exists: ${superAdmin.email}`);
  }

  // Seed sample categories if none exist
  const categoryCount = await prisma.category.count();
  if (categoryCount === 0) {
    console.log('Seeding initial categories and sample products...');
    const catBeverages = await prisma.category.create({
      data: {
        name: 'Beverages',
        description: 'Drinks, juices, water, and teas',
        isActive: true,
      }
    });

    const catStationery = await prisma.category.create({
      data: {
        name: 'Office Stationery',
        description: 'Pens, paper, notebooks, folders',
        isActive: true,
      }
    });

    const catElectronics = await prisma.category.create({
      data: {
        name: 'Electronics & Accessories',
        description: 'Cables, chargers, adapters, peripherals',
        isActive: true,
      }
    });

    // Seed initial products
    const prod1 = await prisma.product.create({
      data: {
        name: 'Mineral Water 500ml',
        sku: 'BEV-WAT-001',
        categoryId: catBeverages.id,
        unit: 'bottle',
        costPrice: 15.00,
        sellingPrice: 25.00,
        quantity: 100,
        reorderLevel: 20,
        isActive: true,
      }
    });

    const prod2 = await prisma.product.create({
      data: {
        name: 'A4 Printing Paper (Ream)',
        sku: 'STA-PAP-001',
        categoryId: catStationery.id,
        unit: 'ream',
        costPrice: 350.00,
        sellingPrice: 480.00,
        quantity: 50,
        reorderLevel: 10,
        isActive: true,
      }
    });

    const prod3 = await prisma.product.create({
      data: {
        name: 'USB-C Fast Charging Cable',
        sku: 'ELE-CAB-001',
        categoryId: catElectronics.id,
        unit: 'piece',
        costPrice: 180.00,
        sellingPrice: 320.00,
        quantity: 40,
        reorderLevel: 8,
        isActive: true,
      }
    });

    // Record initial stock movements
    await prisma.stockMovement.createMany({
      data: [
        {
          productId: prod1.id,
          type: StockMovementType.OPENING_STOCK,
          quantityBefore: 0,
          quantityChange: 100,
          quantityAfter: 100,
          reason: 'Initial opening stock',
          performedById: superAdmin.id,
        },
        {
          productId: prod2.id,
          type: StockMovementType.OPENING_STOCK,
          quantityBefore: 0,
          quantityChange: 50,
          quantityAfter: 50,
          reason: 'Initial opening stock',
          performedById: superAdmin.id,
        },
        {
          productId: prod3.id,
          type: StockMovementType.OPENING_STOCK,
          quantityBefore: 0,
          quantityChange: 40,
          quantityAfter: 40,
          reason: 'Initial opening stock',
          performedById: superAdmin.id,
        },
      ]
    });

    console.log('Seeded initial categories, products, and opening stock movements.');
  }

  console.log('Seed completed successfully.');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
