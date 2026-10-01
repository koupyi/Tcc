import request from 'supertest';
import { app } from '../server';
import { prisma } from '../config/database';

// Clean up test user after tests
const TEST_EMAIL = `test-${Date.now()}@integration.test`;
const TEST_PASSWORD = 'TestPass123!';
const TEST_NAME = 'Integration Test User';

let accessToken: string;
let refreshToken: string;
let userId: string;

afterAll(async () => {
  // Cleanup test user
  try {
    if (userId) {
      await prisma.refreshToken.deleteMany({ where: { userId } });
      await prisma.auditLog.deleteMany({ where: { OR: [{ actorId: userId }, { userId }] } });
      await prisma.cartItem.deleteMany({ where: { cart: { userId } } });
      await prisma.cart.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } });
    }
  } catch {
    // Ignore cleanup errors
  }
  await prisma.$disconnect();
});

describe('Health Check', () => {
  it('GET /health → 200', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.environment).toBeDefined();
  });
});

describe('Auth Flow', () => {
  it('POST /api/v1/auth/register → 201 creates user', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD, name: TEST_NAME });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(TEST_EMAIL);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();

    userId = res.body.data.user.id;
    accessToken = res.body.data.accessToken;
    refreshToken = res.body.data.refreshToken;
  });

  it('POST /api/v1/auth/register → 409 duplicate email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD, name: TEST_NAME });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/v1/auth/login → 200 with correct credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(TEST_EMAIL);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();

    // Update tokens for subsequent tests
    accessToken = res.body.data.accessToken;
    refreshToken = res.body.data.refreshToken;
  });

  it('POST /api/v1/auth/login → 401 with wrong password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: TEST_EMAIL, password: 'WrongPassword123!' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('GET /api/v1/auth/me → 200 with valid token', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(TEST_EMAIL);
    expect(res.body.data.user.id).toBe(userId);
  });

  it('GET /api/v1/auth/me → 401 without token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/auth/me → 401 with invalid token', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer invalid-token-here');
    expect(res.status).toBe(401);
  });
});

describe('Products', () => {
  it('GET /api/v1/products → 200 returns product list', async () => {
    const res = await request(app).get('/api/v1/products');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);

    const product = res.body.data[0];
    expect(product.id).toBeDefined();
    expect(product.name).toBeDefined();
    expect(product.basePrice).toBeDefined();
    expect(product.variants).toBeDefined();
  });

  it('GET /api/v1/products?page=1&limit=2 → pagination works', async () => {
    const res = await request(app).get('/api/v1/products?page=1&limit=2');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(2);
    expect(res.body.meta).toBeDefined();
    expect(res.body.meta.page).toBe(1);
    expect(res.body.meta.limit).toBe(2);
    expect(res.body.meta.total).toBeGreaterThan(0);
    expect(res.body.meta.totalPages).toBeGreaterThanOrEqual(1);
    expect(typeof res.body.meta.hasNext).toBe('boolean');
    expect(typeof res.body.meta.hasPrev).toBe('boolean');
  });

  it('GET /api/v1/products?search=Red → search works', async () => {
    const res = await request(app).get('/api/v1/products?search=Red');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].name).toContain('Red');
  });

  it('GET /api/v1/products?sortBy=price&sortOrder=asc → sort works', async () => {
    const res = await request(app).get('/api/v1/products?sortBy=price&sortOrder=asc');
    expect(res.status).toBe(200);
    const prices = res.body.data.map((p: { basePrice: string }) => Number(p.basePrice));
    for (let i = 1; i < prices.length; i++) {
      expect(prices[i]).toBeGreaterThanOrEqual(prices[i - 1]);
    }
  });

  it('GET /api/v1/products/slug/:slug → 200 returns product detail', async () => {
    const res = await request(app).get('/api/v1/products/slug/teclado-mecanico-red');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.slug).toBe('teclado-mecanico-red');
    expect(res.body.data.name).toBeDefined();
    expect(res.body.data.basePrice).toBeDefined();
    expect(res.body.data.category).toBeDefined();
    expect(res.body.data.category.name).toBeDefined();
    expect(Array.isArray(res.body.data.images)).toBe(true);
    expect(Array.isArray(res.body.data.variants)).toBe(true);
    expect(res.body.data.variants.length).toBeGreaterThan(0);
    expect(res.body.data.variants[0].stockQty).toBeDefined();
  });

  it('GET /api/v1/products/slug/non-existent → 404', async () => {
    const res = await request(app).get('/api/v1/products/slug/produto-que-nao-existe');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('NOT_FOUND');
  });
});

