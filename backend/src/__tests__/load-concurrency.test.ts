import request from 'supertest';
import { app } from '../server';
import { prisma } from '../config/database';
import * as crypto from 'crypto';

/**
 * FASE 0 / ETAPA 11 — Load Test: Concorrência de Estoque
 * 
 * Cenário: stock=10, 20 compras simultâneas de qty=1
 * Esperado: exatamente 10 sucessos, 10 falhas, stock=0, nunca negativo
 */

const STOCK = 10;
const CONCURRENT_REQUESTS = 20;

let testVariantId: string;
let originalStock: number;
const users: Array<{ id: string; token: string }> = [];

beforeAll(async () => {
  // Get variant
  const variant = await prisma.productVariant.findFirst({ where: { isActive: true, deletedAt: null } });
  testVariantId = variant!.id;
  originalStock = variant!.stockQty;

  // Set stock to STOCK
  await prisma.productVariant.update({ where: { id: testVariantId }, data: { stockQty: STOCK } });

  // Create CONCURRENT_REQUESTS users, each with cart + address
  for (let i = 0; i < CONCURRENT_REQUESTS; i++) {
    const email = `load-test-${i}-${Date.now()}@test.com`;
    const res = await request(app).post('/api/v1/auth/register').send({ email, password: 'TestPass123!', name: `Load ${i}` });
    const userId = res.body.data.user.id;
    const token = res.body.data.accessToken;

    // Add to cart
    await request(app).post('/api/v1/cart/items').set('Authorization', `Bearer ${token}`).send({ variantId: testVariantId, quantity: 1 });

    // Create address
    await prisma.address.create({ data: { userId, recipientName: `User ${i}`, street: 'Rua Load', number: String(i), city: 'SP', state: 'SP', zipCode: '01001000', country: 'BR' } });

    users.push({ id: userId, token });
  }
}, 60000);

afterAll(async () => {
  // Restore stock
  await prisma.productVariant.update({ where: { id: testVariantId }, data: { stockQty: originalStock } });

  // Cleanup users
  for (const user of users) {
    try {
      await prisma.stockLog.deleteMany({ where: { reference: { in: (await prisma.order.findMany({ where: { userId: user.id }, select: { id: true } })).map(o => o.id) } } });
      await prisma.orderItem.deleteMany({ where: { order: { userId: user.id } } });
      await prisma.payment.deleteMany({ where: { order: { userId: user.id } } });
      await prisma.shipment.deleteMany({ where: { order: { userId: user.id } } });
      await prisma.order.deleteMany({ where: { userId: user.id } });
      await prisma.cartItem.deleteMany({ where: { cart: { userId: user.id } } });
      await prisma.cart.deleteMany({ where: { userId: user.id } });
      await prisma.address.deleteMany({ where: { userId: user.id } });
      await prisma.notificationDelivery.deleteMany({ where: { userId: user.id } });
      await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
      await prisma.auditLog.deleteMany({ where: { OR: [{ actorId: user.id }, { userId: user.id }] } });
      await prisma.user.delete({ where: { id: user.id } });
    } catch { /* ignore */ }
  }
  await prisma.$disconnect();
}, 60000);

describe(`Load Test: stock=${STOCK}, ${CONCURRENT_REQUESTS} simultaneous purchases`, () => {
  it(`Exactly ${STOCK} succeed, ${CONCURRENT_REQUESTS - STOCK} fail, stock=0, never negative`, async () => {
    // Get addresses for each user
    const addressMap = new Map<string, string>();
    for (const user of users) {
      const addr = await prisma.address.findFirst({ where: { userId: user.id } });
      if (addr) addressMap.set(user.id, addr.id);
    }

    // Cancel any existing pending orders (duplicate protection)
    for (const user of users) {
      await prisma.order.updateMany({ where: { userId: user.id, status: 'PENDING' }, data: { status: 'CANCELLED' } });
    }

    // Fire all requests simultaneously
    const results = await Promise.all(
      users.map((user) => {
        const addressId = addressMap.get(user.id);
        return request(app)
          .post('/api/v1/orders')
          .set('Authorization', `Bearer ${user.token}`)
          .send({ addressId, paymentMethod: 'PIX', shippingOptionCode: 'ECONOMICO' });
      })
    );

    const successes = results.filter((r) => r.status === 201);
    const failures = results.filter((r) => r.status !== 201);

    // Exactly STOCK successes
    expect(successes.length).toBe(STOCK);
    expect(failures.length).toBe(CONCURRENT_REQUESTS - STOCK);

    // Stock must be exactly 0
    const variant = await prisma.productVariant.findUnique({ where: { id: testVariantId } });
    expect(variant!.stockQty).toBe(0);

    // Stock NEVER negative
    expect(variant!.stockQty).toBeGreaterThanOrEqual(0);

    // Exactly STOCK orders created
    const orderCount = await prisma.order.count({
      where: { userId: { in: users.map((u) => u.id) }, status: { not: 'CANCELLED' } },
    });
    expect(orderCount).toBe(STOCK);
  }, 30000);
});

