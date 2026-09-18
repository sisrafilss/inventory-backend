import { PrismaClient, Role, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const adminUsername = process.env.SUPER_ADMIN_USERNAME || "superAdmin";
  const adminPassword = process.env.SUPER_ADMIN_PASSWORD || "superAdmin";
  const adminName = process.env.SUPER_ADMIN_NAME || "Super Admin";

  console.log("Checking for existing Super Admin account...");

  const existingSuperAdmin = await prisma.user.findFirst({
    where: {
      role: Role.SUPER_ADMIN,
    },
  });

  if (existingSuperAdmin) {
    console.log(
      `Super Admin already exists (username: ${existingSuperAdmin.username || "N/A"}, id: ${existingSuperAdmin.id}). Skipping seed to preserve custom credentials.`
    );
    console.log("Seed completed successfully (no changes made).");
    return;
  }

  const passwordHash = await bcrypt.hash(adminPassword, 10);
  const created = await prisma.user.create({
    data: {
      username: adminUsername,
      name: adminName,
      email: null,
      passwordHash,
      role: Role.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      mustChangePassword: false,
    },
  });

  console.log(
    `Created default Super Admin successfully (Username: ${created.username}, ID: ${created.id}).`
  );
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
