import request from 'supertest';
import { app } from '../server';
import { prisma } from '../config/database';

/**
 * FASE 0 / ETAPA 10 — Testes de Segurança, LGPD e Qualidade
 */

let userToken: string;
let userId: string;
let adminToken: string;

beforeAll(async () => {
  // Create test user
  const email = `security-test-${Date.now()}@test.com`;
  const res = await request(app).post('/api/v1/auth/register').send({ email, password: 'TestPass123!', name: 'Security Test' });
  userToken = res.body.data.accessToken;
  userId = res.body.data.user.id;

  // Login admin
  const adminRes = await request(app).post('/api/v1/auth/login').send({ email: 'admin@keycaps.dev', password: 'Admin123!Dev' });
  adminToken = adminRes.body.data.accessToken;
});

afterAll(async () => {
  try {
    await prisma.notificationDelivery.deleteMany({ where: { userId } });
    await prisma.cartItem.deleteMany({ where: { cart: { userId } } });
    await prisma.cart.deleteMany({ where: { userId } });
    await prisma.address.deleteMany({ where: { userId } });
    await prisma.refreshToken.deleteMany({ where: { userId } });
    await prisma.auditLog.deleteMany({ where: { OR: [{ actorId: userId }, { userId }] } });
    await prisma.user.deleteMany({ where: { id: userId } });
  } catch { /* ignore */ }
  await prisma.$disconnect();
});

// ==========================================
// AUTH SECURITY
// ==========================================

describe('Security: Auth', () => {
  it('Invalid token → 401', async () => {
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', 'Bearer invalid-token');
    expect(res.status).toBe(401);
  });

  it('No token → 401', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('Malformed auth header → 401', async () => {
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', 'NotBearer token');
    expect(res.status).toBe(401);
  });

  it('USER accessing admin → 403', async () => {
    const res = await request(app).get('/api/v1/admin/dashboard').set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(403);
  });

  it('ADMIN accessing admin → 200', async () => {
    const res = await request(app).get('/api/v1/admin/dashboard').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  it('Password not returned in /me', async () => {
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(res.body.data.user.password).toBeUndefined();
  });
});

// ==========================================
// IDOR
// ==========================================

describe('Security: IDOR', () => {
  it('User cannot access another user order', async () => {
    // Find an order not belonging to test user
    const order = await prisma.order.findFirst({ where: { userId: { not: userId } } });
    if (!order) return; // No other orders exist
    const res = await request(app).get(`/api/v1/orders/${order.id}`).set('Authorization', `Bearer ${userToken}`);
    expect([403, 404]).toContain(res.status);
  });

  it('User cannot access another user shipping', async () => {
    const shipment = await prisma.shipment.findFirst({ where: { order: { userId: { not: userId } } } });
    if (!shipment) return;
    const res = await request(app).get(`/api/v1/shipping/orders/${shipment.orderId}`).set('Authorization', `Bearer ${userToken}`);
    expect([403, 404]).toContain(res.status);
  });
});

// ==========================================
// HEADERS
// ==========================================

describe('Security: Headers', () => {
  it('Helmet headers present', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
  });

  it('Content-Type protection', async () => {
    const res = await request(app).get('/api/v1/products');
    expect(res.headers['content-type']).toContain('application/json');
  });
});

// ==========================================
// CORS
// ==========================================

describe('Security: CORS', () => {
  it('Allowed origin gets CORS headers', async () => {
    const res = await request(app)
      .options('/api/v1/products')
      .set('Origin', 'http://localhost:8080')
      .set('Access-Control-Request-Method', 'GET');
    expect(res.headers['access-control-allow-origin']).toBeDefined();
  });
});

// ==========================================
// INPUT VALIDATION
// ==========================================

describe('Security: Input Validation', () => {
  it('Invalid email format rejected', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({ email: 'not-an-email', password: 'Test123!', name: 'X' });
    expect(res.status).toBe(422);
  });

  it('Short password rejected', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({ email: 'valid@test.com', password: '123', name: 'X' });
    expect(res.status).toBe(422);
  });

  it('Negative quantity rejected', async () => {
    const res = await request(app).post('/api/v1/cart/items').set('Authorization', `Bearer ${userToken}`).send({ variantId: '00000000-0000-0000-0000-000000000000', quantity: -1 });
    expect(res.status).toBe(422);
  });

  it('Non-integer quantity rejected', async () => {
    const res = await request(app).post('/api/v1/cart/items').set('Authorization', `Bearer ${userToken}`).send({ variantId: '00000000-0000-0000-0000-000000000000', quantity: 1.5 });
    expect(res.status).toBe(422);
  });
});

