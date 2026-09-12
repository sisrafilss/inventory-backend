import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { prisma } from "../config/db.js";

describe("Fractional & Packaging Unit Stock Management", () => {
  let adminToken: string;
  const createdProductIds: string[] = [];
  const createdSaleIds: string[] = [];
  const createdPurchaseIds: string[] = [];
  const createdCustomerIds: string[] = [];

  beforeAll(async () => {
    // Authenticate default Super Admin
    const loginRes = await request(app).post("/api/auth/login").send({
      email: "admin@inventory.local",
      password: "SuperAdminInitialPassword123!",
    });
    expect(loginRes.status).toBe(200);
    adminToken = loginRes.body.data.token;
  });

  afterAll(async () => {
    // Thorough cleanup of all test records created during this test suite
    if (createdSaleIds.length > 0) {
      await prisma.stockMovement.deleteMany({
        where: { referenceId: { in: createdSaleIds } },
      });
      await prisma.saleItem.deleteMany({
        where: { saleId: { in: createdSaleIds } },
      });
      await prisma.sale.deleteMany({
        where: { id: { in: createdSaleIds } },
      });
    }

    if (createdPurchaseIds.length > 0) {
      await prisma.stockMovement.deleteMany({
        where: { referenceId: { in: createdPurchaseIds } },
      });
      await prisma.purchaseItem.deleteMany({
        where: { purchaseId: { in: createdPurchaseIds } },
      });
      await prisma.purchase.deleteMany({
        where: { id: { in: createdPurchaseIds } },
      });
    }

    if (createdProductIds.length > 0) {
      await prisma.stockMovement.deleteMany({
        where: { productId: { in: createdProductIds } },
      });
      await prisma.warehouseStock.deleteMany({
        where: { productId: { in: createdProductIds } },
      });
      await prisma.saleItem.deleteMany({
        where: { productId: { in: createdProductIds } },
      });
      await prisma.purchaseItem.deleteMany({
        where: { productId: { in: createdProductIds } },
      });
      await prisma.product.deleteMany({
        where: { id: { in: createdProductIds } },
      });
    }

    if (createdCustomerIds.length > 0) {
      await prisma.customer.deleteMany({
        where: { id: { in: createdCustomerIds } },
      });
    }
  });

  it("Scenario 1: Sugar (KG) - Purchase 700 KG, Sell 10.5 KG -> Remaining Stock must be 689.5 KG", async () => {
    const sku = `SUGAR-${Date.now()}`;
    const createProdRes = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Sugar White Test",
        sku,
        unit: "Kilograms",
        costPrice: 120,
        sellingPrice: 135,
        quantity: 0,
      });

    expect(createProdRes.status).toBe(201);
    const sugarProductId = createProdRes.body.data.id;
    createdProductIds.push(sugarProductId);

    // Purchase 700 KG
    const purchaseRes = await request(app)
      .post("/api/purchases")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        paymentType: "CASH",
        items: [
          {
            productId: sugarProductId,
            quantity: 700,
            purchaseRate: 120,
          },
        ],
      });

    expect(purchaseRes.status).toBe(201);
    if (purchaseRes.body.data?.id) {
      createdPurchaseIds.push(purchaseRes.body.data.id);
    }

    // Sell 10.5 KG
    const saleRes = await request(app)
      .post("/api/sales")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        customerName: "Cash Party",
        paymentType: "CASH",
        items: [
          {
            productId: sugarProductId,
            quantity: 10.5,
            unitPrice: 135,
          },
        ],
      });

    expect(saleRes.status).toBe(201);
    if (saleRes.body.data?.id) {
      createdSaleIds.push(saleRes.body.data.id);
    }
    expect(Number(saleRes.body.data.items[0].quantity)).toBe(10.5);
    expect(Number(saleRes.body.data.totalAmount)).toBe(1417.5);

    // Verify remaining stock is 689.5 KG
    const prodAfterSale = await request(app)
      .get(`/api/products/${sugarProductId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(prodAfterSale.status).toBe(200);
    expect(Number(prodAfterSale.body.data.quantity)).toBe(689.5);
  });

  it("Scenario 2: Packaging Unit (Cartons) - Pack Size 24, Purchase 5 Cartons, Sell 1.25 Cartons -> Stock = 3.75 Cartons", async () => {
    const sku = `BISCUIT-${Date.now()}`;
    const createProdRes = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Biscuit Box Carton Test",
        sku,
        unit: "Cartons",
        packSize: 24,
        costPrice: 2400,
        sellingPrice: 2880,
        quantity: 0,
      });

    expect(createProdRes.status).toBe(201);
    const cartonProductId = createProdRes.body.data.id;
    createdProductIds.push(cartonProductId);

    // Purchase 5 Cartons
    const purchaseRes = await request(app)
      .post("/api/purchases")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        paymentType: "CASH",
        items: [
          {
            productId: cartonProductId,
            quantity: 5,
            packSize: 24,
            purchaseRate: 2400,
          },
        ],
      });

    expect(purchaseRes.status).toBe(201);
    if (purchaseRes.body.data?.id) {
      createdPurchaseIds.push(purchaseRes.body.data.id);
    }

    // Sell 1 Carton and 6 loose pcs (1.25 Cartons)
    const saleRes = await request(app)
      .post("/api/sales")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        customerName: "Cash Party",
        paymentType: "CASH",
        items: [
          {
            productId: cartonProductId,
            quantity: 1.25,
            packSize: 24,
            looseQuantity: 6,
            unitPrice: 2880,
          },
        ],
      });

    expect(saleRes.status).toBe(201);
    if (saleRes.body.data?.id) {
      createdSaleIds.push(saleRes.body.data.id);
    }
    expect(Number(saleRes.body.data.items[0].quantity)).toBe(1.25);
    expect(Number(saleRes.body.data.totalAmount)).toBe(3600);

    // Verify remaining stock: 5 - 1.25 = 3.75
    const prodAfterSale = await request(app)
      .get(`/api/products/${cartonProductId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(prodAfterSale.status).toBe(200);
    expect(Number(prodAfterSale.body.data.quantity)).toBe(3.75);
  });

  it("Scenario 3: Zero main boxes with loose pieces (0 boxes + 10 pcs, packSize: 72) -> Successfully processed and stock reduced by 10/72", async () => {
    const sku = `SOAP-${Date.now()}`;
    const createProdRes = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Bath Soap Test",
        sku,
        unit: "Boxes",
        packSize: 72,
        costPrice: 720,
        sellingPrice: 864,
        quantity: 0,
      });

    expect(createProdRes.status).toBe(201);
    const soapProductId = createProdRes.body.data.id;
    createdProductIds.push(soapProductId);

    // Purchase 2 boxes (144 pcs)
    const purchaseRes = await request(app)
      .post("/api/purchases")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        paymentType: "CASH",
        items: [
          {
            productId: soapProductId,
            quantity: 2,
            packSize: 72,
            purchaseRate: 720,
          },
        ],
      });

    expect(purchaseRes.status).toBe(201);
    if (purchaseRes.body.data?.id) {
      createdPurchaseIds.push(purchaseRes.body.data.id);
    }

    // Sell 0 boxes and 10 pcs (quantity: 0, looseQuantity: 10, packSize: 72)
    const saleRes = await request(app)
      .post("/api/sales")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        customerName: "Cash Party",
        paymentType: "CASH",
        items: [
          {
            productId: soapProductId,
            quantity: 0,
            looseQuantity: 10,
            packSize: 72,
            unitPrice: 864,
          },
        ],
      });

    expect(saleRes.status).toBe(201);
    if (saleRes.body.data?.id) {
      createdSaleIds.push(saleRes.body.data.id);
    }

    // Expected quantity sold is 10/72 = 0.139 (due to 3 decimal place DB precision)
    const itemSold = saleRes.body.data.items[0];
    expect(Number(itemSold.quantity)).toBeCloseTo(10 / 72, 2);
    // Line total: 0.139 * 864 = 120.10 or 120
    expect(Number(saleRes.body.data.totalAmount)).toBeGreaterThanOrEqual(120);

    // Verify remaining stock: 2 - (10/72) = 1.861
    const prodAfterSale = await request(app)
      .get(`/api/products/${soapProductId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(prodAfterSale.status).toBe(200);
    expect(Number(prodAfterSale.body.data.quantity)).toBeCloseTo(
      2 - 10 / 72,
      2,
    );
  });

  it("Scenario 4: Validation prevents both main quantity and loose quantity from being zero", async () => {
    const sku = `VAL-ZERO-${Date.now()}`;
    const createProdRes = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Zero Test Product",
        sku,
        unit: "Boxes",
        packSize: 50,
        costPrice: 500,
        sellingPrice: 600,
        quantity: 10,
      });

    expect(createProdRes.status).toBe(201);
    const prodId = createProdRes.body.data.id;
    createdProductIds.push(prodId);

    // Attempt sale with quantity = 0 and looseQuantity = 0
    const saleRes = await request(app)
      .post("/api/sales")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        customerName: "Cash Party",
        paymentType: "CASH",
        items: [
          {
            productId: prodId,
            quantity: 0,
            looseQuantity: 0,
            unitPrice: 600,
          },
        ],
      });

    expect([400, 422]).toContain(saleRes.status);

    // Attempt purchase with quantity = 0 and looseQuantity = 0
    const purchaseRes = await request(app)
      .post("/api/purchases")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        paymentType: "CASH",
        items: [
          {
            productId: prodId,
            quantity: 0,
            looseQuantity: 0,
            purchaseRate: 500,
          },
        ],
      });

    expect([400, 422]).toContain(purchaseRes.status);
  });

  it("Scenario 5: Negative quantity or negative loose quantity is rejected", async () => {
    const sku = `VAL-NEG-${Date.now()}`;
    const createProdRes = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Negative Test Product",
        sku,
        unit: "Boxes",
        packSize: 50,
        costPrice: 500,
        sellingPrice: 600,
        quantity: 10,
      });

    expect(createProdRes.status).toBe(201);
    const prodId = createProdRes.body.data.id;
    createdProductIds.push(prodId);

    // Attempt sale with negative quantity
    const saleRes = await request(app)
      .post("/api/sales")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        customerName: "Cash Party",
        paymentType: "CASH",
        items: [
          {
            productId: prodId,
            quantity: -1,
            unitPrice: 600,
          },
        ],
      });

    expect([400, 422]).toContain(saleRes.status);
  });

  it("Scenario 6: Attempting to sell more than available decimal stock returns 400 INSUFFICIENT_STOCK", async () => {
    const sku = `STOCK-LIMIT-${Date.now()}`;
    const createProdRes = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Stock Limit Product",
        sku,
        unit: "Kilograms",
        costPrice: 100,
        sellingPrice: 120,
        quantity: 5.5,
      });

    expect(createProdRes.status).toBe(201);
    const prodId = createProdRes.body.data.id;
    createdProductIds.push(prodId);

    const saleRes = await request(app)
      .post("/api/sales")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        customerName: "Cash Party",
        paymentType: "CASH",
        items: [
          {
            productId: prodId,
            quantity: 10,
            unitPrice: 120,
          },
        ],
      });

    expect(saleRes.status).toBe(400);
    expect(saleRes.body.code).toBe("INSUFFICIENT_STOCK");
  });
});