describe('Categories', () => {
  it('GET /api/v1/categories → 200 returns category list', async () => {
    const res = await request(app).get('/api/v1/categories');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);

    const category = res.body.data[0];
    expect(category.id).toBeDefined();
    expect(category.name).toBeDefined();
    expect(category.slug).toBeDefined();
    expect(category._count).toBeDefined();
    expect(typeof category._count.products).toBe('number');
  });

  it('GET /api/v1/categories → public (no auth needed)', async () => {
    const res = await request(app).get('/api/v1/categories');
    expect(res.status).toBe(200);
  });

  it('GET /api/v1/categories/slug/teclados-mecanicos → 200 returns category', async () => {
    const res = await request(app).get('/api/v1/categories/slug/teclados-mecanicos');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.slug).toBe('teclados-mecanicos');
    expect(res.body.data.name).toBe('Teclados Mecânicos');
    expect(res.body.data._count).toBeDefined();
  });

  it('GET /api/v1/categories/slug/non-existent → 404', async () => {
    const res = await request(app).get('/api/v1/categories/slug/categoria-inexistente');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('GET /api/v1/products?categoryId=:id → filters by category', async () => {
    // First get a category ID
    const catRes = await request(app).get('/api/v1/categories');
    const category = catRes.body.data.find((c: { _count: { products: number } }) => c._count.products > 0);
    expect(category).toBeDefined();

    // Then filter products by that category
    const res = await request(app).get(`/api/v1/products?categoryId=${category.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);

    // All products should belong to this category
    for (const product of res.body.data) {
      expect(product.category.id).toBe(category.id);
    }
  });
});

describe('Cart Flow', () => {
  let cartItemId: string;
  let variantId: string;

  beforeAll(async () => {
    // Get a valid variant ID from the database
    const variant = await prisma.productVariant.findFirst({
      where: { isActive: true, deletedAt: null },
    });
    if (!variant) throw new Error('No product variant found for cart tests');
    variantId = variant.id;
  });

  it('GET /api/v1/cart → 200 returns cart (auto-created)', async () => {
    const res = await request(app)
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items).toBeDefined();
    expect(res.body.data.subtotal).toBeDefined();
    expect(res.body.data.itemCount).toBeDefined();
  });

  it('GET /api/v1/cart → 401 without token', async () => {
    const res = await request(app).get('/api/v1/cart');
    expect(res.status).toBe(401);
  });

  it('POST /api/v1/cart/items → 200 adds item', async () => {
    const res = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ variantId, quantity: 2 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items.length).toBe(1);
    expect(res.body.data.items[0].variantId).toBe(variantId);
    expect(res.body.data.items[0].quantity).toBe(2);
    expect(res.body.data.itemCount).toBe(2);

    cartItemId = res.body.data.items[0].id;
  });

  it('POST /api/v1/cart/items → upserts same variant (adds quantity)', async () => {
    const res = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ variantId, quantity: 1 });

    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBe(1);
    expect(res.body.data.items[0].quantity).toBe(3);
    expect(res.body.data.itemCount).toBe(3);

    cartItemId = res.body.data.items[0].id;
  });

  it('PATCH /api/v1/cart/items/:id → 200 updates quantity', async () => {
    const res = await request(app)
      .patch(`/api/v1/cart/items/${cartItemId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ quantity: 5 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items[0].quantity).toBe(5);
  });

  it('DELETE /api/v1/cart/items/:id → 200 removes item', async () => {
    const res = await request(app)
      .delete(`/api/v1/cart/items/${cartItemId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBe(0);
    expect(res.body.data.itemCount).toBe(0);
  });

  it('Cart persists across sessions', async () => {
    // Add item
    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ variantId, quantity: 1 });

    // Login again (new session)
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

    const newToken = loginRes.body.data.accessToken;

    // Get cart with new token — item should persist
    const cartRes = await request(app)
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${newToken}`);

    expect(cartRes.status).toBe(200);
    expect(cartRes.body.data.items.length).toBe(1);
    expect(cartRes.body.data.items[0].variantId).toBe(variantId);
  });
});

describe('Auth Logout', () => {
  it('POST /api/v1/auth/logout → 200 revokes refresh token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
