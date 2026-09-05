import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { prisma } from "../config/db.js";

describe("Inventory Management System — Acceptance Scenarios (Super Admin, Admin, Manager)", () => {
  let superAdminToken: string;
  let adminToken: string;
  let managerToken: string;

  let testCategoryId: string;
  let testProductId: string;

  beforeAll(async () => {
    // 1. Authenticate default Super Admin
    const loginRes = await request(app).post("/api/auth/login").send({
      email: "admin@inventory.local",
      password: "SuperAdminInitialPassword123!",
    });
    expect(loginRes.status).toBe(200);
    superAdminToken = loginRes.body.data.token;

    // 2. Super Admin creates an Admin
    const adminEmail = `admin_${Date.now()}@inventory.test`;
    const createAdminRes = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send({
        name: "Test Admin",
        email: adminEmail,
        role: "ADMIN",
        password: "AdminPassword123!",
      });
    expect(createAdminRes.status).toBe(201);

    const adminLoginRes = await request(app).post("/api/auth/login").send({
      email: adminEmail,
      password: "AdminPassword123!",
    });
    expect(adminLoginRes.status).toBe(200);
    adminToken = adminLoginRes.body.data.token;

    // 3. Admin creates a test Category and Product
    const catRes = await request(app)
      .post("/api/categories")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: `Test Cat ${Date.now()}`,
        description: "Test Category",
      });
    expect(catRes.status).toBe(201);
    testCategoryId = catRes.body.data.id;

    const prodRes = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Test Widget",
        sku: `WIDGET-${Date.now()}`,
        categoryId: testCategoryId,
        unit: "piece",
        costPrice: 50.0,
        sellingPrice: 100.0,
        quantity: 100,
        reorderLevel: 20,
      });
    expect(prodRes.status).toBe(201);
    testProductId = prodRes.body.data.id;
  }, 30000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("Scenario A: Role Creation Rules & Manager Account Setup", () => {
    const managerEmail = `mgr_${Date.now()}@inventory.test`;
    const initialPassword = "InitialManagerPassword123!";
    const newPassword = "NewSecretManagerPassword123!";

    it("should prevent creating users with obsolete or invalid roles", async () => {
      const res = await request(app)
        .post("/api/users")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          name: "Invalid Role User",
          email: `invalid_${Date.now()}@test.com`,
          role: "SALES_OFFICER",
          password: "Password123!",
        });

      expect(res.status).toBe(422);
    });

    it("should create a Manager with mustChangePassword = true", async () => {
      const res = await request(app)
        .post("/api/users")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Test Manager",
          email: managerEmail,
          role: "MANAGER",
          password: initialPassword,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.role).toBe("MANAGER");
      expect(res.body.data.mustChangePassword).toBe(true);
    });

    it("should log in Manager and indicate mustChangePassword = true", async () => {
      const res = await request(app).post("/api/auth/login").send({
        email: managerEmail,
        password: initialPassword,
      });

      expect(res.status).toBe(200);
      expect(res.body.data.user.mustChangePassword).toBe(true);
      managerToken = res.body.data.token;
    });

    it("should block Manager from operational routes before password change", async () => {
      const res = await request(app)
        .get("/api/products")
        .set("Authorization", `Bearer ${managerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("PASSWORD_CHANGE_REQUIRED");
    });

    it("should allow Manager to change password", async () => {
      const res = await request(app)
        .post("/api/auth/change-password")
        .set("Authorization", `Bearer ${managerToken}`)
        .send({
          currentPassword: initialPassword,
          newPassword: newPassword,
        });

      expect(res.status).toBe(200);
    });

    it("should allow Manager normal access after password change", async () => {
      const loginRes = await request(app).post("/api/auth/login").send({
        email: managerEmail,
        password: newPassword,
      });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.data.user.mustChangePassword).toBe(false);
      managerToken = loginRes.body.data.token;

      const prodRes = await request(app)
        .get("/api/products")
        .set("Authorization", `Bearer ${managerToken}`);

      expect(prodRes.status).toBe(200);
    });
  });

  describe("Scenario B: Inventory Stock Adjustment & Audit Trail", () => {
    it("should allow Manager to adjust product stock (+30 restock)", async () => {
      const res = await request(app)
        .post("/api/inventory/adjustments")
        .set("Authorization", `Bearer ${managerToken}`)
        .send({
          productId: testProductId,
          type: "RESTOCK",
          quantity: 30,
          reason: "Monthly inventory delivery",
        });

      expect(res.status).toBe(201);
      expect(res.body.data.product.quantity).toBe(130);
      expect(res.body.data.movement.quantityBefore).toBe(100);
      expect(res.body.data.movement.quantityChange).toBe(30);
      expect(res.body.data.movement.quantityAfter).toBe(130);
    });

    it("should reflect stock movement in inventory history", async () => {
      const res = await request(app)
        .get("/api/inventory/history")
        .set("Authorization", `Bearer ${managerToken}`)
        .query({ productId: testProductId });

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      const restock = res.body.data.find((m: any) => m.type === "RESTOCK");
      expect(restock).toBeDefined();
      expect(restock.quantityChange).toBe(30);
    });
  });

  describe("Scenario C: Sales Creation & Immediate Stock Deduction", () => {
    it("should allow Manager to create a sale, immediately deducting stock and setting status to COMPLETED", async () => {
      const res = await request(app)
        .post("/api/sales")
        .set("Authorization", `Bearer ${managerToken}`)
        .send({
          customerName: "Alice Customer",
          customerPhone: "555-0199",
          items: [{ productId: testProductId, quantity: 5 }],
          note: "Counter sale",
        });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe("COMPLETED");
      expect(res.body.data.totalAmount).toBe(500.0); // 5 * 100.0
      expect(res.body.data.createdById).toBeDefined();
      expect(res.body.data.createdBy).toBeDefined();

      // Verify product stock is immediately deducted from 130 to 125!
      const prodRes = await request(app)
        .get(`/api/products/${testProductId}`)
        .set("Authorization", `Bearer ${managerToken}`);
      expect(prodRes.body.data.quantity).toBe(125);
    });

    it("should reject sale creation when requested quantity exceeds available stock", async () => {
      const res = await request(app)
        .post("/api/sales")
        .set("Authorization", `Bearer ${managerToken}`)
        .send({
          customerName: "Overbuyer Customer",
          items: [{ productId: testProductId, quantity: 9999 }],
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("INSUFFICIENT_STOCK");

      // Verify stock remains untouched at 125
      const prodRes = await request(app)
        .get(`/api/products/${testProductId}`)
        .set("Authorization", `Bearer ${managerToken}`);
      expect(prodRes.body.data.quantity).toBe(125);
    });
  });

  describe("Scenario E: Authorization & Role Enforcement", () => {
    it("should prevent Manager from accessing user management routes", async () => {
      const res = await request(app)
        .get("/api/users")
        .set("Authorization", `Bearer ${managerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("FORBIDDEN");
    });

    it("should prevent Manager from accessing audit logs", async () => {
      const res = await request(app)
        .get("/api/audit-logs")
        .set("Authorization", `Bearer ${managerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("FORBIDDEN");
    });

    it("should allow Super Admin and Admin to view audit logs", async () => {
      const res = await request(app)
        .get("/api/audit-logs")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });
});