// ==========================================
// LGPD
// ==========================================

describe('Security: LGPD', () => {
  it('GET /auth/me/data-export → returns user data', async () => {
    const res = await request(app).get('/api/v1/auth/me/data-export').set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.user).toBeDefined();
    expect(res.body.data.user.email).toBeDefined();
    expect(res.body.data.user.id).toBe(userId);
    expect(res.body.data.addresses).toBeDefined();
    expect(res.body.data.orders).toBeDefined();
    // Must NOT contain passwordHash
    expect(res.body.data.user.passwordHash).toBeUndefined();
  });

  it('Data export without auth → 401', async () => {
    const res = await request(app).get('/api/v1/auth/me/data-export');
    expect(res.status).toBe(401);
  });

  it('DELETE /auth/me/account → anonymizes user', async () => {
    // Create a sacrificial user
    const email = `lgpd-delete-${Date.now()}@test.com`;
    const reg = await request(app).post('/api/v1/auth/register').send({ email, password: 'TestPass123!', name: 'LGPD Delete' });
    const deleteToken = reg.body.data.accessToken;
    const deleteUserId = reg.body.data.user.id;

    const res = await request(app).delete('/api/v1/auth/me/account').set('Authorization', `Bearer ${deleteToken}`);
    expect(res.status).toBe(204);

    // Verify anonymization
    const user = await prisma.user.findUnique({ where: { id: deleteUserId } });
    expect(user).not.toBeNull();
    expect(user!.email).toContain('anonymized');
    expect(user!.name).toBe('Usuário Removido');
    expect(user!.phone).toBeNull();
    expect(user!.isActive).toBe(false);
    expect(user!.passwordHash).toBe('DELETED');

    // Token should no longer work (user is inactive/anonymized)
    // The key check is: login is impossible with original credentials

    // Verify login impossible
    const loginRes = await request(app).post('/api/v1/auth/login').send({ email, password: 'TestPass123!' });
    expect(loginRes.status).toBe(401); // Email changed → user not found

    // Cleanup
    await prisma.notificationDelivery.deleteMany({ where: { userId: deleteUserId } });
    await prisma.auditLog.deleteMany({ where: { OR: [{ actorId: deleteUserId }, { userId: deleteUserId }] } });
    await prisma.user.delete({ where: { id: deleteUserId } });
  });

  it('Account deletion without auth → 401', async () => {
    const res = await request(app).delete('/api/v1/auth/me/account');
    expect(res.status).toBe(401);
  });
});

// ==========================================
// WEBHOOK SECURITY
// ==========================================

describe('Security: Webhook', () => {
  it('Webhook without valid signature → 401 or 400', async () => {
    const res = await request(app)
      .post('/api/v1/payments/webhook')
      .set('x-webhook-signature', 'fake-signature')
      .send({ paymentId: 'fake', status: 'approved', eventId: 'x' });
    expect([400, 401]).toContain(res.status);
  });

  it('Webhook with missing payload → 400', async () => {
    const res = await request(app).post('/api/v1/payments/webhook').send({});
    expect(res.status).toBe(400);
  });
});

// ==========================================
// SECRETS NOT EXPOSED
// ==========================================

describe('Security: Secrets', () => {
  it('API responses do not contain tokens or secrets', async () => {
    const res = await request(app).get('/api/v1/products');
    const body = JSON.stringify(res.body);
    expect(body).not.toContain('JWT_ACCESS_SECRET');
    expect(body).not.toContain('JWT_REFRESH_SECRET');
    expect(body).not.toContain('MERCADOPAGO_ACCESS_TOKEN');
  });
});
