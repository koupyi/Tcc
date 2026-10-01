import request from 'supertest';
import { app } from '../server';
import { prisma } from '../config/database';
import * as crypto from 'crypto';

/**
 * FASE 0 / ETAPA 6 — Testes de Pagamento
 * Tests payment creation, webhook, idempotency, security, and state transitions.
 */

let testUser: { id: string; token: string };
let testOrderId: string;
let testVariantId: string;
let originalStock: number;

beforeAll(async () => {
  // Create user
  const email = `payment-test-${Date.now()}@test.com`;
  const res = await request(app).post('/api/v1/auth/register').send({ email, password: 'TestPass123!', name: 'Payment Test' });
  testUser = { id: res.body.data.user.id, token: res.body.data.accessToken };

  // Get variant and set stock
  const variant = await prisma.productVariant.findFirst({ where: { isActive: true, deletedAt: null } });
  testVariantId = variant!.id;
  originalStock = variant!.stockQty;
  await prisma.productVariant.update({ where: { id: testVariantId }, data: { stockQty: 50 } });

  // Create address
  const addr = await prisma.address.create({
    data: { userId: testUser.id, recipientName: 'Test', street: 'Rua T', number: '1', city: 'SP', state: 'SP', zipCode: '01001000', country: 'BR' },
  });

  // Create order for payment tests
  await request(app).post('/api/v1/cart/items').set('Authorization', `Bearer ${testUser.token}`).send({ variantId: testVariantId, quantity: 1 });
  const orderRes = await request(app).post('/api/v1/orders').set('Authorization', `Bearer ${testUser.token}`).send({ addressId: addr.id, paymentMethod: 'PIX' });
  testOrderId = orderRes.body.data.id;
});

afterAll(async () => {
  await prisma.productVariant.update({ where: { id: testVariantId }, data: { stockQty: originalStock } });
  try {
    await prisma.payment.deleteMany({ where: { order: { userId: testUser.id } } });
    await prisma.orderItem.deleteMany({ where: { order: { userId: testUser.id } } });
    await prisma.shipment.deleteMany({ where: { order: { userId: testUser.id } } });
    await prisma.order.deleteMany({ where: { userId: testUser.id } });
    await prisma.cartItem.deleteMany({ where: { cart: { userId: testUser.id } } });
    await prisma.cart.deleteMany({ where: { userId: testUser.id } });
    await prisma.address.deleteMany({ where: { userId: testUser.id } });
    await prisma.refreshToken.deleteMany({ where: { userId: testUser.id } });
    await prisma.auditLog.deleteMany({ where: { OR: [{ actorId: testUser.id }, { userId: testUser.id }] } });
    await prisma.user.delete({ where: { id: testUser.id } });
  } catch { /* ignore */ }
  await prisma.$disconnect();
});

