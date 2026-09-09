import { PrismaClient, Role, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.SUPER_ADMIN_EMAIL || "admin@inventory.local";
  const adminPassword =
    process.env.SUPER_ADMIN_PASSWORD || "SuperAdminInitialPassword123!";
  const adminName = process.env.SUPER_ADMIN_NAME || "Super Admin";

  console.log(`Checking for Super Admin account (${adminEmail})...`);

  const superAdmin = await prisma.user.findFirst({
    where: {
      OR: [{ email: adminEmail }, { role: Role.SUPER_ADMIN }],
    },
  });

  if (!superAdmin) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await prisma.user.create({
      data: {
        name: adminName,
        email: adminEmail,
        passwordHash,
        role: Role.SUPER_ADMIN,
        status: UserStatus.ACTIVE,
        mustChangePassword: false,
      },
    });
    console.log(`Created default Super Admin (${adminEmail}).`);
  } else {
    console.log(`Super Admin already exists: ${superAdmin.email}`);
  }

  console.log("Seed completed successfully.");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
