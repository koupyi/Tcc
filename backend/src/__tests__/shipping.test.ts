import request from 'supertest';
import { app } from '../server';
import { prisma } from '../config/database';

/**
 * FASE 0 / ETAPA 7 — Testes de Frete e Logística
 */

let testUser: { id: string; token: string };
let otherUser: { id: string; token: string };
let testVariantId: string;
let testOrderId: string;
let originalStock: number;

beforeAll(async () => {
  // Create users
  const email1 = `shipping-test-${Date.now()}@test.com`;
  const res1 = await request(app).post('/api/v1/auth/register').send({ email: email1, password: 'TestPass123!', name: 'Shipping User' });
  testUser = { id: res1.body.data.user.id, token: res1.body.data.accessToken };

  const email2 = `shipping-other-${Date.now()}@test.com`;
  const res2 = await request(app).post('/api/v1/auth/register').send({ email: email2, password: 'TestPass123!', name: 'Other User' });
  otherUser = { id: res2.body.data.user.id, token: res2.body.data.accessToken };

  // Setup variant with stock
  const variant = await prisma.productVariant.findFirst({ where: { isActive: true, deletedAt: null } });
  testVariantId = variant!.id;
  originalStock = variant!.stockQty;
  await prisma.productVariant.update({ where: { id: testVariantId }, data: { stockQty: 50 } });

  // Create address and order
  const addr = await prisma.address.create({
    data: { userId: testUser.id, recipientName: 'Test', street: 'Rua T', number: '1', city: 'SP', state: 'SP', zipCode: '01001000', country: 'BR' },
  });
  await request(app).post('/api/v1/cart/items').set('Authorization', `Bearer ${testUser.token}`).send({ variantId: testVariantId, quantity: 1 });
  const orderRes = await request(app).post('/api/v1/orders').set('Authorization', `Bearer ${testUser.token}`).send({ addressId: addr.id, paymentMethod: 'PIX', shippingOptionCode: 'EXPRESSO' });
  testOrderId = orderRes.body.data.id;
});

afterAll(async () => {
  await prisma.productVariant.update({ where: { id: testVariantId }, data: { stockQty: originalStock } });
  for (const uid of [testUser.id, otherUser.id]) {
    try {
      await prisma.payment.deleteMany({ where: { order: { userId: uid } } });
      await prisma.orderItem.deleteMany({ where: { order: { userId: uid } } });
      await prisma.shipment.deleteMany({ where: { order: { userId: uid } } });
      await prisma.order.deleteMany({ where: { userId: uid } });
      await prisma.cartItem.deleteMany({ where: { cart: { userId: uid } } });
      await prisma.cart.deleteMany({ where: { userId: uid } });
      await prisma.address.deleteMany({ where: { userId: uid } });
      await prisma.refreshToken.deleteMany({ where: { userId: uid } });
      await prisma.auditLog.deleteMany({ where: { OR: [{ actorId: uid }, { userId: uid }] } });
      await prisma.user.delete({ where: { id: uid } });
    } catch { /* ignore */ }
  }
  await prisma.$disconnect();
});

describe('Shipping: Multiple Options', () => {
  it('POST /shipping/calculate returns multiple options', async () => {
    const res = await request(app).post('/api/v1/shipping/calculate').send({ zipCode: '01001000' });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(2);

    const [economico, expresso] = res.body.data;
    expect(economico.code).toBe('ECONOMICO');
    expect(economico.name).toBe('Econômico');
    expect(economico.carrier).toBeDefined();
    expect(economico.price).toBeGreaterThan(0);
    expect(economico.days).toBeGreaterThan(0);

    expect(expresso.code).toBe('EXPRESSO');
    expect(expresso.name).toBe('Expresso');
    expect(expresso.price).toBeGreaterThan(economico.price);
    expect(expresso.days).toBeLessThan(economico.days);
  });

  it('Different CEPs get different prices', async () => {
    const sp = await request(app).post('/api/v1/shipping/calculate').send({ zipCode: '01001000' });
    const am = await request(app).post('/api/v1/shipping/calculate').send({ zipCode: '69000000' });
    expect(sp.body.data[0].price).toBeLessThan(am.body.data[0].price);
  });

  it('Invalid CEP returns default options', async () => {
    const res = await request(app).post('/api/v1/shipping/calculate').send({ zipCode: '99999999' });
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
  });

  it('Price calculated server-side (frontend cannot set price)', async () => {
    // Even if someone sends a price in the body, it's ignored
    const res = await request(app).post('/api/v1/shipping/calculate').send({ zipCode: '01001000', price: 0.01 });
    expect(res.status).toBe(200);
    expect(res.body.data[0].price).toBeGreaterThan(1);
  });
});

describe('Shipping: Order Persists Chosen Option', () => {
  it('Order shipment contains carrier and serviceName', async () => {
    const shipment = await prisma.shipment.findFirst({ where: { orderId: testOrderId } });
    expect(shipment).not.toBeNull();
    expect(shipment!.carrier).toBe('KeyCaps Express');
    expect(shipment!.serviceName).toBe('Expresso');
    expect(shipment!.serviceCode).toBe('EXPRESSO');
    expect(Number(shipment!.shippingCost)).toBeGreaterThan(0);
  });

  it('Shipping cost snapshot preserved in order', async () => {
    const order = await prisma.order.findUnique({ where: { id: testOrderId } });
    expect(Number(order!.shippingCost)).toBeGreaterThan(0);
    expect(Number(order!.total)).toBe(Number(order!.subtotal) + Number(order!.shippingCost));
  });
});

describe('Shipping: Tracking Endpoint', () => {
  it('GET /shipping/orders/:orderId returns shipment info', async () => {
    const res = await request(app)
      .get(`/api/v1/shipping/orders/${testOrderId}`)
      .set('Authorization', `Bearer ${testUser.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('PENDING');
    expect(res.body.data.carrier).toBe('KeyCaps Express');
    expect(res.body.data.serviceName).toBe('Expresso');
    expect(res.body.data.serviceCode).toBe('EXPRESSO');
  });

  it('401 without auth', async () => {
    const res = await request(app).get(`/api/v1/shipping/orders/${testOrderId}`);
    expect(res.status).toBe(401);
  });

  it('IDOR: other user cannot access shipment', async () => {
    const res = await request(app)
      .get(`/api/v1/shipping/orders/${testOrderId}`)
      .set('Authorization', `Bearer ${otherUser.token}`);
    expect(res.status).toBe(403);
  });

  it('404 for non-existent order', async () => {
    const res = await request(app)
      .get('/api/v1/shipping/orders/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${testUser.token}`);
    expect(res.status).toBe(404);
  });
});

describe('Shipping: Shipment Idempotency', () => {
  it('Order only has one shipment (unique orderId)', async () => {
    const count = await prisma.shipment.count({ where: { orderId: testOrderId } });
    expect(count).toBe(1);
  });
});

describe('Shipping: Status Transitions', () => {
  it('Shipment starts as PENDING', async () => {
    const shipment = await prisma.shipment.findFirst({ where: { orderId: testOrderId } });
    expect(shipment!.status).toBe('PENDING');
  });
});

describe('Shipping: Tampering Protection', () => {
  it('shippingCost in order matches server calculation, not client value', async () => {
    // The order was created with EXPRESSO for CEP 01001000
    // SP Capital base = 10, Expresso = 10 * 1.8 = 18
    const order = await prisma.order.findUnique({ where: { id: testOrderId } });
    expect(Number(order!.shippingCost)).toBe(18); // Expresso price for SP Capital
  });
});
