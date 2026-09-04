import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { prisma } from '../config/db.js';

describe('Inventory Management System — Complete Acceptance Scenarios', () => {
  let superAdminToken: string;
  let adminToken: string;
  let managerToken: string;
  let salesOfficerToken: string;

  let testCategoryId: string;
  let testProductId: string;
  let pendingSalesOfficerId: string;
  let pendingSalesOfficerEmail = `so_${Date.now()}@inventory.test`;

  beforeAll(async () => {
    // 1. Authenticate default Super Admin
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@inventory.local',
        password: 'SuperAdminInitialPassword123!',
      });
    expect(loginRes.status).toBe(200);
    superAdminToken = loginRes.body.data.token;

    // 2. Super Admin creates an Admin
    const adminEmail = `admin_${Date.now()}@inventory.test`;
    const createAdminRes = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        name: 'Test Admin',
        email: adminEmail,
        role: 'ADMIN',
        password: 'AdminPassword123!',
      });
    expect(createAdminRes.status).toBe(201);

    const adminLoginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: adminEmail,
        password: 'AdminPassword123!',
      });
    expect(adminLoginRes.status).toBe(200);
    adminToken = adminLoginRes.body.data.token;

    // 3. Admin creates a test Category and Product
    const catRes = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Test Cat ${Date.now()}`,
        description: 'Test Category',
      });
    expect(catRes.status).toBe(201);
    testCategoryId = catRes.body.data.id;

    const prodRes = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Test Widget',
        sku: `WIDGET-${Date.now()}`,
        categoryId: testCategoryId,
        unit: 'piece',
        costPrice: 50.0,
        sellingPrice: 100.0,
        quantity: 100,
        reorderLevel: 20,
      });
    expect(prodRes.status).toBe(201);
    testProductId = prodRes.body.data.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Scenario A: Sales Officer Public Registration & Verification', () => {
    it('should register a visitor as a PENDING Sales Officer', async () => {
      const res = await request(app)
        .post('/api/auth/register-sales-officer')
        .send({
          name: 'John Salesman',
          email: pendingSalesOfficerEmail,
          password: 'Password123!',
          phone: '+1234567890',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.role).toBe('SALES_OFFICER');
      expect(res.body.data.status).toBe('PENDING');
      pendingSalesOfficerId = res.body.data.id;
    });

    it('should block pending Sales Officer from logging in', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: pendingSalesOfficerEmail,
          password: 'Password123!',
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('ACCOUNT_PENDING');
    });

    it('should allow Admin to verify and activate the Sales Officer', async () => {
      const res = await request(app)
        .post(`/api/users/${pendingSalesOfficerId}/verify`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('ACTIVE');
    });

    it('should allow verified Sales Officer to log in', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: pendingSalesOfficerEmail,
          password: 'Password123!',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.token).toBeDefined();
      salesOfficerToken = res.body.data.token;
    });
  });

  describe('Scenario B: Manager Account Creation & Forced Password Change', () => {
    const managerEmail = `mgr_${Date.now()}@inventory.test`;
    const initialPassword = 'InitialManagerPassword123!';
    const newPassword = 'NewSecretManagerPassword123!';

    it('should create a Manager with mustChangePassword = true', async () => {
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Manager',
          email: managerEmail,
          role: 'MANAGER',
          password: initialPassword,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.mustChangePassword).toBe(true);
    });

    it('should log in Manager and indicate mustChangePassword = true', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: managerEmail,
          password: initialPassword,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.user.mustChangePassword).toBe(true);
      managerToken = res.body.data.token;
    });

    it('should block Manager from operational routes before password change', async () => {
      const res = await request(app)
        .get('/api/products')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('PASSWORD_CHANGE_REQUIRED');
    });

    it('should allow Manager to change password', async () => {
      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          currentPassword: initialPassword,
          newPassword: newPassword,
        });

      expect(res.status).toBe(200);
    });

    it('should allow Manager normal access after password change', async () => {
      // Re-login with new password
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: managerEmail,
          password: newPassword,
        });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.data.user.mustChangePassword).toBe(false);
      managerToken = loginRes.body.data.token;

      // Access products endpoint now succeeds
      const prodRes = await request(app)
        .get('/api/products')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(prodRes.status).toBe(200);
    });
  });

  describe('Scenario C: Inventory Stock Adjustment & Audit Trail', () => {
    it('should allow Manager to adjust product stock (+30 restock)', async () => {
      const res = await request(app)
        .post('/api/inventory/adjustments')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          productId: testProductId,
          type: 'RESTOCK',
          quantity: 30,
          reason: 'Monthly inventory delivery',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.product.quantity).toBe(130);
      expect(res.body.data.movement.quantityBefore).toBe(100);
      expect(res.body.data.movement.quantityChange).toBe(30);
      expect(res.body.data.movement.quantityAfter).toBe(130);
    });

    it('should reflect stock movement in inventory history', async () => {
      const res = await request(app)
        .get('/api/inventory/history')
        .set('Authorization', `Bearer ${managerToken}`)
        .query({ productId: testProductId });

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      const restock = res.body.data.find((m: any) => m.type === 'RESTOCK');
      expect(restock).toBeDefined();
      expect(restock.quantityChange).toBe(30);
    });
  });

  describe('Scenario D: Sales Creation, Cash Handover & Transaction-Safe Approval', () => {
    let createdSaleId: string;

    it('should allow Sales Officer to create a sale in PENDING state without reducing stock', async () => {
      const res = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${salesOfficerToken}`)
        .send({
          customerName: 'Alice Customer',
          customerPhone: '555-0199',
          items: [{ productId: testProductId, quantity: 5 }],
          note: 'Counter sale',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('PENDING');
      expect(res.body.data.totalAmount).toBe(500.0); // 5 * 100.0
      createdSaleId = res.body.data.id;

      // Verify product stock is still 130!
      const prodRes = await request(app)
        .get(`/api/products/${testProductId}`)
        .set('Authorization', `Bearer ${salesOfficerToken}`);
      expect(prodRes.body.data.quantity).toBe(130);
    });

    it('should allow Manager to approve sale, confirming cash and deducting stock atomically', async () => {
      const res = await request(app)
        .post(`/api/sales/${createdSaleId}/approve`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('APPROVED');
      expect(res.body.data.approvedBy).toBeDefined();

      // Verify product stock is now exactly 125 (130 - 5)!
      const prodRes = await request(app)
        .get(`/api/products/${testProductId}`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(prodRes.body.data.quantity).toBe(125);
    });

    it('should reject duplicate approval cleanly (Prevent Double Approval)', async () => {
      const res = await request(app)
        .post(`/api/sales/${createdSaleId}/approve`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('SALE_NOT_PENDING');

      // Verify product stock is still 125 and NOT deducted again!
      const prodRes = await request(app)
        .get(`/api/products/${testProductId}`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(prodRes.body.data.quantity).toBe(125);
    });
  });

  describe('Scenario E: Sale Rejection Workflow', () => {
    let rejectedSaleId: string;

    it('should allow Manager to reject a pending sale with reason, leaving stock intact', async () => {
      // 1. Sales Officer creates a sale for 2 units
      const createRes = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${salesOfficerToken}`)
        .send({
          customerName: 'Bob Customer',
          items: [{ productId: testProductId, quantity: 2 }],
        });
      expect(createRes.status).toBe(201);
      rejectedSaleId = createRes.body.data.id;

      // 2. Manager rejects the sale
      const rejectRes = await request(app)
        .post(`/api/sales/${rejectedSaleId}/reject`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ reason: 'Customer changed mind and did not hand over cash.' });

      expect(rejectRes.status).toBe(200);
      expect(rejectRes.body.data.status).toBe('REJECTED');
      expect(rejectRes.body.data.rejectionReason).toContain('Customer changed mind');

      // 3. Stock remains untouched at 125
      const prodRes = await request(app)
        .get(`/api/products/${testProductId}`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(prodRes.body.data.quantity).toBe(125);
    });
  });

  describe('Scenario F: Authorization & Role Enforcement', () => {
    it('should prevent Sales Officer from directly adjusting stock', async () => {
      const res = await request(app)
        .post('/api/inventory/adjustments')
        .set('Authorization', `Bearer ${salesOfficerToken}`)
        .send({
          productId: testProductId,
          type: 'RESTOCK',
          quantity: 10,
          reason: 'Unauthorized attempt',
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('should prevent Sales Officer from approving sales', async () => {
      const createRes = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${salesOfficerToken}`)
        .send({
          customerName: 'Self Approver',
          items: [{ productId: testProductId, quantity: 1 }],
        });
      const saleId = createRes.body.data.id;

      const approveRes = await request(app)
        .post(`/api/sales/${saleId}/approve`)
        .set('Authorization', `Bearer ${salesOfficerToken}`);

      expect(approveRes.status).toBe(403);
      expect(approveRes.body.code).toBe('FORBIDDEN');
    });

    it('should prevent Sales Officer from accessing audit logs', async () => {
      const res = await request(app)
        .get('/api/audit-logs')
        .set('Authorization', `Bearer ${salesOfficerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('should allow Super Admin and Admin to view audit logs', async () => {
      const res = await request(app)
        .get('/api/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });
});