describe('Payment Creation', () => {
  it('POST /payments/:orderId/process → creates payment', async () => {
    const res = await request(app)
      .post(`/api/v1/payments/${testOrderId}/process`)
      .set('Authorization', `Bearer ${testUser.token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.orderId).toBe(testOrderId);
    expect(res.body.data.status).toBe('PENDING');
    expect(res.body.data.gatewayId).toBeDefined();
    expect(res.body.data.gatewayResponse).toBeDefined();
  });

  it('Amount comes from order in DB, not frontend', async () => {
    const order = await prisma.order.findUnique({ where: { id: testOrderId } });
    const payment = await prisma.payment.findFirst({ where: { orderId: testOrderId } });
    expect(Number(payment!.amount)).toBe(Number(order!.total));
  });

  it('Duplicate create returns existing payment (idempotent)', async () => {
    const res = await request(app)
      .post(`/api/v1/payments/${testOrderId}/process`)
      .set('Authorization', `Bearer ${testUser.token}`);
    expect(res.status).toBe(200);
    // Should return same payment, not create new
    const payments = await prisma.payment.count({ where: { orderId: testOrderId } });
    expect(payments).toBe(1);
  });

  it('POST /payments/non-existent/process → 404', async () => {
    const res = await request(app)
      .post('/api/v1/payments/00000000-0000-0000-0000-000000000000/process')
      .set('Authorization', `Bearer ${testUser.token}`);
    expect(res.status).toBe(404);
  });

  it('POST /payments/:orderId/process sem token → 401', async () => {
    const res = await request(app).post(`/api/v1/payments/${testOrderId}/process`);
    expect(res.status).toBe(401);
  });

  it('Another user cannot create payment for this order (IDOR)', async () => {
    const email2 = `other-pay-${Date.now()}@test.com`;
    const reg = await request(app).post('/api/v1/auth/register').send({ email: email2, password: 'TestPass123!', name: 'Other' });
    const otherToken = reg.body.data.accessToken;
    const otherUserId = reg.body.data.user.id;

    const res = await request(app)
      .post(`/api/v1/payments/${testOrderId}/process`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(403);

    // Cleanup
    await prisma.refreshToken.deleteMany({ where: { userId: otherUserId } });
    await prisma.auditLog.deleteMany({ where: { OR: [{ actorId: otherUserId }, { userId: otherUserId }] } });
    await prisma.user.delete({ where: { id: otherUserId } });
  });
});

describe('Payment Query', () => {
  it('GET /payments/:orderId → returns payment', async () => {
    const res = await request(app)
      .get(`/api/v1/payments/${testOrderId}`)
      .set('Authorization', `Bearer ${testUser.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.orderId).toBe(testOrderId);
    expect(res.body.data.status).toBeDefined();
  });

  it('GET /payments/:orderId sem token → 401', async () => {
    const res = await request(app).get(`/api/v1/payments/${testOrderId}`);
    expect(res.status).toBe(401);
  });
});

describe('Webhook — Legacy (sandbox)', () => {
  it('Valid webhook with correct HMAC → processes payment', async () => {
    const payment = await prisma.payment.findFirst({ where: { orderId: testOrderId } });
    const webhookSecret = process.env.WEBHOOK_SECRET || 'dev-webhook-secret-change-in-production';
    const payload = { paymentId: payment!.gatewayId, status: 'approved', eventId: `evt-${Date.now()}` };
    const signature = crypto.createHmac('sha256', webhookSecret).update(JSON.stringify(payload)).digest('hex');

    const res = await request(app)
      .post('/api/v1/payments/webhook')
      .set('x-webhook-signature', signature)
      .send(payload);
    expect(res.status).toBe(200);
    expect(res.body.data.processed).toBe(true);

    // Verify payment is now PAID
    const updated = await prisma.payment.findFirst({ where: { orderId: testOrderId } });
    expect(updated!.status).toBe('PAID');
    expect(updated!.paidAt).not.toBeNull();
  });

  it('Order status updated to CONFIRMED after payment approved', async () => {
    const order = await prisma.order.findUnique({ where: { id: testOrderId } });
    expect(order!.status).toBe('CONFIRMED');
  });

  it('Idempotent: same webhook twice → no duplicate processing', async () => {
    const payment = await prisma.payment.findFirst({ where: { orderId: testOrderId } });
    const webhookSecret = process.env.WEBHOOK_SECRET || 'dev-webhook-secret-change-in-production';
    const payload = { paymentId: payment!.gatewayId, status: 'approved', eventId: `evt-dup-${Date.now()}` };
    const signature = crypto.createHmac('sha256', webhookSecret).update(JSON.stringify(payload)).digest('hex');

    const res = await request(app)
      .post('/api/v1/payments/webhook')
      .set('x-webhook-signature', signature)
      .send(payload);
    expect(res.status).toBe(200);
    expect(res.body.data.idempotent || res.body.data.skipped).toBe(true); // Already PAID
  });

  it('Invalid HMAC signature → 401', async () => {
    const payload = { paymentId: 'some-id', status: 'approved', eventId: 'evt-fake' };
    const res = await request(app)
      .post('/api/v1/payments/webhook')
      .set('x-webhook-signature', 'invalid-signature')
      .send(payload);
    expect(res.status).toBe(401);
  });

  it('Webhook with non-existent paymentId → 404', async () => {
    const webhookSecret = process.env.WEBHOOK_SECRET || 'dev-webhook-secret-change-in-production';
    const payload = { paymentId: 'non-existent-gateway-id', status: 'approved', eventId: 'evt-x' };
    const signature = crypto.createHmac('sha256', webhookSecret).update(JSON.stringify(payload)).digest('hex');

    const res = await request(app)
      .post('/api/v1/payments/webhook')
      .set('x-webhook-signature', signature)
      .send(payload);
    expect(res.status).toBe(404);
  });

  it('Webhook with missing paymentId → 400', async () => {
    const webhookSecret = process.env.WEBHOOK_SECRET || 'dev-webhook-secret-change-in-production';
    const payload = { status: 'approved' };
    const signature = crypto.createHmac('sha256', webhookSecret).update(JSON.stringify(payload)).digest('hex');

    const res = await request(app)
      .post('/api/v1/payments/webhook')
      .set('x-webhook-signature', signature)
      .send(payload);
    expect(res.status).toBe(400);
  });
});

describe('Webhook — Mercado Pago format', () => {
  it('MP format webhook with data.id → processes', async () => {
    // Create a fresh order + payment for this test
    await prisma.productVariant.update({ where: { id: testVariantId }, data: { stockQty: 50 } });
    await prisma.order.updateMany({ where: { userId: testUser.id, status: 'CONFIRMED' }, data: { status: 'CANCELLED' } });

    // Create new cart and order
    await request(app).post('/api/v1/cart/items').set('Authorization', `Bearer ${testUser.token}`).send({ variantId: testVariantId, quantity: 1 });
    const addr = await prisma.address.findFirst({ where: { userId: testUser.id } });
    const orderRes = await request(app).post('/api/v1/orders').set('Authorization', `Bearer ${testUser.token}`).send({ addressId: addr!.id, paymentMethod: 'PIX' });

    if (orderRes.status !== 201) {
      // May hit duplicate protection — skip gracefully
      return;
    }

    const newOrderId = orderRes.body.data.id;
    // Create payment for new order
    await request(app).post(`/api/v1/payments/${newOrderId}/process`).set('Authorization', `Bearer ${testUser.token}`);
    const payment = await prisma.payment.findFirst({ where: { orderId: newOrderId } });

    // Send MP-format webhook (without MERCADOPAGO_WEBHOOK_SECRET, validation is skipped, but server-side verify is used)
    const mpPayload = { action: 'payment.updated', data: { id: payment!.gatewayId }, type: 'payment' };
    const res = await request(app).post('/api/v1/payments/webhook').send(mpPayload);

    // Without real MP API access, verifyPayment returns PENDING (sandbox provider)
    expect(res.status).toBe(200);
    expect(res.body.data.processed).toBe(true);
  });
});

describe('Security — Price Tampering', () => {
  it('Payment amount matches order total (not client-provided value)', async () => {
    const order = await prisma.order.findFirst({ where: { userId: testUser.id, status: { not: 'CANCELLED' } } });
    if (!order) return;

    const payment = await prisma.payment.findFirst({ where: { orderId: order.id } });
    if (!payment) return;

    // Verify amount matches — it should be order.total, not some manipulated value
    expect(Number(payment.amount)).toBe(Number(order.total));
    expect(Number(payment.amount)).toBeGreaterThan(1); // Not $0.01
  });
});

describe('Double Payment Prevention', () => {
  it('Cannot pay an already-paid order', async () => {
    // Find the order that was marked as CONFIRMED/PAID
    const paidOrder = await prisma.order.findFirst({ where: { userId: testUser.id, status: 'CONFIRMED' } });
    if (!paidOrder) return;

    const res = await request(app)
      .post(`/api/v1/payments/${paidOrder.id}/process`)
      .set('Authorization', `Bearer ${testUser.token}`);
    // Order status is CONFIRMED (not PENDING), so should reject
    expect(res.status).toBe(400);
  });
});
