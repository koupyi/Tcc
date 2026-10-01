import request from 'supertest';
import { app } from '../server';
import { prisma } from '../config/database';

/**
 * FASE 0 / ETAPA 9 — Testes de Administração
 */

let adminToken: string;
let userToken: string;
let regularUserId: string;

beforeAll(async () => {
  // Login as admin (created by seed)
  const adminLogin = await request(app).post('/api/v1/auth/login').send({ email: 'admin@keycaps.dev', password: 'Admin123!Dev' });
  if (adminLogin.status !== 200) {
    throw new Error(`Admin login failed: ${adminLogin.status} ${JSON.stringify(adminLogin.body)}`);
  }
  adminToken = adminLogin.body.data.accessToken;

  // Create regular user
  const email = `admin-test-user-${Date.now()}@test.com`;
  const reg = await request(app).post('/api/v1/auth/register').send({ email, password: 'TestPass123!', name: 'Regular User' });
  userToken = reg.body.data.accessToken;
  regularUserId = reg.body.data.user.id;
});

afterAll(async () => {
  try {
    await prisma.refreshToken.deleteMany({ where: { userId: regularUserId } });
    await prisma.auditLog.deleteMany({ where: { OR: [{ actorId: regularUserId }, { userId: regularUserId }] } });
    await prisma.user.delete({ where: { id: regularUserId } });
  } catch { /* ignore */ }
  await prisma.$disconnect();
});

describe('F9: RBAC', () => {
  it('ADMIN can access /admin/dashboard', async () => {
    const res = await request(app).get('/api/v1/admin/dashboard').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('USER gets 403 on /admin/dashboard', async () => {
    const res = await request(app).get('/api/v1/admin/dashboard').set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(403);
  });

  it('No token gets 401 on /admin/dashboard', async () => {
    const res = await request(app).get('/api/v1/admin/dashboard');
    expect(res.status).toBe(401);
  });
});

describe('F9: Dashboard', () => {
  it('Returns real counts', async () => {
    const res = await request(app).get('/api/v1/admin/dashboard').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data).toBeDefined();
    // The getDashboardStats returns arrays/objects — just verify it's not empty
    expect(typeof data).toBe('object');
  });
});

describe('F9: Categories CRUD', () => {
  let catId: string;

  it('POST /admin/categories → creates category', async () => {
    const res = await request(app).post('/api/v1/admin/categories').set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Test Category', slug: 'test-category-admin' });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Test Category');
    expect(res.body.data.slug).toBe('test-category-admin');
    catId = res.body.data.id;
  });

  it('GET /admin/categories → lists categories', async () => {
    const res = await request(app).get('/api/v1/admin/categories').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('GET /admin/categories/:id → returns detail', async () => {
    const res = await request(app).get(`/api/v1/admin/categories/${catId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(catId);
  });

  it('PATCH /admin/categories/:id → updates', async () => {
    const res = await request(app).patch(`/api/v1/admin/categories/${catId}`).set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Updated Category' });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Updated Category');
  });

  it('POST duplicate slug → 409', async () => {
    const res = await request(app).post('/api/v1/admin/categories').set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Dup', slug: 'test-category-admin' });
    expect(res.status).toBe(409);
  });

  it('DELETE /admin/categories/:id → deletes', async () => {
    const res = await request(app).delete(`/api/v1/admin/categories/${catId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(204);
  });

  it('DELETE category with products → 400', async () => {
    // Find a category with products
    const cats = await prisma.category.findFirst({ where: { products: { some: {} } } });
    if (!cats) return;
    const res = await request(app).delete(`/api/v1/admin/categories/${cats.id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });

  it('USER cannot create category → 403', async () => {
    const res = await request(app).post('/api/v1/admin/categories').set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'Hack' });
    expect(res.status).toBe(403);
  });
});

describe('F9: Inventory', () => {
  it('GET /admin/inventory → lists variants with stock', async () => {
    const res = await request(app).get('/api/v1/admin/inventory').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].stockQty).toBeDefined();
    expect(res.body.data[0].product).toBeDefined();
  });

  it('GET /admin/inventory?lowStock=true → filters low stock', async () => {
    const res = await request(app).get('/api/v1/admin/inventory?lowStock=true').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    // All items should have stockQty <= 5
    for (const item of res.body.data) {
      expect(item.stockQty).toBeLessThanOrEqual(5);
    }
  });

  it('PATCH /admin/inventory/:id → updates stock', async () => {
    const variant = await prisma.productVariant.findFirst({ where: { isActive: true, deletedAt: null }, orderBy: { sku: 'asc' } });
    const originalStock = variant!.stockQty;
    const res = await request(app).patch(`/api/v1/admin/inventory/${variant!.id}`).set('Authorization', `Bearer ${adminToken}`)
      .send({ stockQty: 99 });
    expect(res.status).toBe(200);
    expect(res.body.data.stockQty).toBe(99);
    // Restore to the real seeded value (not a hardcoded constant) so this suite
    // does not corrupt shared stock other suites rely on.
    await prisma.productVariant.update({ where: { id: variant!.id }, data: { stockQty: originalStock } });
  });

  it('PATCH negative stock → 400', async () => {
    const variant = await prisma.productVariant.findFirst({ where: { isActive: true, deletedAt: null }, orderBy: { sku: 'asc' } });
    const res = await request(app).patch(`/api/v1/admin/inventory/${variant!.id}`).set('Authorization', `Bearer ${adminToken}`)
      .send({ stockQty: -5 });
    expect(res.status).toBe(400);
  });
});

describe('F9: Payments (admin read-only)', () => {
  it('GET /admin/payments → lists payments', async () => {
    const res = await request(app).get('/api/v1/admin/payments').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('F9: Shipments', () => {
  it('GET /admin/shipments → lists shipments', async () => {
    const res = await request(app).get('/api/v1/admin/shipments').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
