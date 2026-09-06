import {
  PrismaClient,
  Role,
  UserStatus,
  StockMovementType,
  SaleStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { randomUUID } from "crypto";

dotenv.config();

const prisma = new PrismaClient();

// Helper to format currency decimals
const d = (num: number) => Number(num.toFixed(2));

async function main() {
  console.log("=========================================================");
  console.log("Starting High-Speed Bangladesh Realistic Seed (1000+ Items)");
  console.log("=========================================================");

  // 1. Ensure Super Admin Account
  const adminEmail = process.env.SUPER_ADMIN_EMAIL || "admin@inventory.local";
  const adminPassword =
    process.env.SUPER_ADMIN_PASSWORD || "SuperAdminInitialPassword123!";
  const adminName = process.env.SUPER_ADMIN_NAME || "Super Admin";

  let superAdmin = await prisma.user.findFirst({
    where: { OR: [{ email: adminEmail }, { role: Role.SUPER_ADMIN }] },
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
      },
    });
    console.log(`✓ Super Admin created: ${adminEmail}`);
  } else {
    console.log(`✓ Super Admin active: ${superAdmin.email}`);
  }

  // 2. Ensure Manager Account
  let manager = await prisma.user.findFirst({
    where: { email: "manager@inventory.local" },
  });
  if (!manager) {
    const managerHash = await bcrypt.hash("ManagerPass123!", 10);
    manager = await prisma.user.create({
      data: {
        name: "Rafiqul Islam (Manager)",
        email: "manager@inventory.local",
        passwordHash: managerHash,
        role: Role.MANAGER,
        status: UserStatus.ACTIVE,
        mustChangePassword: false,
      },
    });
    console.log(`✓ Branch Manager created: manager@inventory.local`);
  }

  // 3. Seed Companies (Conglomerates in Bangladesh)
  console.log("\nSeeding Bangladeshi Companies...");
  const companyData = [
    { name: "Square Consumer Products Ltd.", code: "SQUARE", description: "Radhuni, Ruchi, Chashi, Chopstick" },
    { name: "PRAN-RFL Group", code: "PRAN", description: "Pran Juice, Snacks, Spices, Confectionery" },
    { name: "ACI Consumer Brands", code: "ACI", description: "ACI Pure Flour, Salt, Spices, Savlon, Aerosol" },
    { name: "Akij Food & Beverage Ltd.", code: "AKIJ", description: "Mojo, Clemon, Speed, Frutika, Spa Water" },
    { name: "Meghna Group of Industries", code: "FRESH", description: "Fresh Soybean Oil, Atta, Salt, Sugar, Tissue" },
    { name: "City Group", code: "TEER", description: "Teer Soybean Oil, Atta, Maida, Suji, Mustard Oil" },
    { name: "Olympic Industries Ltd.", code: "OLYMPIC", description: "Energy Plus, Tip, Milk Marie, Hilux, Dry Cake" },
    { name: "Bashundhara Multi Food", code: "BASHUNDHARA", description: "Bashundhara Fortified Atta, Oil, Tissue, Paper" },
    { name: "Unilever Bangladesh Ltd.", code: "UNILEVER", description: "Lux, Lifebuoy, Surf Excel, Wheel, Vim, Knorr, Close Up" },
    { name: "Marico Bangladesh Ltd.", code: "MARICO", description: "Parachute Coconut Oil, Saffola, Mediker" },
    { name: "M.M. Ispahani Limited", code: "ISPAHANI", description: "Ispahani Mirzapore Tea, Blender's Choice, Biscuits" },
    { name: "Walton Digi-Tech Industries", code: "WALTON", description: "Walton Cables, LED Lights, Smart Plugs & IT Accessories" },
  ];

  const companies: Record<string, any> = {};
  for (const comp of companyData) {
    const record = await prisma.company.upsert({
      where: { name: comp.name },
      update: { code: comp.code, description: comp.description, isActive: true },
      create: { name: comp.name, code: comp.code, description: comp.description, isActive: true },
    });
    companies[comp.code] = record;
  }
  console.log(`✓ Seeded ${Object.keys(companies).length} companies.`);

  // 4. Seed Warehouses
  console.log("\nSeeding Bangladeshi Warehouses...");
  const warehouseData = [
    { name: "Dhaka Central Godown (Tejgaon)", code: "WH-DHK-01", address: "Plot 14, Tejgaon Industrial Area, Dhaka-1208", isDefault: true },
    { name: "Chattogram Port Depot (Agrabad)", code: "WH-CTG-01", address: "Agrabad Commercial Area, Chattogram", isDefault: false },
    { name: "Sylhet Regional Warehouse (Subidbazar)", code: "WH-SYL-01", address: "Subidbazar Main Road, Sylhet", isDefault: false },
    { name: "Bogura Wholesale Hub (Chawk Jadu)", code: "WH-BGR-01", address: "Chawk Jadu Road, Bogura-5800", isDefault: false },
    { name: "Rajshahi Godown (Baneswar Bazar)", code: "WH-RAJ-01", address: "Baneswar Bazar Highway, Rajshahi", isDefault: false },
    { name: "Khulna Divisional Depot (Khalishpur)", code: "WH-KHN-01", address: "Khalishpur Industrial Area, Khulna", isDefault: false },
  ];

  const warehouses: any[] = [];
  for (const wh of warehouseData) {
    const record = await prisma.warehouse.upsert({
      where: { name: wh.name },
      update: { code: wh.code, address: wh.address, isDefault: wh.isDefault, isActive: true },
      create: wh,
    });
    warehouses.push(record);
  }
  const defaultWarehouse = warehouses.find((w) => w.isDefault) || warehouses[0];
  console.log(`✓ Seeded ${warehouses.length} warehouses.`);

  // 5. Seed Categories
  console.log("\nSeeding Product Categories...");
  const categoryDefs = [
    { name: "Rice, Flour & Atta (চাল, আটা ও ময়দা)", key: "RICE_FLOUR", desc: "Miniket, Nazirshail, Aromatic Rice, Fortified Atta, Maida & Suji" },
    { name: "Edible Oils & Ghee (ভোজ্য তেল ও ঘি)", key: "OILS", desc: "Fortified Soybean Oil, Mustard Oil, Rice Bran Oil & Cow Ghee" },
    { name: "Spices, Masala & Salt (মসলা ও লবণ)", key: "SPICES", desc: "Turmeric, Chilli, Coriander, Cumin, Recipe Mixes & Vacuum Salt" },
    { name: "Dal & Pulses (ডাল ও কলাই)", key: "DAL", desc: "Masoor Dal, Moong Dal, Chana Dal, Booter Dal & Chickpeas" },
    { name: "Beverages & Drinks (পানীয় ও জুস)", key: "BEVERAGES", desc: "Mojo, Clemon, Speed, Fruit Juices, Drinking & Mineral Water" },
    { name: "Biscuits & Bakery (বিস্কুট ও বেকারি)", key: "BAKERY", desc: "Energy Plus, Toast, Dry Cake, Cookies, Chanachur & Wafers" },
    { name: "Noodles & Instant Food (নুডুলস ও ঝটপট খাবার)", key: "NOODLES", desc: "Maggi, Doodles, Egg Noodles, Pasta & Instant Soups" },
    { name: "Personal Care & Soaps (পার্সোনাল কেয়ার ও সাবান)", key: "PERSONAL_CARE", desc: "Beauty Soaps, Hair Oils, Shampoos, Toothpaste & Handwash" },
    { name: "Cleaning & Household (ক্লিনিং ও লন্ড্রি সামগ্রী)", key: "CLEANING", desc: "Washing Powder, Dishwash Bars, Toilet Cleaner & Bleach" },
    { name: "Dairy & Milk Powder (দুধ ও দুগ্ধজাত সামগ্রী)", key: "DAIRY", desc: "Full Cream Milk Powder, Liquid Milk, Condensed Milk & Butter" },
    { name: "Tea, Coffee & Health (চা, কফি ও হেলথ ড্রিংক)", key: "TEA_COFFEE", desc: "Mirzapore Leaf Tea, Green Tea, Instant Coffee & Malt Drinks" },
    { name: "Paper & Stationery (কাগজ ও স্টেশনারি)", key: "STATIONERY", desc: "A4 Printing Paper, Ballpoint Pens, Notebooks & Office Supplies" },
    { name: "Electrical & Home Goods (বৈদ্যুতিক পণ্য)", key: "ELECTRICAL", desc: "Energy-saving LED Bulbs, Extension Boards, Batteries & Cables" },
  ];

  const categories: Record<string, any> = {};
  for (const cat of categoryDefs) {
    const record = await prisma.category.upsert({
      where: { name: cat.name },
      update: { description: cat.desc, isActive: true },
      create: { name: cat.name, description: cat.desc, isActive: true },
    });
    categories[cat.key] = record;
  }
  console.log(`✓ Seeded ${Object.keys(categories).length} product categories.`);

  // 6. Generate 1000+ Products & Stocks in Batch
  console.log("\nGenerating 1000+ Products & Warehouse Allocations in High-Speed Batch...");

  interface ProductTemplate {
    categoryKey: string;
    companyCode: string;
    brandPrefix: string;
    baseName: string;
    unit: string;
    variants: Array<{
      subName: string;
      skuSuffix: string;
      cost: number;
      sell: number;
      qty: number;
      reorder: number;
    }>;
  }

  const templates: ProductTemplate[] = [
    {
      categoryKey: "RICE_FLOUR",
      companyCode: "FRESH",
      brandPrefix: "Fresh",
      baseName: "Fresh Premium Miniket Rice (মিনিকেট চাল)",
      unit: "kg",
      variants: [
        { subName: "1kg Poly Pack", skuSuffix: "MNK-1KG", cost: 68, sell: 75, qty: 350, reorder: 50 },
        { subName: "5kg Family Pack", skuSuffix: "MNK-5KG", cost: 335, sell: 370, qty: 220, reorder: 30 },
        { subName: "10kg Bag", skuSuffix: "MNK-10KG", cost: 660, sell: 730, qty: 150, reorder: 20 },
        { subName: "25kg Wholesale Sack", skuSuffix: "MNK-25KG", cost: 1625, sell: 1800, qty: 90, reorder: 15 },
        { subName: "50kg Master Sack", skuSuffix: "MNK-50KG", cost: 3200, sell: 3550, qty: 60, reorder: 10 },
      ],
    },
    {
      categoryKey: "RICE_FLOUR",
      companyCode: "TEER",
      brandPrefix: "Teer",
      baseName: "Teer Premium Nazirshail Rice (নাজিরশাইল চাল)",
      unit: "kg",
      variants: [
        { subName: "1kg Poly Pack", skuSuffix: "NZR-1KG", cost: 74, sell: 82, qty: 280, reorder: 40 },
        { subName: "5kg Family Pack", skuSuffix: "NZR-5KG", cost: 365, sell: 405, qty: 190, reorder: 25 },
        { subName: "25kg Sack", skuSuffix: "NZR-25KG", cost: 1780, sell: 1980, qty: 85, reorder: 15 },
        { subName: "50kg Master Sack", skuSuffix: "NZR-50KG", cost: 3500, sell: 3900, qty: 55, reorder: 10 },
      ],
    },
    {
      categoryKey: "RICE_FLOUR",
      companyCode: "SQUARE",
      brandPrefix: "Chashi",
      baseName: "Chashi Aromatic Chinigura Rice (সুগন্ধি চিনিগুঁড়া চাল)",
      unit: "kg",
      variants: [
        { subName: "500g Pack", skuSuffix: "CNG-500G", cost: 72, sell: 82, qty: 400, reorder: 60 },
        { subName: "1kg Poly Pack", skuSuffix: "CNG-1KG", cost: 138, sell: 155, qty: 320, reorder: 50 },
        { subName: "2kg Pack", skuSuffix: "CNG-2KG", cost: 270, sell: 305, qty: 180, reorder: 30 },
        { subName: "5kg Bucket", skuSuffix: "CNG-5KG", cost: 675, sell: 760, qty: 110, reorder: 20 },
      ],
    },
    {
      categoryKey: "RICE_FLOUR",
      companyCode: "TEER",
      brandPrefix: "Teer",
      baseName: "Teer Fortified Atta (আটা)",
      unit: "kg",
      variants: [
        { subName: "1kg Pack", skuSuffix: "ATT-1KG", cost: 48, sell: 55, qty: 500, reorder: 80 },
        { subName: "2kg Pack", skuSuffix: "ATT-2KG", cost: 95, sell: 108, qty: 380, reorder: 60 },
        { subName: "5kg Bag", skuSuffix: "ATT-5KG", cost: 235, sell: 265, qty: 240, reorder: 40 },
        { subName: "50kg Commercial Sack", skuSuffix: "ATT-50KG", cost: 2280, sell: 2550, qty: 70, reorder: 15 },
      ],
    },
    {
      categoryKey: "RICE_FLOUR",
      companyCode: "FRESH",
      brandPrefix: "Fresh",
      baseName: "Fresh Special Maida (ময়দা)",
      unit: "kg",
      variants: [
        { subName: "1kg Pack", skuSuffix: "MDA-1KG", cost: 58, sell: 65, qty: 420, reorder: 60 },
        { subName: "2kg Pack", skuSuffix: "MDA-2KG", cost: 112, sell: 128, qty: 290, reorder: 40 },
        { subName: "50kg Sack", skuSuffix: "MDA-50KG", cost: 2750, sell: 3100, qty: 50, reorder: 10 },
      ],
    },
    {
      categoryKey: "RICE_FLOUR",
      companyCode: "BASHUNDHARA",
      brandPrefix: "Bashundhara",
      baseName: "Bashundhara Roasted Suji (সুজি)",
      unit: "packet",
      variants: [
        { subName: "250g Pack", skuSuffix: "SUJ-250G", cost: 24, sell: 30, qty: 300, reorder: 40 },
        { subName: "500g Pack", skuSuffix: "SUJ-500G", cost: 45, sell: 55, qty: 260, reorder: 35 },
      ],
    },
    {
      categoryKey: "OILS",
      companyCode: "TEER",
      brandPrefix: "Teer",
      baseName: "Teer Fortified Soybean Oil (সয়াবিন তেল)",
      unit: "liter",
      variants: [
        { subName: "500ml Bottle", skuSuffix: "SOY-500ML", cost: 82, sell: 92, qty: 350, reorder: 50 },
        { subName: "1 Liter Bottle", skuSuffix: "SOY-1L", cost: 160, sell: 175, qty: 450, reorder: 60 },
        { subName: "2 Liter Bottle", skuSuffix: "SOY-2L", cost: 315, sell: 345, qty: 320, reorder: 45 },
        { subName: "3 Liter Can", skuSuffix: "SOY-3L", cost: 470, sell: 515, qty: 180, reorder: 30 },
        { subName: "5 Liter Can", skuSuffix: "SOY-5L", cost: 775, sell: 845, qty: 260, reorder: 40 },
        { subName: "8 Liter Jar", skuSuffix: "SOY-8L", cost: 1230, sell: 1345, qty: 110, reorder: 20 },
      ],
    },
    {
      categoryKey: "OILS",
      companyCode: "FRESH",
      brandPrefix: "Fresh",
      baseName: "Fresh Super Fortified Soybean Oil",
      unit: "liter",
      variants: [
        { subName: "500ml Bottle", skuSuffix: "FSOY-500ML", cost: 81, sell: 92, qty: 310, reorder: 40 },
        { subName: "1 Liter Bottle", skuSuffix: "FSOY-1L", cost: 159, sell: 175, qty: 420, reorder: 55 },
        { subName: "2 Liter Bottle", skuSuffix: "FSOY-2L", cost: 314, sell: 345, qty: 280, reorder: 40 },
        { subName: "5 Liter Can", skuSuffix: "FSOY-5L", cost: 770, sell: 845, qty: 240, reorder: 35 },
      ],
    },
    {
      categoryKey: "OILS",
      companyCode: "SQUARE",
      brandPrefix: "Radhuni",
      baseName: "Radhuni Pure Mustard Oil (খাঁটি সরিষার তেল)",
      unit: "bottle",
      variants: [
        { subName: "100ml Glass Bottle", skuSuffix: "MST-100ML", cost: 34, sell: 42, qty: 250, reorder: 35 },
        { subName: "250ml Glass Bottle", skuSuffix: "MST-250ML", cost: 78, sell: 92, qty: 280, reorder: 40 },
        { subName: "500ml Pet Bottle", skuSuffix: "MST-500ML", cost: 152, sell: 175, qty: 320, reorder: 45 },
        { subName: "1 Liter Pet Bottle", skuSuffix: "MST-1L", cost: 295, sell: 340, qty: 260, reorder: 35 },
        { subName: "2 Liter Can", skuSuffix: "MST-2L", cost: 580, sell: 665, qty: 140, reorder: 20 },
        { subName: "5 Liter Can", skuSuffix: "MST-5L", cost: 1430, sell: 1640, qty: 90, reorder: 15 },
      ],
    },
    {
      categoryKey: "OILS",
      companyCode: "PRAN",
      brandPrefix: "Pran",
      baseName: "Pran Premium Cow Ghee (খাঁটি গাভীর ঘি)",
      unit: "can",
      variants: [
        { subName: "100g Glass Jar", skuSuffix: "GHE-100G", cost: 145, sell: 175, qty: 190, reorder: 25 },
        { subName: "200g Jar", skuSuffix: "GHE-200G", cost: 280, sell: 335, qty: 160, reorder: 20 },
        { subName: "400g Tin Can", skuSuffix: "GHE-400G", cost: 540, sell: 645, qty: 130, reorder: 15 },
        { subName: "900g Master Tin", skuSuffix: "GHE-900G", cost: 1180, sell: 1390, qty: 85, reorder: 12 },
      ],
    },
    {
      categoryKey: "SPICES",
      companyCode: "SQUARE",
      brandPrefix: "Radhuni",
      baseName: "Radhuni Turmeric Powder (হলুদ গুঁড়া)",
      unit: "packet",
      variants: [
        { subName: "50g Pack", skuSuffix: "TUR-50G", cost: 22, sell: 28, qty: 450, reorder: 60 },
        { subName: "100g Pack", skuSuffix: "TUR-100G", cost: 41, sell: 50, qty: 520, reorder: 70 },
        { subName: "200g Pack", skuSuffix: "TUR-200G", cost: 79, sell: 95, qty: 410, reorder: 55 },
        { subName: "500g Jar", skuSuffix: "TUR-500G", cost: 190, sell: 230, qty: 220, reorder: 30 },
        { subName: "1kg Wholesale Foil", skuSuffix: "TUR-1KG", cost: 365, sell: 435, qty: 140, reorder: 20 },
      ],
    },
    {
      categoryKey: "SPICES",
      companyCode: "SQUARE",
      brandPrefix: "Radhuni",
      baseName: "Radhuni Chilli Powder (মরিচ গুঁড়া)",
      unit: "packet",
      variants: [
        { subName: "50g Pack", skuSuffix: "CHL-50G", cost: 25, sell: 32, qty: 430, reorder: 50 },
        { subName: "100g Pack", skuSuffix: "CHL-100G", cost: 48, sell: 60, qty: 480, reorder: 60 },
        { subName: "200g Pack", skuSuffix: "CHL-200G", cost: 92, sell: 115, qty: 370, reorder: 45 },
        { subName: "500g Pack", skuSuffix: "CHL-500G", cost: 220, sell: 270, qty: 190, reorder: 25 },
        { subName: "1kg Foil Pack", skuSuffix: "CHL-1KG", cost: 425, sell: 510, qty: 120, reorder: 15 },
      ],
    },
    {
      categoryKey: "SPICES",
      companyCode: "SQUARE",
      brandPrefix: "Radhuni",
      baseName: "Radhuni Coriander Powder (ধনিয়া গুঁড়া)",
      unit: "packet",
      variants: [
        { subName: "100g Pack", skuSuffix: "COR-100G", cost: 36, sell: 45, qty: 380, reorder: 45 },
        { subName: "200g Pack", skuSuffix: "COR-200G", cost: 68, sell: 85, qty: 310, reorder: 40 },
        { subName: "500g Pack", skuSuffix: "COR-500G", cost: 162, sell: 200, qty: 170, reorder: 25 },
      ],
    },
    {
      categoryKey: "SPICES",
      companyCode: "SQUARE",
      brandPrefix: "Radhuni",
      baseName: "Radhuni Cumin Powder (জিরা গুঁড়া)",
      unit: "packet",
      variants: [
        { subName: "50g Pack", skuSuffix: "CUM-50G", cost: 46, sell: 58, qty: 320, reorder: 40 },
        { subName: "100g Pack", skuSuffix: "CUM-100G", cost: 88, sell: 110, qty: 360, reorder: 45 },
        { subName: "200g Jar", skuSuffix: "CUM-200G", cost: 172, sell: 215, qty: 210, reorder: 30 },
      ],
    },
    {
      categoryKey: "SPICES",
      companyCode: "SQUARE",
      brandPrefix: "Radhuni",
      baseName: "Radhuni Special Recipe Masala Mix",
      unit: "box",
      variants: [
        { subName: "Biryani Masala 40g", skuSuffix: "REC-BRY-40G", cost: 58, sell: 70, qty: 450, reorder: 60 },
        { subName: "Mezbaani Beef Masala 50g", skuSuffix: "REC-MZB-50G", cost: 64, sell: 78, qty: 310, reorder: 40 },
        { subName: "Chicken Korma Masala 45g", skuSuffix: "REC-KRM-45G", cost: 56, sell: 68, qty: 290, reorder: 35 },
        { subName: "Kacchi Biryani Mix 50g", skuSuffix: "REC-KCH-50G", cost: 65, sell: 80, qty: 330, reorder: 40 },
        { subName: "Tehari Masala 45g", skuSuffix: "REC-TEH-45G", cost: 58, sell: 70, qty: 340, reorder: 45 },
        { subName: "Haleem Mix 200g Box", skuSuffix: "REC-HLM-200G", cost: 72, sell: 88, qty: 280, reorder: 35 },
        { subName: "Falooda Mix 150g Box", skuSuffix: "REC-FLD-150G", cost: 68, sell: 85, qty: 270, reorder: 35 },
        { subName: "Roast Masala 40g", skuSuffix: "REC-RST-40G", cost: 55, sell: 68, qty: 360, reorder: 45 },
        { subName: "Fish Curry Masala 50g", skuSuffix: "REC-FSH-50G", cost: 48, sell: 60, qty: 260, reorder: 30 },
      ],
    },
    {
      categoryKey: "SPICES",
      companyCode: "ACI",
      brandPrefix: "ACI Pure",
      baseName: "ACI Pure Vacuum Iodized Salt (লবণ)",
      unit: "packet",
      variants: [
        { subName: "500g Pack", skuSuffix: "SLT-500G", cost: 18, sell: 22, qty: 600, reorder: 90 },
        { subName: "1kg Premium Pack", skuSuffix: "SLT-1KG", cost: 34, sell: 42, qty: 750, reorder: 120 },
      ],
    },
    {
      categoryKey: "DAL",
      companyCode: "FRESH",
      brandPrefix: "Fresh",
      baseName: "Fresh Clean Masoor Dal (মসুর ডাল)",
      unit: "kg",
      variants: [
        { subName: "500g Pack (Small Grain / দেশি)", skuSuffix: "MSR-500G", cost: 68, sell: 78, qty: 380, reorder: 50 },
        { subName: "1kg Pack (Small Grain / দেশি)", skuSuffix: "MSR-1KG", cost: 132, sell: 150, qty: 460, reorder: 60 },
        { subName: "1kg Coarse Grain (মোটা মসুর)", skuSuffix: "MSR-MOTA-1KG", cost: 102, sell: 118, qty: 390, reorder: 50 },
        { subName: "25kg Sack (দেশি মসুর)", skuSuffix: "MSR-25KG", cost: 3200, sell: 3650, qty: 75, reorder: 15 },
      ],
    },
    {
      categoryKey: "BEVERAGES",
      companyCode: "AKIJ",
      brandPrefix: "Mojo",
      baseName: "Mojo Carbonated Cola (মোজো কোলা)",
      unit: "bottle",
      variants: [
        { subName: "250ml Pet Bottle", skuSuffix: "MOJ-250ML", cost: 16, sell: 20, qty: 600, reorder: 80 },
        { subName: "500ml Pet Bottle", skuSuffix: "MOJ-500ML", cost: 28, sell: 35, qty: 540, reorder: 70 },
        { subName: "1 Liter Bottle", skuSuffix: "MOJ-1L", cost: 52, sell: 65, qty: 380, reorder: 50 },
        { subName: "2 Liter Family Pack", skuSuffix: "MOJ-2L", cost: 88, sell: 110, qty: 260, reorder: 35 },
      ],
    },
    {
      categoryKey: "BEVERAGES",
      companyCode: "AKIJ",
      brandPrefix: "Clemon",
      baseName: "Clemon Clear Lemon Soda",
      unit: "bottle",
      variants: [
        { subName: "250ml Pet", skuSuffix: "CLM-250ML", cost: 16, sell: 20, qty: 450, reorder: 60 },
        { subName: "500ml Pet", skuSuffix: "CLM-500ML", cost: 28, sell: 35, qty: 480, reorder: 65 },
        { subName: "1 Liter Pet", skuSuffix: "CLM-1L", cost: 52, sell: 65, qty: 320, reorder: 40 },
        { subName: "2 Liter Bottle", skuSuffix: "CLM-2L", cost: 88, sell: 110, qty: 210, reorder: 30 },
      ],
    },
    {
      categoryKey: "BEVERAGES",
      companyCode: "AKIJ",
      brandPrefix: "Speed",
      baseName: "Speed Heavy Carbonated Energy Drink",
      unit: "can",
      variants: [
        { subName: "250ml Pet Bottle", skuSuffix: "SPD-250ML", cost: 24, sell: 30, qty: 650, reorder: 90 },
        { subName: "250ml Sleek Can", skuSuffix: "SPD-CAN-250ML", cost: 38, sell: 50, qty: 400, reorder: 60 },
      ],
    },
    {
      categoryKey: "BAKERY",
      companyCode: "OLYMPIC",
      brandPrefix: "Olympic",
      baseName: "Olympic Energy Plus Glucose Biscuit",
      unit: "packet",
      variants: [
        { subName: "Single Mini Pack (৳10)", skuSuffix: "EGY-10TK", cost: 8, sell: 10, qty: 950, reorder: 150 },
        { subName: "Regular Pack (৳25)", skuSuffix: "EGY-25TK", cost: 20, sell: 25, qty: 720, reorder: 100 },
        { subName: "Family Box Pack (৳60)", skuSuffix: "EGY-60TK", cost: 48, sell: 60, qty: 430, reorder: 60 },
        { subName: "Mega Jar Pack", skuSuffix: "EGY-JAR", cost: 195, sell: 240, qty: 150, reorder: 25 },
      ],
    },
    {
      categoryKey: "NOODLES",
      companyCode: "UNILEVER",
      brandPrefix: "Maggi",
      baseName: "Maggi 2-Minute Masala Noodles (ম্যাগি নুডুলস)",
      unit: "packet",
      variants: [
        { subName: "Single Pack 62g", skuSuffix: "MAG-SGL", cost: 17, sell: 22, qty: 850, reorder: 120 },
        { subName: "4-in-1 Value Pack 248g", skuSuffix: "MAG-4IN1", cost: 68, sell: 85, qty: 540, reorder: 80 },
        { subName: "8-in-1 Mega Pack 496g", skuSuffix: "MAG-8IN1", cost: 132, sell: 165, qty: 380, reorder: 55 },
        { subName: "12-in-1 Master Carton", skuSuffix: "MAG-12IN1", cost: 198, sell: 245, qty: 250, reorder: 35 },
      ],
    },
    {
      categoryKey: "PERSONAL_CARE",
      companyCode: "UNILEVER",
      brandPrefix: "Lux",
      baseName: "Lux Soft Rose Velvet Beauty Soap",
      unit: "piece",
      variants: [
        { subName: "75g Regular Bar", skuSuffix: "LUX-75G", cost: 38, sell: 48, qty: 650, reorder: 90 },
        { subName: "100g Medium Bar", skuSuffix: "LUX-100G", cost: 48, sell: 60, qty: 580, reorder: 80 },
        { subName: "150g Jumbo Bar", skuSuffix: "LUX-150G", cost: 68, sell: 85, qty: 390, reorder: 55 },
        { subName: "3-in-1 Saver Pack", skuSuffix: "LUX-3IN1", cost: 135, sell: 165, qty: 280, reorder: 40 },
      ],
    },
    {
      categoryKey: "CLEANING",
      companyCode: "UNILEVER",
      brandPrefix: "Wheel",
      baseName: "Wheel 2-in-1 Clean & Fresh Washing Powder",
      unit: "packet",
      variants: [
        { subName: "200g Pack", skuSuffix: "WHL-200G", cost: 24, sell: 30, qty: 750, reorder: 100 },
        { subName: "500g Pack", skuSuffix: "WHL-500G", cost: 58, sell: 70, qty: 620, reorder: 85 },
        { subName: "1kg Regular Pack", skuSuffix: "WHL-1KG", cost: 110, sell: 130, qty: 540, reorder: 75 },
        { subName: "2kg Economy Bag", skuSuffix: "WHL-2KG", cost: 215, sell: 255, qty: 320, reorder: 45 },
      ],
    },
    {
      categoryKey: "DAIRY",
      companyCode: "FRESH",
      brandPrefix: "Fresh",
      baseName: "Fresh Full Cream Instant Milk Powder (দুধ পাউডার)",
      unit: "packet",
      variants: [
        { subName: "200g Poly Pack", skuSuffix: "MLK-200G", cost: 158, sell: 185, qty: 380, reorder: 50 },
        { subName: "500g Poly Pack", skuSuffix: "MLK-500G", cost: 395, sell: 455, qty: 340, reorder: 45 },
        { subName: "1kg Foil Pack", skuSuffix: "MLK-1KG", cost: 775, sell: 890, qty: 260, reorder: 35 },
      ],
    },
    {
      categoryKey: "TEA_COFFEE",
      companyCode: "ISPAHANI",
      brandPrefix: "Ispahani",
      baseName: "Ispahani Mirzapore Best Leaf Black Tea (চা পাতা)",
      unit: "packet",
      variants: [
        { subName: "50g Pack", skuSuffix: "TEA-50G", cost: 28, sell: 35, qty: 620, reorder: 85 },
        { subName: "100g Pack", skuSuffix: "TEA-100G", cost: 52, sell: 65, qty: 560, reorder: 75 },
        { subName: "200g Pack", skuSuffix: "TEA-200G", cost: 102, sell: 125, qty: 480, reorder: 65 },
        { subName: "400g Foil Pack", skuSuffix: "TEA-400G", cost: 198, sell: 240, qty: 380, reorder: 50 },
      ],
    },
    {
      categoryKey: "STATIONERY",
      companyCode: "BASHUNDHARA",
      brandPrefix: "Bashundhara",
      baseName: "Bashundhara Multipurpose A4 Printing Paper",
      unit: "ream",
      variants: [
        { subName: "A4 70 GSM (500 Sheets)", skuSuffix: "PAP-70GSM", cost: 360, sell: 420, qty: 280, reorder: 40 },
        { subName: "A4 80 GSM Premium (500 Sheets)", skuSuffix: "PAP-80GSM", cost: 420, sell: 495, qty: 340, reorder: 50 },
      ],
    },
    {
      categoryKey: "ELECTRICAL",
      companyCode: "WALTON",
      brandPrefix: "Walton",
      baseName: "Walton High Efficiency LED Bulb (বি-২২ পিন)",
      unit: "piece",
      variants: [
        { subName: "9 Watt Day Light", skuSuffix: "LED-9W-DL", cost: 110, sell: 155, qty: 490, reorder: 65 },
        { subName: "12 Watt Day Light", skuSuffix: "LED-12W-DL", cost: 140, sell: 195, qty: 420, reorder: 55 },
        { subName: "18 Watt Bright Star", skuSuffix: "LED-18W-DL", cost: 230, sell: 320, qty: 210, reorder: 30 },
      ],
    },
  ];

  const subCategoryModifiers = [
    { tag: "Regular Grade", codeTag: "RG", costMul: 1.0, sellMul: 1.0 },
    { tag: "Export Quality", codeTag: "EQ", costMul: 1.08, sellMul: 1.1 },
    { tag: "Economy Saver", codeTag: "EC", costMul: 0.94, sellMul: 0.95 },
    { tag: "Family Deal", codeTag: "FD", costMul: 0.98, sellMul: 1.0 },
  ];

  const productsToInsert: any[] = [];
  const stocksToInsert: any[] = [];
  let barcodeCounter = 894100000000;
  let totalCatalogCount = 0;

  for (const tpl of templates) {
    const cat = categories[tpl.categoryKey];
    const comp = companies[tpl.companyCode];

    for (const v of tpl.variants) {
      for (const mod of subCategoryModifiers) {
        barcodeCounter++;
        totalCatalogCount++;

        const prodId = randomUUID();
        const productName = `${tpl.baseName} - ${v.subName} [${mod.tag}]`;
        const sku = `${tpl.brandPrefix.slice(0, 3).toUpperCase()}-${v.skuSuffix}-${mod.codeTag}`;
        const barcode = barcodeCounter.toString();
        const costPrice = d(v.cost * mod.costMul);
        const sellingPrice = d(v.sell * mod.sellMul);
        const dpRate = d(costPrice * 0.96);
        const totalQty = Math.round(v.qty * (0.8 + (totalCatalogCount % 5) * 0.1));

        productsToInsert.push({
          id: prodId,
          name: productName,
          sku,
          barcode,
          categoryId: cat.id,
          companyId: comp.id,
          unit: tpl.unit,
          costPrice,
          sellingPrice,
          dpRate,
          quantity: totalQty,
          reorderLevel: v.reorder,
          isActive: true,
        });

        const shareDhaka = Math.round(totalQty * 0.50);
        const shareChittagong = Math.round(totalQty * 0.25);
        const shareSylhet = Math.round(totalQty * 0.15);
        const shareOther = totalQty - (shareDhaka + shareChittagong + shareSylhet);

        stocksToInsert.push(
          { id: randomUUID(), warehouseId: warehouses[0].id, productId: prodId, quantity: shareDhaka },
          { id: randomUUID(), warehouseId: warehouses[1].id, productId: prodId, quantity: shareChittagong },
          { id: randomUUID(), warehouseId: warehouses[2].id, productId: prodId, quantity: shareSylhet },
          { id: randomUUID(), warehouseId: warehouses[3].id, productId: prodId, quantity: shareOther }
        );
      }
    }
  }

  // Generate extended grocery items to reach ~1,020 items
  const spiceSeries = [
    "Kalojeera (কালোজিরা)", "Methi (মেথি)", "Radhuni Radhuni (রাঁধুনি)", "Mustard Seed (সরিষা দানা)",
    "Fennel Seed (মৌরি)", "Ajwain (জোয়ান)", "Cardamom Green (ছোট এলাচ)", "Cardamom Black (বড় এলাচ)",
    "Cinnamon Stick (দারুচিনি)", "Clove (লবঙ্গ)", "Bay Leaves (তেজপাতা)", "Star Anise (স্টার অ্যানিস)",
    "Mace (জয়ত্রী)", "Nutmeg (জায়ফল)", "Black Pepper (গোলমরিচ গুঁড়া)", "White Pepper (সাদা গোলমরিচ)",
    "Chili Flakes (চিলি ফ্লেক্স)", "Chat Masala (চাট মসলা)", "Tandoori Masala", "Tikka Boti Masala",
    "Jorda Color (জর্দা রং)", "Baking Powder", "Baking Soda", "Custard Powder (ভ্যানিলা)",
    "Corn Flour (ভুট্টার আটা)", "Instant Yeast", "Rose Water (গোলাপ জল)", "Kewra Water (কেওড়া জল)",
  ];

  const confectionBrands = ["Pran", "Olympic", "Fresh", "Akij", "Square", "Teer", "ACI", "Bashundhara"];
  const confectionUnits = ["50g", "100g", "200g", "500g"];

  for (const spice of spiceSeries) {
    for (const b of confectionBrands) {
      for (const u of confectionUnits) {
        if (totalCatalogCount >= 1025) break;
        barcodeCounter++;
        totalCatalogCount++;

        const prodId = randomUUID();
        const comp = companies[b.toUpperCase()] || companies["SQUARE"];
        const cat = categories["SPICES"];
        const sku = `SPC-${spice.slice(0, 3).toUpperCase()}-${b.slice(0, 3).toUpperCase()}-${u}-${totalCatalogCount}`;
        const costPrice = 30 + (totalCatalogCount % 40) * 3;
        const sellingPrice = d(costPrice * 1.25);
        const qty = 150 + (totalCatalogCount % 200);

        productsToInsert.push({
          id: prodId,
          name: `${b} Pure ${spice} - ${u} Pack`,
          sku,
          barcode: barcodeCounter.toString(),
          categoryId: cat.id,
          companyId: comp.id,
          unit: "packet",
          costPrice,
          sellingPrice,
          dpRate: d(costPrice * 0.95),
          quantity: qty,
          reorderLevel: 25,
          isActive: true,
        });

        stocksToInsert.push(
          { id: randomUUID(), warehouseId: warehouses[0].id, productId: prodId, quantity: Math.round(qty * 0.6) },
          { id: randomUUID(), warehouseId: warehouses[1].id, productId: prodId, quantity: Math.round(qty * 0.4) }
        );
      }
    }
  }

  // Clean up old transactions and products to ensure consistent IDs
  console.log("\nCleaning up old placeholder transactions and test products...");
  await prisma.saleItem.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.purchaseItem.deleteMany();
  await prisma.purchase.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.warehouseStock.deleteMany();
  await prisma.product.deleteMany();
  console.log("✓ Ready for fresh catalog insertion.");

  // Insert in chunks of 250 for speed and safety
  console.log(`Inserting ${productsToInsert.length} products in batch...`);
  for (let i = 0; i < productsToInsert.length; i += 250) {
    const chunk = productsToInsert.slice(i, i + 250);
    await prisma.product.createMany({ data: chunk, skipDuplicates: true });
    console.log(`  .. Inserted product batch ${i + 1} to ${Math.min(i + 250, productsToInsert.length)}`);
  }

  console.log(`Inserting ${stocksToInsert.length} warehouse stock entries in batch...`);
  for (let i = 0; i < stocksToInsert.length; i += 500) {
    const chunk = stocksToInsert.slice(i, i + 500);
    await prisma.warehouseStock.createMany({ data: chunk, skipDuplicates: true });
    console.log(`  .. Inserted stock batch ${i + 1} to ${Math.min(i + 500, stocksToInsert.length)}`);
  }

  console.log(`✓ Total Products seeded: ${productsToInsert.length} items!`);

  // 7. Seed Authentic Bangladeshi Customers
  console.log("\nSeeding 25 Bangladeshi Retail & Wholesale Customers...");
  const customerList = [
    { name: "Al-Madina General Store", phone: "01711-234567", address: "Chawkbazar Main Road, Dhaka", openingDue: 25000, currentDue: 34500 },
    { name: "Bismillah Departmental Store", phone: "01819-345678", address: "Plot 12, Mirpur-10, Dhaka", openingDue: 12000, currentDue: 18200 },
    { name: "Rahman & Brothers Grocery", phone: "01912-456789", address: "Khatunganj Wholesale Hub, Chattogram", openingDue: 45000, currentDue: 58900 },
    { name: "Maa Moni Departmental Store", phone: "01720-567890", address: "Road 27, Dhanmondi, Dhaka", openingDue: 8000, currentDue: 12400 },
    { name: "Shahjalal Store", phone: "01715-678901", address: "Bandarbazar, Sylhet", openingDue: 15000, currentDue: 21800 },
    { name: "Haji Ismail & Sons", phone: "01817-789012", address: "Chawk Jadu Market, Bogura", openingDue: 35000, currentDue: 42300 },
    { name: "Popular Super Shop", phone: "01914-890123", address: "Sector 7, Uttara, Dhaka", openingDue: 0, currentDue: 8500 },
    { name: "Bhai Bhai Enterprise", phone: "01675-901234", address: "Shaheb Bazar, Rajshahi", openingDue: 18000, currentDue: 26400 },
    { name: "Mayer Doa General Store", phone: "01732-012345", address: "Daulatpur Bazar, Khulna", openingDue: 9000, currentDue: 14700 },
    { name: "Khandakar Enterprise", phone: "01811-123456", address: "Gulshan-2 Circle, Dhaka", openingDue: 5000, currentDue: 9800 },
    { name: "Janata Traders", phone: "01918-234567", address: "Pahartali Rail Gate, Chattogram", openingDue: 22000, currentDue: 31200 },
    { name: "New Dhaka Store", phone: "01680-345678", address: "Elephant Road, Dhaka", openingDue: 0, currentDue: 4600 },
    { name: "Sonali Grocery Corner", phone: "01718-456789", address: "Town Hall Bazar, Mohammadpur, Dhaka", openingDue: 14000, currentDue: 19800 },
    { name: "Rupali Super Shop", phone: "01822-567890", address: "Agrabad Access Road, Chattogram", openingDue: 6000, currentDue: 11500 },
    { name: "Barisal Commercial Store", phone: "01925-678901", address: "Chowmatha Bazar, Barishal", openingDue: 16000, currentDue: 24300 },
    { name: "Green Valley Super Market", phone: "01740-789012", address: "Banani 11, Dhaka", openingDue: 0, currentDue: 7200 },
    { name: "Haji Danesh Traders", phone: "01830-890123", address: "Bahadur Bazar, Dinajpur", openingDue: 28000, currentDue: 36700 },
    { name: "Comilla Central Grocery", phone: "01935-901234", address: "Kandirpar, Cumilla", openingDue: 11000, currentDue: 16500 },
    { name: "Narayanganj Wholesale Mart", phone: "01690-012345", address: "Netaiganj Wholesale Hub, Narayanganj", openingDue: 55000, currentDue: 72400 },
    { name: "Sufia Departmental Store", phone: "01755-123456", address: "Kazir Dewri, Chattogram", openingDue: 7500, currentDue: 13200 },
    { name: "Haji Noor Mohammad Store", phone: "01844-234567", address: "Badamtoli Ghat, Sadarghat, Dhaka", openingDue: 38000, currentDue: 49800 },
    { name: "Padma General Store", phone: "01948-345678", address: "Gualundo Ghat, Rajbari", openingDue: 8500, currentDue: 12900 },
    { name: "Anwar Brothers Store", phone: "01660-456789", address: "Gausia Market, Bhulta, Narayanganj", openingDue: 20000, currentDue: 29500 },
    { name: "Meghna Mini Mart", phone: "01762-567890", address: "Daudkandi Toll Plaza, Cumilla", openingDue: 4000, currentDue: 6500 },
    { name: "Al-Falah Super Shop", phone: "01850-678901", address: "Banasree Block C, Dhaka", openingDue: 0, currentDue: 5300 },
  ];

  const customers: any[] = [];
  for (const c of customerList) {
    const existing = await prisma.customer.findFirst({ where: { phone: c.phone } });
    if (existing) {
      const updated = await prisma.customer.update({
        where: { id: existing.id },
        data: { name: c.name, address: c.address, openingDue: c.openingDue, currentDue: c.currentDue },
      });
      customers.push(updated);
    } else {
      const created = await prisma.customer.create({
        data: {
          name: c.name,
          phone: c.phone,
          address: c.address,
          openingDue: c.openingDue,
          currentDue: c.currentDue,
          isActive: true,
        },
      });
      customers.push(created);
    }
  }
  console.log(`✓ Seeded ${customers.length} retail and wholesale customers.`);

  // 8. Seed Authorized Suppliers
  console.log("\nSeeding Authorized Suppliers & Distributors...");
  const supplierList = [
    { name: "Square Consumer Products Ltd. (Central Depot)", companyName: "Square Group", phone: "01713-001122", email: "sales.depot@squaregroup.com", address: "Square Centre, 48 Mohakhali C/A, Dhaka", currentDue: 85000 },
    { name: "PRAN-RFL Sales & Distribution Centre", companyName: "PRAN-RFL", phone: "01819-112233", email: "pran.distribution@prangroup.com", address: "PRAN RFL Centre, Middle Badda, Dhaka", currentDue: 120000 },
    { name: "Meghna Distributing Agency (Fresh Brand)", companyName: "Meghna Group", phone: "01911-223344", email: "fresh.dist@mgi.org", address: "Fresh Villa, House 15, Road 34, Gulshan-1, Dhaka", currentDue: 94000 },
    { name: "City Group Wholesale Supply Division", companyName: "City Group", phone: "01711-334455", email: "teer.sales@citygroup.com.bd", address: "City Seed Crushing Mills, Nitaiganj, Narayanganj", currentDue: 145000 },
    { name: "Olympic Industries Central Logistics", companyName: "Olympic Industries", phone: "01817-445566", email: "supply@olympicbd.com", address: "Amin Court, 6th Floor, 62-63 Motijheel C/A, Dhaka", currentDue: 62000 },
    { name: "Akij Beverage Supply Center", companyName: "Akij Group", phone: "01914-556677", email: "beverage.hub@akij.net", address: "Akij House, 198 Bir Uttam Mir Shawkat Sarak, Tejgaon, Dhaka", currentDue: 78000 },
    { name: "ACI Logistics & Pure Foods Hub", companyName: "ACI Limited", phone: "01675-667788", email: "purefoods@aci-bd.com", address: "ACI Centre, 245 Tejgaon Industrial Area, Dhaka", currentDue: 110000 },
    { name: "Unilever Bangladesh Authorized Agency", companyName: "Unilever BD", phone: "01720-778899", email: "consumer.dist@unilever.com", address: "ZN Tower, Plot 2, Road 8, Gulshan-1, Dhaka", currentDue: 165000 },
    { name: "Bashundhara Paper & Hygiene Supplies", companyName: "Bashundhara Group", phone: "01811-889900", email: "paper.tissue@bgd.com", address: "Bashundhara Industrial HQ, Baridhara, Dhaka", currentDue: 53000 },
    { name: "Marico Bangladesh Supply Depot", companyName: "Marico BD", phone: "01918-990011", email: "marico.depot@marico.com", address: "The Glass House, SE(B)-2, 38 Gulshan Avenue, Dhaka", currentDue: 47000 },
    { name: "Ispahani Tea Distribution Depot", companyName: "M.M. Ispahani", phone: "01715-102030", email: "tea.trade@ispahanibd.com", address: "Ispahani Building, Sk. Mujib Road, Agrabad, Chattogram", currentDue: 38000 },
    { name: "Walton Commercial Electronics Hub", companyName: "Walton Digi-Tech", phone: "01822-203040", email: "corporate.lighting@waltonbd.com", address: "Chandra, Gazipur / Walton Complex, Motijheel, Dhaka", currentDue: 82000 },
  ];

  const suppliers: any[] = [];
  for (const s of supplierList) {
    const existing = await prisma.supplier.findFirst({ where: { phone: s.phone } });
    if (existing) {
      const updated = await prisma.supplier.update({
        where: { id: existing.id },
        data: { name: s.name, companyName: s.companyName, email: s.email, address: s.address, currentDue: s.currentDue },
      });
      suppliers.push(updated);
    } else {
      const created = await prisma.supplier.create({
        data: {
          name: s.name,
          companyName: s.companyName,
          phone: s.phone,
          email: s.email,
          address: s.address,
          openingDue: s.currentDue * 0.5,
          currentDue: s.currentDue,
          isActive: true,
        },
      });
      suppliers.push(created);
    }
  }
  console.log(`✓ Seeded ${suppliers.length} authorized wholesale suppliers.`);

  // 9. Seed Purchases & Stock Movements
  console.log("\nSeeding past Purchases & Inbound Receipts...");
  const purchaseCount = await prisma.purchase.count();
  if (purchaseCount < 20) {
    for (let i = 1; i <= 20; i++) {
      const sup = suppliers[i % suppliers.length];
      const wh = warehouses[i % warehouses.length];
      const invNum = `PO-2026-${(1000 + i).toString()}`;

      const pCount = 3 + (i % 3);
      const chosen = productsToInsert.slice((i * 12) % (productsToInsert.length - 10), (i * 12) % (productsToInsert.length - 10) + pCount);

      let totalAmount = 0;
      const purchaseItemsData = chosen.map((prod) => {
        const qty = 25 + (i * 5) % 50;
        const dpRate = prod.costPrice;
        const lineTotal = d(dpRate * qty);
        totalAmount += lineTotal;
        return {
          productId: prod.id,
          warehouseId: wh.id,
          quantity: qty,
          dpRate,
          commissionPercent: 0,
          purchaseRate: dpRate,
          lineTotal,
        };
      });

      const isCredit = i % 3 === 0;
      const paidAmount = isCredit ? d(totalAmount * 0.4) : totalAmount;
      const dueAmount = d(totalAmount - paidAmount);
      const createdAt = new Date(Date.now() - (60 - i * 2.5) * 24 * 60 * 60 * 1000);

      const purchase = await prisma.purchase.create({
        data: {
          invoiceNumber: invNum,
          supplierId: sup.id,
          supplierName: sup.name,
          paymentType: isCredit ? "SUPPLIER" : "CASH",
          totalAmount,
          paidAmount,
          dueAmount,
          note: `Regular stock receipt from ${sup.companyName || sup.name}`,
          createdById: superAdmin.id,
          createdAt,
          items: {
            create: purchaseItemsData,
          },
        },
      });

      // Stock movements batch
      const smData = purchaseItemsData.map((item) => ({
        productId: item.productId,
        type: StockMovementType.RESTOCK,
        quantityBefore: 50,
        quantityChange: item.quantity,
        quantityAfter: 50 + item.quantity,
        referenceType: "PURCHASE",
        referenceId: purchase.id,
        reason: `Procured via invoice ${invNum}`,
        performedById: superAdmin.id,
        createdAt,
      }));
      await prisma.stockMovement.createMany({ data: smData });
    }
    console.log(`✓ Seeded 20 past purchase receipts with stock movements.`);
  }

  // 10. Seed Realistic Sales Transactions (Past 45 Days)
  console.log("\nSeeding realistic past Sales invoices & POS receipts...");
  const saleCount = await prisma.sale.count();
  if (saleCount < 40) {
    for (let i = 1; i <= 35; i++) {
      const isRegistered = i % 4 !== 0;
      const cust = isRegistered ? customers[i % customers.length] : null;
      const wh = warehouses[i % warehouses.length];
      const refNumber = `INV-2026-${(2000 + i).toString()}`;

      const pCount = 2 + (i % 4);
      const chosen = productsToInsert.slice((i * 15 + 7) % (productsToInsert.length - 10), (i * 15 + 7) % (productsToInsert.length - 10) + pCount);

      let totalAmount = 0;
      const saleItemsData = chosen.map((prod) => {
        const qty = 1 + (i % 8);
        const unitPrice = prod.sellingPrice;
        const lineTotal = d(unitPrice * qty);
        totalAmount += lineTotal;
        return {
          productId: prod.id,
          warehouseId: wh.id,
          quantity: qty,
          purchaseCost: prod.costPrice,
          unitPrice,
          lineTotal,
        };
      });

      const isCredit = isRegistered && i % 3 === 0;
      const paidAmount = isCredit ? d(totalAmount * 0.5) : totalAmount;
      const dueAmount = d(totalAmount - paidAmount);
      const createdAt = new Date(Date.now() - (45 - i * 1.2) * 24 * 60 * 60 * 1000);

      const sale = await prisma.sale.create({
        data: {
          referenceNumber: refNumber,
          createdById: i % 2 === 0 ? superAdmin.id : manager.id,
          customerId: cust ? cust.id : undefined,
          customerName: cust ? cust.name : "Walk-in Retail Customer",
          customerPhone: cust ? cust.phone : "01700-000000",
          warehouseId: wh.id,
          status: SaleStatus.COMPLETED,
          paymentType: isCredit ? "CREDIT" : "CASH",
          totalAmount,
          paidAmount,
          dueAmount,
          note: isCredit ? `Credit sale due recorded for ${cust?.name}` : "Cash settlement at billing counter",
          createdAt,
          items: {
            create: saleItemsData,
          },
        },
      });

      const smData = saleItemsData.map((item) => ({
        productId: item.productId,
        type: StockMovementType.SALE_DEDUCTION,
        quantityBefore: 100,
        quantityChange: -item.quantity,
        quantityAfter: 100 - item.quantity,
        referenceType: "SALE",
        referenceId: sale.id,
        reason: `Billed in invoice ${refNumber}`,
        performedById: i % 2 === 0 ? superAdmin.id : manager.id,
        createdAt,
      }));
      await prisma.stockMovement.createMany({ data: smData });
    }
    console.log(`✓ Seeded 35 realistic sales invoices with full line items.`);
  }

  // 11. Seed Realistic Operational Expenses
  console.log("\nSeeding realistic operating expenses...");
  const expenseCount = await prisma.expense.count();
  if (expenseCount < 15) {
    const expenseList = [
      { title: "Tejgaon Central Godown Monthly Rent - July", category: "RENT", amount: 45000, daysAgo: 45 },
      { title: "Godown DESCO Electricity Bill - July", category: "UTILITY", amount: 14200, daysAgo: 42 },
      { title: "Night Guard & Security Personnel Monthly Salary", category: "SALARY", amount: 28000, daysAgo: 40 },
      { title: "Truck Transport & Coolie Loading Charges (Chattogram Shipment)", category: "LOGISTICS", amount: 16500, daysAgo: 38 },
      { title: "Corrugated Paper Packaging Cartons & Gum Tape", category: "PACKAGING", amount: 8500, daysAgo: 35 },
      { title: "Backup Generator Diesel Fuel (60 Liters)", category: "FUEL", amount: 6600, daysAgo: 32 },
      { title: "Staff Tea, Snacks & Customer Entertainment", category: "ENTERTAINMENT", amount: 4200, daysAgo: 28 },
      { title: "Delivery Van Engine Oil & Brake Shoe Replacement", category: "MAINTENANCE", amount: 7800, daysAgo: 25 },
      { title: "Tejgaon Central Godown Monthly Rent - August", category: "RENT", amount: 45000, daysAgo: 15 },
      { title: "Godown Electricity Bill - August", category: "UTILITY", amount: 15600, daysAgo: 12 },
      { title: "High-speed Internet & CCTV Cloud Storage Subscription", category: "UTILITY", amount: 3500, daysAgo: 10 },
      { title: "Staff Monthly Conveyance & Refreshments", category: "ENTERTAINMENT", amount: 5400, daysAgo: 7 },
      { title: "Local Delivery Van Road Permit & Fitness Renewal", category: "TAX_FEE", amount: 12500, daysAgo: 4 },
      { title: "Godown Pest Control & Sanitization Service", category: "MAINTENANCE", amount: 4800, daysAgo: 2 },
    ];

    for (const exp of expenseList) {
      await prisma.expense.create({
        data: {
          title: exp.title,
          category: exp.category,
          amount: exp.amount,
          date: new Date(Date.now() - exp.daysAgo * 24 * 60 * 60 * 1000),
          createdById: superAdmin.id,
        },
      });
    }
    console.log(`✓ Seeded ${expenseList.length} operational expenses.`);
  }

  // 12. Seed Audit Logs
  console.log("\nSeeding realistic Audit Logs...");
  const auditCount = await prisma.auditLog.count();
  if (auditCount < 25) {
    const actions = [
      { action: "PRODUCT_CREATED", entityType: "Product", metadata: { note: "Catalog SKU initialized" } },
      { action: "PURCHASE_CONFIRMED", entityType: "Purchase", metadata: { status: "RECEIVED", warehouse: "Dhaka Central Godown" } },
      { action: "SALE_COMPLETED", entityType: "Sale", metadata: { method: "CASH", counter: "Counter 1" } },
      { action: "STOCK_ADJUSTED", entityType: "WarehouseStock", metadata: { reason: "Routine physical stock verification" } },
      { action: "SUPPLIER_PAYMENT", entityType: "PartyPayment", metadata: { method: "BANK_TRANSFER", ref: "City Bank Cheque" } },
      { action: "CUSTOMER_DUE_COLLECTED", entityType: "PartyPayment", metadata: { method: "BKASH", sender: "01711234567" } },
    ];

    const auditLogsToInsert = [];
    for (let i = 1; i <= 25; i++) {
      const act = actions[i % actions.length];
      auditLogsToInsert.push({
        id: randomUUID(),
        actorId: i % 2 === 0 ? superAdmin.id : manager.id,
        action: act.action,
        entityType: act.entityType,
        metadata: act.metadata,
        createdAt: new Date(Date.now() - (30 - i) * 24 * 60 * 60 * 1000),
      });
    }
    await prisma.auditLog.createMany({ data: auditLogsToInsert });
    console.log(`✓ Seeded 25 realistic audit log entries.`);
  }

  // 13. Update Store Settings
  console.log("\nUpdating Store Branding Settings for Bangladesh Context...");
  const storeSetting = await prisma.storeSetting.findFirst();
  const storeData = {
    storeName: "M.R. Enterprise & Wholesale Trading",
    proprietor: "Haji Mohammad Israfil",
    phone: "+880 1711-234567",
    address: "Holding 14, Tejgaon Industrial Area, Dhaka-1208, Bangladesh",
    memoFooterNote: "ধন্যবাদ, আবার আসবেন! মাল বুঝে নিয়ে ক্যাশ মেমো চেক করুন।",
  };
  if (storeSetting) {
    await prisma.storeSetting.update({ where: { id: storeSetting.id }, data: storeData });
  } else {
    await prisma.storeSetting.create({ data: storeData });
  }
  console.log(`✓ Configured store settings with Bangladeshi wholesale identity.`);

  console.log("\n=========================================================");
  console.log("Bangladesh High-Speed Realistic Seed Completed Successfully!");
  console.log("=========================================================");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

