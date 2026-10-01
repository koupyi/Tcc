import request from 'supertest';
import { app } from '../server';
import { prisma } from '../config/database';

describe('Community Builds', () => {
  let accessToken: string;

  beforeAll(async () => {
    // The 'holy-panda' switch is seeded deliberately out-of-stock so the
    // 'seed-build-botanical-garden' build demonstrates partial availability.
    // Other suites sharing this database can restock it (order cancellation
    // increments stock), which would make this suite order-dependent. Force the
    // documented precondition here so the assertions are deterministic in CI.
    await prisma.productVariant.updateMany({
      where: { product: { slug: 'holy-panda' } },
      data: { stockQty: 0 },
    });

    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Build Test', email: `build_test_${Date.now()}@test.com`, password: 'BuildPass1' })
      .expect(201);
    accessToken = regRes.body.data.accessToken;
  });

  describe('GET /community-builds', () => {
    it('lists real, catalog-backed builds', async () => {
      const res = await request(app).get('/api/v1/community-builds').expect(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(3);

      const build = res.body.data.find((b: { id: string }) => b.id === 'seed-build-midnight-purple');
      expect(build).toBeDefined();
      expect(build.totalComponents).toBeGreaterThan(0);
      expect(typeof build.estimatedPrice).toBe('number');
      // Every item must resolve to a real product/variant — no free-text components.
      for (const item of build.items) {
        expect(item.productId).toBeTruthy();
        expect(item.variantId).toBeTruthy();
      }
    });
  });

  describe('GET /community-builds/:id', () => {
    it('reports a fully-available build as N/N', async () => {
      const res = await request(app).get('/api/v1/community-builds/seed-build-midnight-purple').expect(200);
      const build = res.body.data;
      expect(build.availableComponents).toBe(build.totalComponents);
      expect(build.items.every((i: { available: boolean }) => i.available)).toBe(true);
    });

    it('reports a partially-available build honestly (deliberately out-of-stock component)', async () => {
      const res = await request(app).get('/api/v1/community-builds/seed-build-botanical-garden').expect(200);
      const build = res.body.data;
      expect(build.totalComponents).toBe(4);
      expect(build.availableComponents).toBe(3);

      const outOfStockItem = build.items.find((i: { productSlug: string }) => i.productSlug === 'holy-panda');
      expect(outOfStockItem).toBeDefined();
      expect(outOfStockItem.available).toBe(false);
      expect(outOfStockItem.stockQty).toBe(0);
    });

    it('computes the estimated price server-side from live variant/product prices', async () => {
      const res = await request(app).get('/api/v1/community-builds/seed-build-vintage-terminal').expect(200);
      const build = res.body.data;
      const expectedSum = build.items.reduce((sum: number, i: { unitPrice: number }) => sum + i.unitPrice, 0);
      expect(build.estimatedPrice).toBeCloseTo(expectedSum, 2);
    });

    it('returns 404 for a build that does not exist', async () => {
      await request(app).get('/api/v1/community-builds/does-not-exist').expect(404);
    });
  });

  describe('POST /community-builds/:id/add-to-cart', () => {
    it('requires authentication', async () => {
      await request(app).post('/api/v1/community-builds/seed-build-midnight-purple/add-to-cart').expect(401);
    });

    it('adds every available component to the authenticated cart and skips unavailable ones', async () => {
      const res = await request(app)
        .post('/api/v1/community-builds/seed-build-botanical-garden/add-to-cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.data.added.length).toBe(3);
      expect(res.body.data.skipped.length).toBe(1);
      expect(res.body.data.skipped[0].reason).toMatch(/estoque/i);

      const cartRes = await request(app)
        .get('/api/v1/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(cartRes.body.data.items.length).toBeGreaterThanOrEqual(3);

      // Server-authoritative price: the cart's unitPrice must match the build's
      // live-resolved unitPrice, never a value the client could have supplied.
      const buildRes = await request(app).get('/api/v1/community-builds/seed-build-botanical-garden').expect(200);
      const availableItem = buildRes.body.data.items.find((i: { available: boolean }) => i.available);
      const cartItem = cartRes.body.data.items.find((i: { variantId: string }) => i.variantId === availableItem.variantId);
      expect(Number(cartItem.unitPrice)).toBeCloseTo(availableItem.unitPrice, 2);
    });

    it('ignores any client-supplied body (mass-assignment safe — price/stock are never trusted from the client)', async () => {
      const res = await request(app)
        .post('/api/v1/community-builds/seed-build-vintage-terminal/add-to-cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ unitPrice: 1, price: 0.01, isActive: true, stockQty: 9999 })
        .expect(200);

      // Prices charged must still match the real catalog price, not the injected body.
      const buildRes = await request(app).get('/api/v1/community-builds/seed-build-vintage-terminal').expect(200);
      for (const added of res.body.data.added) {
        const original = buildRes.body.data.items.find((i: { variantId: string }) => i.variantId === added.variantId);
        expect(original.unitPrice).toBeGreaterThan(1);
      }
    });

    it('returns 404 for a build that does not exist', async () => {
      await request(app)
        .post('/api/v1/community-builds/does-not-exist/add-to-cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  describe('POST /community-builds/:id/like', () => {
    it('increments the like counter for anyone (guest or authenticated)', async () => {
      const before = await request(app).get('/api/v1/community-builds/seed-build-midnight-purple').expect(200);
      const res = await request(app).post('/api/v1/community-builds/seed-build-midnight-purple/like').expect(200);
      expect(res.body.data.likes).toBe(before.body.data.likes + 1);
    });
  });
});
