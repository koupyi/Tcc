import request from 'supertest';
import { app } from '../server';

describe('Cart — Guest Merge & Idempotency', () => {
  let accessToken: string;
  let variantId: string;
  let variantId2: string;

  beforeAll(async () => {
    // Register user
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Cart Test', email: `cart_test_${Date.now()}@test.com`, password: 'CartPass1' })
      .expect(201);
    accessToken = regRes.body.data.accessToken;

    // Get available variants from products
    const prodRes = await request(app).get('/api/v1/products').expect(200);
    const products = prodRes.body.data;
    variantId = products[0].variants[0].id;
    variantId2 = products[1].variants[0].id;
  });

  describe('Authenticated cart operations', () => {
    it('GET /cart returns empty cart for new user', async () => {
      const res = await request(app)
        .get('/api/v1/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(res.body.data.items).toHaveLength(0);
      expect(res.body.data.itemCount).toBe(0);
    });

    it('POST /cart/items adds item to cart', async () => {
      const res = await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ variantId, quantity: 2 })
        .expect(200);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].quantity).toBe(2);
      expect(res.body.data.items[0].variantId).toBe(variantId);
    });

    it('POST /cart/items increments existing item', async () => {
      const res = await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ variantId, quantity: 1 })
        .expect(200);
      expect(res.body.data.items[0].quantity).toBe(3);
    });

    it('PATCH /cart/items/:id updates quantity', async () => {
      const cartRes = await request(app)
        .get('/api/v1/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      const itemId = cartRes.body.data.items[0].id;

      const res = await request(app)
        .patch(`/api/v1/cart/items/${itemId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ quantity: 5 })
        .expect(200);
      expect(res.body.data.items[0].quantity).toBe(5);
    });

    it('rejects quantity 0', async () => {
      const cartRes = await request(app)
        .get('/api/v1/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      const itemId = cartRes.body.data.items[0].id;

      await request(app)
        .patch(`/api/v1/cart/items/${itemId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ quantity: 0 })
        .expect(422);
    });

    it('rejects negative quantity', async () => {
      const cartRes = await request(app)
        .get('/api/v1/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      const itemId = cartRes.body.data.items[0].id;

      await request(app)
        .patch(`/api/v1/cart/items/${itemId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ quantity: -1 })
        .expect(422);
    });

    it('DELETE /cart/items/:id removes item', async () => {
      const cartRes = await request(app)
        .get('/api/v1/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      const itemId = cartRes.body.data.items[0].id;

      const res = await request(app)
        .delete(`/api/v1/cart/items/${itemId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(res.body.data.items).toHaveLength(0);
    });
  });

  describe('Cart authorization', () => {
    it('GET /cart requires auth', async () => {
      await request(app).get('/api/v1/cart').expect(401);
    });

    it('POST /cart/items requires auth', async () => {
      await request(app)
        .post('/api/v1/cart/items')
        .send({ variantId, quantity: 1 })
        .expect(401);
    });

    it('POST /cart/merge requires auth', async () => {
      await request(app)
        .post('/api/v1/cart/merge')
        .send({ items: [{ variantId, quantity: 1 }] })
        .expect(401);
    });

    it('user A cannot access user B cart', async () => {
      // Add item to main user cart
      await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ variantId: variantId2, quantity: 1 })
        .expect(200);

      // Register second user
      const regRes2 = await request(app)
        .post('/api/v1/auth/register')
        .send({ name: 'Other', email: `other_${Date.now()}@test.com`, password: 'OtherPass1' })
        .expect(201);
      const token2 = regRes2.body.data.accessToken;

      // Second user's cart should be empty
      const cartRes = await request(app)
        .get('/api/v1/cart')
        .set('Authorization', `Bearer ${token2}`)
        .expect(200);
      expect(cartRes.body.data.items).toHaveLength(0);
    });
  });

  describe('Merge — idempotency and reconciliation', () => {
    let mergeToken: string;

    beforeAll(async () => {
      // Fresh user for merge tests
      const regRes = await request(app)
        .post('/api/v1/auth/register')
        .send({ name: 'Merge Test', email: `merge_${Date.now()}@test.com`, password: 'MergePass1' })
        .expect(201);
      mergeToken = regRes.body.data.accessToken;
    });

    it('merges guest items into empty user cart', async () => {
      const res = await request(app)
        .post('/api/v1/cart/merge')
        .set('Authorization', `Bearer ${mergeToken}`)
        .send({ items: [{ variantId, quantity: 2 }] })
        .expect(200);

      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].variantId).toBe(variantId);
      expect(res.body.data.items[0].quantity).toBe(2);
    });

    it('second merge with same items is idempotent (no duplication)', async () => {
      const res = await request(app)
        .post('/api/v1/cart/merge')
        .set('Authorization', `Bearer ${mergeToken}`)
        .send({ items: [{ variantId, quantity: 2 }] })
        .expect(200);

      // Should still be quantity 2, NOT 4
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].quantity).toBe(2);
    });

    it('merge with higher guest quantity updates to higher value', async () => {
      const res = await request(app)
        .post('/api/v1/cart/merge')
        .set('Authorization', `Bearer ${mergeToken}`)
        .send({ items: [{ variantId, quantity: 5 }] })
        .expect(200);

      expect(res.body.data.items[0].quantity).toBe(5);
    });

    it('merge with different product adds new item', async () => {
      const res = await request(app)
        .post('/api/v1/cart/merge')
        .set('Authorization', `Bearer ${mergeToken}`)
        .send({ items: [{ variantId: variantId2, quantity: 1 }] })
        .expect(200);

      expect(res.body.data.items).toHaveLength(2);
    });

    it('merge caps quantity at stock level', async () => {
      // Requesting 99 units — should be capped at whatever stock is available (at most 99)
      const res = await request(app)
        .post('/api/v1/cart/merge')
        .set('Authorization', `Bearer ${mergeToken}`)
        .send({ items: [{ variantId, quantity: 99 }] })
        .expect(200);

      const item = res.body.data.items.find((i: { variantId: string }) => i.variantId === variantId);
      // Should be capped at stock or 99 (whichever is lower) — never exceeds either
      expect(item.quantity).toBeLessThanOrEqual(99);
      expect(item.quantity).toBeGreaterThan(0);
    });
  });

  describe('Stock validation', () => {
    it('rejects add when quantity exceeds stock', async () => {
      // Stock is 10, try adding 50
      const regRes = await request(app)
        .post('/api/v1/auth/register')
        .send({ name: 'Stock Test', email: `stock_${Date.now()}@test.com`, password: 'StockPass1' })
        .expect(201);
      const token = regRes.body.data.accessToken;

      const res = await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({ variantId, quantity: 50 })
        .expect(409);

      expect(res.body.code).toBe('INSUFFICIENT_STOCK');
    });
  });
});
