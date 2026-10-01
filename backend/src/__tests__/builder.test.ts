import request from 'supertest';
import { app } from '../server';

interface BuilderOptionLite {
  productId: string;
  variantId: string;
  name: string;
  layout: string | null;
  switchType: string | null;
  stockQty: number;
  unitPrice: number;
  slug: string;
}

describe('Builder', () => {
  let accessToken: string;
  let options: Record<string, BuilderOptionLite[]>;

  const findBySlug = (cat: string, slug: string) => options[cat].find((o) => o.slug === slug)!;

  beforeAll(async () => {
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Builder Test', email: `builder_test_${Date.now()}@test.com`, password: 'BuilderPass1' })
      .expect(201);
    accessToken = regRes.body.data.accessToken;

    const optRes = await request(app).get('/api/v1/builder/options').expect(200);
    options = optRes.body.data.options;
  });

  describe('GET /builder/options', () => {
    it('returns real Product/ProductVariant identity for every category — no phantom items', () => {
      for (const cat of ['case', 'pcb', 'plate', 'switch', 'keycap', 'extra']) {
        expect(options[cat].length).toBeGreaterThan(0);
        for (const opt of options[cat]) {
          expect(opt.productId).toBeTruthy();
          expect(opt.variantId).toBeTruthy();
          expect(typeof opt.unitPrice).toBe('number');
          expect(typeof opt.stockQty).toBe('number');
        }
      }
    });

    it('includes the deliberately out-of-stock PCB with stockQty 0 (not hidden)', () => {
      const oos = findBySlug('pcb', 'pcb-solder-tkl');
      expect(oos.stockQty).toBe(0);
    });
  });

  describe('POST /builder/validate — compatibility', () => {
    it('layout=75 + case 75 → compatible', async () => {
      const case75 = findBySlug('case', 'case-modular-75');
      const res = await request(app)
        .post('/api/v1/builder/validate')
        .send({ layout: '75', items: [{ category: 'case', variantId: case75.variantId, quantity: 1 }] })
        .expect(200);
      expect(res.body.data.items[0].valid).toBe(true);
    });

    it('layout=75 + case 60 → incompatible with reason', async () => {
      const case60 = findBySlug('case', 'case-bakeneko60');
      const res = await request(app)
        .post('/api/v1/builder/validate')
        .send({ layout: '75', items: [{ category: 'case', variantId: case60.variantId, quantity: 1 }] })
        .expect(200);
      expect(res.body.data.items[0].valid).toBe(false);
      expect(res.body.data.items[0].reason).toMatch(/layout/i);
    });

    it('PCB compatible with matching layout', async () => {
      const pcb65 = findBySlug('pcb', 'pcb-hotswap-65');
      const res = await request(app)
        .post('/api/v1/builder/validate')
        .send({ layout: '65', items: [{ category: 'pcb', variantId: pcb65.variantId, quantity: 1 }] })
        .expect(200);
      expect(res.body.data.items[0].valid).toBe(true);
    });

    it('PCB incompatible with mismatched layout — FAIL + reason', async () => {
      const pcb65 = findBySlug('pcb', 'pcb-hotswap-65');
      const res = await request(app)
        .post('/api/v1/builder/validate')
        .send({ layout: '75', items: [{ category: 'pcb', variantId: pcb65.variantId, quantity: 1 }] })
        .expect(200);
      expect(res.body.data.items[0].valid).toBe(false);
      expect(res.body.data.items[0].reason).toBeTruthy();
    });

    it('Plate incompatible with mismatched layout — FAIL + reason', async () => {
      const plate60 = findBySlug('plate', 'plate-policarbonato-60');
      const res = await request(app)
        .post('/api/v1/builder/validate')
        .send({ layout: '75', items: [{ category: 'plate', variantId: plate60.variantId, quantity: 1 }] })
        .expect(200);
      expect(res.body.data.items[0].valid).toBe(false);
    });

    it('Switch mount family incompatible with an MX PCB already in the config', async () => {
      const optical = findBySlug('switch', 'switch-optico-flaretech');
      const pcb75 = findBySlug('pcb', 'pcb-hotswap-75');
      const res = await request(app)
        .post('/api/v1/builder/validate')
        .send({
          layout: '75',
          items: [
            { category: 'pcb', variantId: pcb75.variantId, quantity: 1 },
            { category: 'switch', variantId: optical.variantId, quantity: 1 },
          ],
        })
        .expect(200);
      const switchResult = res.body.data.items.find((i: { category: string }) => i.category === 'switch');
      expect(switchResult.valid).toBe(false);
      expect(switchResult.reason).toMatch(/switch/i);
    });

    it('Keycap set that only covers 65% is incompatible with a 75% layout', async () => {
      const kc65 = findBySlug('keycap', 'keycaps-mt3-compact');
      const res = await request(app)
        .post('/api/v1/builder/validate')
        .send({ layout: '75', items: [{ category: 'keycap', variantId: kc65.variantId, quantity: 1 }] })
        .expect(200);
      expect(res.body.data.items[0].valid).toBe(false);
      expect(res.body.data.items[0].reason).toMatch(/layout|cobre/i);
    });

    it('a keycap set that covers a larger layout than the board is compatible', async () => {
      const kcFull = findBySlug('keycap', 'keycaps-gmk-laser'); // layout='full', covers everything
      const res = await request(app)
        .post('/api/v1/builder/validate')
        .send({ layout: '65', items: [{ category: 'keycap', variantId: kcFull.variantId, quantity: 1 }] })
        .expect(200);
      expect(res.body.data.items[0].valid).toBe(true);
    });
  });

  describe('POST /builder/validate — inventory, identity, quantity', () => {
    it('reports missing required categories', async () => {
      const case75 = findBySlug('case', 'case-modular-75');
      const res = await request(app)
        .post('/api/v1/builder/validate')
        .send({ layout: '75', items: [{ category: 'case', variantId: case75.variantId, quantity: 1 }] })
        .expect(200);
      expect(res.body.data.valid).toBe(false);
      expect(res.body.data.missingRequired).toEqual(expect.arrayContaining(['pcb', 'plate', 'switch', 'keycap']));
    });

    it('rejects an out-of-stock variant with a stock reason', async () => {
      const oosPcb = findBySlug('pcb', 'pcb-solder-tkl');
      const res = await request(app)
        .post('/api/v1/builder/validate')
        .send({ layout: 'tkl', items: [{ category: 'pcb', variantId: oosPcb.variantId, quantity: 1 }] })
        .expect(200);
      expect(res.body.data.items[0].valid).toBe(false);
      expect(res.body.data.items[0].reason).toMatch(/estoque/i);
    });

    it('rejects a non-existent variantId (invalid identity)', async () => {
      const res = await request(app)
        .post('/api/v1/builder/validate')
        .send({ layout: '75', items: [{ category: 'case', variantId: '00000000-0000-0000-0000-000000000000', quantity: 1 }] })
        .expect(200);
      expect(res.body.data.items[0].valid).toBe(false);
    });

    it('rejects invalid quantity (0) with a 422', async () => {
      const case75 = findBySlug('case', 'case-modular-75');
      await request(app)
        .post('/api/v1/builder/validate')
        .send({ layout: '75', items: [{ category: 'case', variantId: case75.variantId, quantity: 0 }] })
        .expect(422);
    });

    it('rejects a malformed variantId with a 422', async () => {
      await request(app)
        .post('/api/v1/builder/validate')
        .send({ layout: '75', items: [{ category: 'case', variantId: 'not-a-uuid', quantity: 1 }] })
        .expect(422);
    });
  });

  describe('Price / stock spoofing', () => {
    it('ignores/rejects a client-supplied price — mass assignment blocked', async () => {
      const case75 = findBySlug('case', 'case-modular-75');
      const res = await request(app)
        .post('/api/v1/builder/validate')
        .send({ layout: '75', items: [{ category: 'case', variantId: case75.variantId, quantity: 1, price: 0.01, unitPrice: 0.01 }] })
        .expect(422);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('ignores/rejects a client-supplied userId/stockQty/isAdmin', async () => {
      const case75 = findBySlug('case', 'case-modular-75');
      await request(app)
        .post('/api/v1/builder/validate')
        .send({ layout: '75', items: [{ category: 'case', variantId: case75.variantId, quantity: 1, userId: 'hacker', stockQty: 9999, isAdmin: true }] })
        .expect(422);
    });
  });

  function fullValidBuildItems() {
    return [
      { category: 'case', variantId: findBySlug('case', 'case-modular-75').variantId, quantity: 1 },
      { category: 'pcb', variantId: findBySlug('pcb', 'pcb-hotswap-75').variantId, quantity: 1 },
      { category: 'plate', variantId: findBySlug('plate', 'plate-aluminio-75').variantId, quantity: 1 },
      { category: 'switch', variantId: findBySlug('switch', 'gateron-oil-king').variantId, quantity: 9 },
      { category: 'keycap', variantId: findBySlug('keycap', 'keycaps-gmk-laser').variantId, quantity: 1 },
    ];
  }

  describe('POST /builder/add-to-cart', () => {
    it('requires authentication', async () => {
      await request(app)
        .post('/api/v1/builder/add-to-cart')
        .send({ layout: '75', items: fullValidBuildItems() })
        .expect(401);
    });

    it('atomically adds every required component with server-computed prices', async () => {
      const items = fullValidBuildItems();
      const res = await request(app)
        .post('/api/v1/builder/add-to-cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ layout: '75', items })
        .expect(200);

      expect(res.body.data.added.length).toBe(5);

      const cartRes = await request(app).get('/api/v1/cart').set('Authorization', `Bearer ${accessToken}`).expect(200);
      const cartVariantIds = cartRes.body.data.items.map((i: { variantId: string }) => i.variantId);
      for (const item of items) {
        expect(cartVariantIds).toContain(item.variantId);
      }

      // Server-authoritative price: cart unitPrice must equal the real catalog price.
      const caseOpt = findBySlug('case', 'case-modular-75');
      const caseCartItem = cartRes.body.data.items.find((i: { variantId: string }) => i.variantId === caseOpt.variantId);
      expect(Number(caseCartItem.unitPrice)).toBeCloseTo(caseOpt.unitPrice, 2);

      await request(app).delete('/api/v1/cart').set('Authorization', `Bearer ${accessToken}`).expect(204);
    });

    it('rejects an incomplete configuration (missing required category) — nothing added', async () => {
      await request(app).delete('/api/v1/cart').set('Authorization', `Bearer ${accessToken}`).expect(204);

      const items = fullValidBuildItems().filter((i) => i.category !== 'plate');
      await request(app)
        .post('/api/v1/builder/add-to-cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ layout: '75', items })
        .expect(422);

      const cartRes = await request(app).get('/api/v1/cart').set('Authorization', `Bearer ${accessToken}`).expect(200);
      expect(cartRes.body.data.items).toHaveLength(0);
    });

    it('rejects an incompatible configuration — nothing added', async () => {
      await request(app).delete('/api/v1/cart').set('Authorization', `Bearer ${accessToken}`).expect(204);

      const items = fullValidBuildItems().map((i) =>
        i.category === 'case' ? { ...i, variantId: findBySlug('case', 'case-bakeneko60').variantId } : i,
      );
      await request(app)
        .post('/api/v1/builder/add-to-cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ layout: '75', items })
        .expect(422);

      const cartRes = await request(app).get('/api/v1/cart').set('Authorization', `Bearer ${accessToken}`).expect(200);
      expect(cartRes.body.data.items).toHaveLength(0);
    });

    it('adds required items even when an optional extra is invalid, and reports it skipped', async () => {
      await request(app).delete('/api/v1/cart').set('Authorization', `Bearer ${accessToken}`).expect(204);

      // Case Foam 75% only fits a 75% layout — deliberately mismatch it against a 65% build.
      const foam75 = findBySlug('extra', 'case-foam-75');
      const items = [
        { category: 'case', variantId: findBySlug('case', 'case-tofu65').variantId, quantity: 1 },
        { category: 'pcb', variantId: findBySlug('pcb', 'pcb-hotswap-65').variantId, quantity: 1 },
        { category: 'plate', variantId: findBySlug('plate', 'plate-aluminio-65').variantId, quantity: 1 },
        { category: 'switch', variantId: findBySlug('switch', 'cherry-mx-blue').variantId, quantity: 7 },
        { category: 'keycap', variantId: findBySlug('keycap', 'keycaps-mt3-compact').variantId, quantity: 1 },
        { category: 'extra', variantId: foam75.variantId, quantity: 1 },
      ];

      const res = await request(app)
        .post('/api/v1/builder/add-to-cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ layout: '65', items })
        .expect(200);

      expect(res.body.data.added.length).toBe(5);
      expect(res.body.data.skipped.length).toBe(1);
      expect(res.body.data.skipped[0].category).toBe('extra');

      await request(app).delete('/api/v1/cart').set('Authorization', `Bearer ${accessToken}`).expect(204);
    });

    it('validates a payload shaped like a community-build prefill (real seeded community variant ids) the same way', async () => {
      const communityRes = await request(app).get('/api/v1/community-builds/seed-build-midnight-purple').expect(200);
      const build = communityRes.body.data;

      const caseItem = build.items.find((i: { category: string }) => i.category === 'Case');
      const res = await request(app)
        .post('/api/v1/builder/validate')
        .send({ layout: '65', items: [{ category: 'case', variantId: caseItem.variantId, quantity: 1 }] })
        .expect(200);

      expect(res.body.data.items[0].valid).toBe(true);
      expect(res.body.data.items[0].unitPrice).toBeCloseTo(caseItem.unitPrice, 2);
    });
  });
});
