import request from 'supertest';
import { app } from '../server';
import { prisma } from '../config/database';

/**
 * CLOSURE PHASE — Admin Order Detail + Customer IDOR Protection
 *
 * Gates:
 *  - ADMIN_ORDER_DETAIL: admin can read ANY order's full detail via /admin/orders/:id
 *  - ADMIN_ORDER_LIST: admin can list all orders via /admin/orders
 *  - ADMIN_ORDER_STATUS_UPDATE: admin can advance status via the state machine
 *  - INVALID_STATUS_TRANSITION: backend rejects an illegal transition
 *  - CUSTOMER_IDOR_PROTECTION: a customer CANNOT read another user's order via /orders/:id
 */

let adminToken: string;
let ownerUser: { id: string; token: string; email: string };
let otherUser: { id: string; token: string; email: string };
let variantId: string;
let originalStock: number;
let addressId: string;
let orderId: string;

beforeAll(async () => {
  // Admin (from seed)
  const adminLogin = await request(app).post('/api/v1/auth/login').send({ email: 'admin@keycaps.dev', password: 'Admin123!Dev' });
  if (adminLogin.status !== 200) {
    throw new Error(`Admin login failed: ${adminLogin.status} ${JSON.stringify(adminLogin.body)}`);
  }
  adminToken = adminLogin.body.data.accessToken;

  // Owner (creates the order) + another regular user (the attacker)
  const ownerEmail = `admin-order-owner-${Date.now()}@test.com`;
  const ownerReg = await request(app).post('/api/v1/auth/register').send({ email: ownerEmail, password: 'TestPass123!', name: 'Order Owner' });
  ownerUser = { id: ownerReg.body.data.user.id, token: ownerReg.body.data.accessToken, email: ownerEmail };

  const otherEmail = `admin-order-other-${Date.now()}@test.com`;
  const otherReg = await request(app).post('/api/v1/auth/register').send({ email: otherEmail, password: 'TestPass123!', name: 'Other User' });
  otherUser = { id: otherReg.body.data.user.id, token: otherReg.body.data.accessToken, email: otherEmail };

  // Stock + address for the owner
  const variant = await prisma.productVariant.findFirst({ where: { isActive: true, deletedAt: null } });
  variantId = variant!.id;
  originalStock = variant!.stockQty;
  await prisma.productVariant.update({ where: { id: variantId }, data: { stockQty: 20 } });

  const addr = await prisma.address.create({
    data: { userId: ownerUser.id, recipientName: 'Order Owner', street: 'Rua Admin', number: '10', city: 'São Paulo', state: 'SP', zipCode: '01001000', country: 'BR' },
  });
  addressId = addr.id;

  // Create an order as the owner (cart -> order)
  await request(app).post('/api/v1/cart/items').set('Authorization', `Bearer ${ownerUser.token}`).send({ variantId, quantity: 2 });
  const orderRes = await request(app).post('/api/v1/orders').set('Authorization', `Bearer ${ownerUser.token}`).send({ addressId, paymentMethod: 'PIX' });
  if (orderRes.status !== 201) {
    throw new Error(`Order creation failed: ${orderRes.status} ${JSON.stringify(orderRes.body)}`);
  }
  orderId = orderRes.body.data.id;
});

afterAll(async () => {
  await prisma.productVariant.update({ where: { id: variantId }, data: { stockQty: originalStock } });
  for (const uid of [ownerUser.id, otherUser.id]) {
    try {
      await prisma.stockLog.deleteMany({ where: { reference: { not: null }, variant: {} } });
      await prisma.orderItem.deleteMany({ where: { order: { userId: uid } } });
      await prisma.payment.deleteMany({ where: { order: { userId: uid } } });
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

describe('ADMIN_ORDER_LIST', () => {
  it('GET /admin/orders → admin lists all orders', async () => {
    const res = await request(app).get('/api/v1/admin/orders').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('USER gets 403 on /admin/orders', async () => {
    const res = await request(app).get('/api/v1/admin/orders').set('Authorization', `Bearer ${otherUser.token}`);
    expect(res.status).toBe(403);
  });

  it('No token gets 401 on /admin/orders', async () => {
    const res = await request(app).get('/api/v1/admin/orders');
    expect(res.status).toBe(401);
  });
});

describe('ADMIN_ORDER_DETAIL', () => {
  it('GET /admin/orders/:id → admin sees full detail of ANY order (items, payment, shipment, user)', async () => {
    const res = await request(app).get(`/api/v1/admin/orders/${orderId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.id).toBe(orderId);
    expect(data.orderNumber).toBeDefined();
    expect(Array.isArray(data.items)).toBe(true);
    expect(data.items.length).toBeGreaterThan(0);
    // Price snapshot on each item
    expect(data.items[0].productName).toBeDefined();
    expect(data.items[0].variantName).toBeDefined();
    expect(data.items[0].unitPrice).toBeDefined();
    // Customer, payment, shipment present
    expect(data.user).toBeDefined();
    expect(data.user.id).toBe(ownerUser.id);
    expect(data.payment).toBeDefined();
    expect(data.shipment).toBeDefined();
    // Totals + dates
    expect(data.subtotal).toBeDefined();
    expect(data.total).toBeDefined();
    expect(data.createdAt).toBeDefined();
  });

  it('GET /admin/orders/:id with unknown id → 404', async () => {
    const res = await request(app).get('/api/v1/admin/orders/nonexistent-id-123').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  it('USER gets 403 on /admin/orders/:id', async () => {
    const res = await request(app).get(`/api/v1/admin/orders/${orderId}`).set('Authorization', `Bearer ${otherUser.token}`);
    expect(res.status).toBe(403);
  });
});

describe('CUSTOMER_IDOR_PROTECTION', () => {
  it('Owner CAN read own order via GET /orders/:id', async () => {
    const res = await request(app).get(`/api/v1/orders/${orderId}`).set('Authorization', `Bearer ${ownerUser.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(orderId);
  });

  it('Another customer CANNOT read the order via GET /orders/:id → 403', async () => {
    const res = await request(app).get(`/api/v1/orders/${orderId}`).set('Authorization', `Bearer ${otherUser.token}`);
    expect(res.status).toBe(403);
  });
});

describe('ADMIN_ORDER_STATUS_UPDATE + INVALID_STATUS_TRANSITION', () => {
  it('PATCH /admin/orders/:id/status → valid transition PENDING → CONFIRMED', async () => {
    const res = await request(app).patch(`/api/v1/admin/orders/${orderId}/status`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'CONFIRMED' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('CONFIRMED');
  });

  it('PATCH invalid transition CONFIRMED → DELIVERED → 400 (rejected by state machine)', async () => {
    const res = await request(app).patch(`/api/v1/admin/orders/${orderId}/status`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'DELIVERED' });
    expect(res.status).toBe(400);
  });

  it('USER cannot change order status → 403', async () => {
    const res = await request(app).patch(`/api/v1/admin/orders/${orderId}/status`).set('Authorization', `Bearer ${otherUser.token}`).send({ status: 'PROCESSING' });
    expect(res.status).toBe(403);
  });
});