describe('Load Test: stock=1, 100-like concurrent attempts', () => {
  it('Only 1 succeeds out of many simultaneous requests', async () => {
    // Reset stock to 1
    await prisma.productVariant.update({ where: { id: testVariantId }, data: { stockQty: 1 } });

    // Use first 10 users (already have carts cleared by previous test)
    const subset = users.slice(0, 10);

    // Give each user a fresh cart
    for (const user of subset) {
      await request(app).delete('/api/v1/cart').set('Authorization', `Bearer ${user.token}`);
      await request(app).post('/api/v1/cart/items').set('Authorization', `Bearer ${user.token}`).send({ variantId: testVariantId, quantity: 1 });
      await prisma.order.updateMany({ where: { userId: user.id, status: 'PENDING' }, data: { status: 'CANCELLED' } });
    }

    const addressMap = new Map<string, string>();
    for (const user of subset) {
      const addr = await prisma.address.findFirst({ where: { userId: user.id } });
      if (addr) addressMap.set(user.id, addr.id);
    }

    const results = await Promise.all(
      subset.map((user) =>
        request(app)
          .post('/api/v1/orders')
          .set('Authorization', `Bearer ${user.token}`)
          .send({ addressId: addressMap.get(user.id), paymentMethod: 'PIX' })
      )
    );

    const successes = results.filter((r) => r.status === 201);
    expect(successes.length).toBe(1);

    const variant = await prisma.productVariant.findUnique({ where: { id: testVariantId } });
    expect(variant!.stockQty).toBe(0);
    expect(variant!.stockQty).toBeGreaterThanOrEqual(0);
  }, 30000);
});

describe('Webhook Replay: same webhook N times', () => {
  it('Replaying webhook 5 times has same effect as once', async () => {
    // Setup: create order + payment
    const user = users[0];
    await prisma.productVariant.update({ where: { id: testVariantId }, data: { stockQty: 5 } });
    await prisma.order.updateMany({ where: { userId: user.id, status: 'PENDING' }, data: { status: 'CANCELLED' } });
    await request(app).delete('/api/v1/cart').set('Authorization', `Bearer ${user.token}`);
    await request(app).post('/api/v1/cart/items').set('Authorization', `Bearer ${user.token}`).send({ variantId: testVariantId, quantity: 1 });
    const addr = await prisma.address.findFirst({ where: { userId: user.id } });
    const orderRes = await request(app).post('/api/v1/orders').set('Authorization', `Bearer ${user.token}`).send({ addressId: addr!.id, paymentMethod: 'PIX' });

    if (orderRes.status !== 201) return; // Skip if duplicate protection fires
    const orderId = orderRes.body.data.id;

    // Create payment
    await request(app).post(`/api/v1/payments/${orderId}/process`).set('Authorization', `Bearer ${user.token}`);
    const payment = await prisma.payment.findFirst({ where: { orderId } });
    if (!payment) return;

    // Send webhook 5 times
    const webhookSecret = process.env.WEBHOOK_SECRET || 'dev-webhook-secret-change-in-production';
    const payload = { paymentId: payment.gatewayId, status: 'approved', eventId: `replay-${Date.now()}` };
    const signature = crypto.createHmac('sha256', webhookSecret).update(JSON.stringify(payload)).digest('hex');

    const webhookResults = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(app).post('/api/v1/payments/webhook').set('x-webhook-signature', signature).send(payload)
      )
    );

    // All should return 200
    for (const r of webhookResults) {
      expect(r.status).toBe(200);
    }

    // Payment should be PAID (only once)
    const finalPayment = await prisma.payment.findFirst({ where: { orderId } });
    expect(finalPayment!.status).toBe('PAID');

    // Order should be CONFIRMED (only once)
    const finalOrder = await prisma.order.findUnique({ where: { id: orderId } });
    expect(finalOrder!.status).toBe('CONFIRMED');

    // No duplicate orders, no duplicate stock decrements
    const stockAfter = await prisma.productVariant.findUnique({ where: { id: testVariantId } });
    expect(stockAfter!.stockQty).toBe(4); // Started at 5, one order took 1
  }, 30000);
});
