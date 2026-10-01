import request from 'supertest';
import { app } from '../server';
import { prisma } from '../config/database';

/**
 * Address API tests — FASE 3
 * Covers: validation, IDOR, authorization, CEP normalization, mass assignment
 */

const USER_A_EMAIL = `addr-test-a-${Date.now()}@test.local`;
const USER_B_EMAIL = `addr-test-b-${Date.now()}@test.local`;
const PASSWORD = 'TestPass123!';

let tokenA: string;
let tokenB: string;
let userAId: string;
let userBId: string;
const VALID_ADDRESS = {
  recipientName: 'João Silva',
  zipCode: '01310-100',
  street: 'Avenida Paulista',
  number: '1578',
  complement: 'Apto 123',
  neighborhood: 'Bela Vista',
  city: 'São Paulo',
  state: 'SP',
  isDefault: false,
};

beforeAll(async () => {
  // Create User A
  const resA = await request(app)
    .post('/api/v1/auth/register')
    .send({ email: USER_A_EMAIL, password: PASSWORD, name: 'User A' });
  tokenA = resA.body.data.accessToken;
  userAId = resA.body.data.user.id;

  // Create User B
  const resB = await request(app)
    .post('/api/v1/auth/register')
    .send({ email: USER_B_EMAIL, password: PASSWORD, name: 'User B' });
  tokenB = resB.body.data.accessToken;
  userBId = resB.body.data.user.id;
});

afterAll(async () => {
  try {
    // Cleanup
    for (const uid of [userAId, userBId]) {
      if (uid) {
        await prisma.address.deleteMany({ where: { userId: uid } });
        await prisma.refreshToken.deleteMany({ where: { userId: uid } });
        await prisma.auditLog.deleteMany({ where: { OR: [{ actorId: uid }, { userId: uid }] } });
        await prisma.cartItem.deleteMany({ where: { cart: { userId: uid } } });
        await prisma.cart.deleteMany({ where: { userId: uid } });
        await prisma.user.delete({ where: { id: uid } });
      }
    }
  } catch {
    // Ignore cleanup errors
  }
  await prisma.$disconnect();
});

// ==================================================
// AUTHORIZATION TESTS
// ==================================================

describe('Address Authorization', () => {
  it('GET /api/v1/addresses without token → 401', async () => {
    const res = await request(app).get('/api/v1/addresses');
    expect(res.status).toBe(401);
  });

  it('POST /api/v1/addresses without token → 401', async () => {
    const res = await request(app)
      .post('/api/v1/addresses')
      .send(VALID_ADDRESS);
    expect(res.status).toBe(401);
  });

  it('PATCH /api/v1/addresses/:id without token → 401', async () => {
    const res = await request(app)
      .patch('/api/v1/addresses/some-id')
      .send({ street: 'Nova Rua' });
    expect(res.status).toBe(401);
  });

  it('DELETE /api/v1/addresses/:id without token → 401', async () => {
    const res = await request(app)
      .delete('/api/v1/addresses/some-id');
    expect(res.status).toBe(401);
  });
});

// ==================================================
// VALIDATION TESTS
// ==================================================

describe('Address Validation', () => {
  it('creates address with valid data', async () => {
    const res = await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${tokenA}`)
      .send(VALID_ADDRESS);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.street).toBe('Avenida Paulista');
    // CEP should be normalized (stored without hyphen)
    expect(res.body.data.zipCode).toBe('01310100');
    expect(res.body.data.state).toBe('SP');
  });

  it('CEP with hyphen is normalized to 8 digits', async () => {
    const res = await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ ...VALID_ADDRESS, zipCode: '13330-000' });

    expect(res.status).toBe(201);
    expect(res.body.data.zipCode).toBe('13330000');

    // Cleanup
    await prisma.address.update({ where: { id: res.body.data.id }, data: { deletedAt: new Date() } });
  });

  it('CEP without hyphen works too', async () => {
    const res = await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ ...VALID_ADDRESS, zipCode: '01310100' });

    expect(res.status).toBe(201);
    expect(res.body.data.zipCode).toBe('01310100');

    // Cleanup
    await prisma.address.update({ where: { id: res.body.data.id }, data: { deletedAt: new Date() } });
  });

  it('CEP with less than 8 digits → rejected', async () => {
    const res = await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ ...VALID_ADDRESS, zipCode: '123' });

    expect(res.status).toBe(422);
    expect(res.body.errors.zipCode).toBeDefined();
  });

  it('CEP with more than 8 digits → rejected', async () => {
    const res = await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ ...VALID_ADDRESS, zipCode: '123456789' });

    expect(res.status).toBe(422);
    expect(res.body.errors.zipCode).toBeDefined();
  });

  it('empty street → rejected', async () => {
    const res = await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ ...VALID_ADDRESS, street: '' });

    expect(res.status).toBe(422);
    expect(res.body.errors.street).toBeDefined();
  });

  it('empty number → rejected', async () => {
    const res = await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ ...VALID_ADDRESS, number: '' });

    expect(res.status).toBe(422);
    expect(res.body.errors.number).toBeDefined();
  });

  it('empty neighborhood → rejected', async () => {
    const res = await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ ...VALID_ADDRESS, neighborhood: '' });

    expect(res.status).toBe(422);
    expect(res.body.errors.neighborhood).toBeDefined();
  });

  it('empty city → rejected', async () => {
    const res = await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ ...VALID_ADDRESS, city: '' });

    expect(res.status).toBe(422);
    expect(res.body.errors.city).toBeDefined();
  });

  it('invalid UF (XX) → rejected', async () => {
    const res = await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ ...VALID_ADDRESS, state: 'XX' });

    expect(res.status).toBe(422);
    expect(res.body.errors.state).toBeDefined();
  });

  it('UF with lowercase (sp) → accepted and normalized to SP', async () => {
    const res = await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ ...VALID_ADDRESS, state: 'sp' });

    expect(res.status).toBe(201);
    expect(res.body.data.state).toBe('SP');

    // Cleanup
    await prisma.address.update({ where: { id: res.body.data.id }, data: { deletedAt: new Date() } });
  });

  it('complement empty/absent → accepted', async () => {
    const { complement, ...withoutComplement } = VALID_ADDRESS;
    const res = await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${tokenA}`)
      .send(withoutComplement);

    expect(res.status).toBe(201);

    // Cleanup
    await prisma.address.update({ where: { id: res.body.data.id }, data: { deletedAt: new Date() } });
  });

  it('non-integer number (123A) → accepted', async () => {
    const res = await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ ...VALID_ADDRESS, number: '123A' });

    expect(res.status).toBe(201);
    expect(res.body.data.number).toBe('123A');

    // Cleanup
    await prisma.address.update({ where: { id: res.body.data.id }, data: { deletedAt: new Date() } });
  });

  it('S/N as number → accepted', async () => {
    const res = await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ ...VALID_ADDRESS, number: 'S/N' });

    expect(res.status).toBe(201);
    expect(res.body.data.number).toBe('S/N');

    // Cleanup
    await prisma.address.update({ where: { id: res.body.data.id }, data: { deletedAt: new Date() } });
  });
});

// ==================================================
// MASS ASSIGNMENT TESTS
// ==================================================

describe('Address Mass Assignment Protection', () => {
  it('rejects userId in payload', async () => {
    const res = await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ ...VALID_ADDRESS, userId: userBId });

    expect(res.status).toBe(422);
  });

  it('rejects id in payload', async () => {
    const res = await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ ...VALID_ADDRESS, id: 'injected-id' });

    expect(res.status).toBe(422);
  });

  it('rejects createdAt in payload', async () => {
    const res = await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ ...VALID_ADDRESS, createdAt: '2020-01-01T00:00:00Z' });

    expect(res.status).toBe(422);
  });
});

// ==================================================
// IDOR TESTS
// ==================================================

describe('Address IDOR Protection', () => {
  let addressBId: string;

  beforeAll(async () => {
    // Create address for User B
    const res = await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ ...VALID_ADDRESS, recipientName: 'User B Address' });
    addressBId = res.body.data.id;
  });

  it('User A cannot update User B address → 404', async () => {
    const res = await request(app)
      .patch(`/api/v1/addresses/${addressBId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ street: 'Hacked Street' });

    expect(res.status).toBe(404);
  });

  it('User A cannot delete User B address → 404', async () => {
    const res = await request(app)
      .delete(`/api/v1/addresses/${addressBId}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(404);
  });

  it('User A cannot set default on User B address → 404', async () => {
    const res = await request(app)
      .patch(`/api/v1/addresses/${addressBId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ isDefault: true });

    expect(res.status).toBe(404);
  });

  it('User A cannot see User B addresses in their list', async () => {
    const res = await request(app)
      .get('/api/v1/addresses')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    const addresses = res.body.data;
    const hasBAddress = addresses.some((a: { id: string }) => a.id === addressBId);
    expect(hasBAddress).toBe(false);
  });
});

// ==================================================
// DEFAULT ADDRESS TESTS
// ==================================================

describe('Default Address', () => {
  let addr1Id: string;
  let addr2Id: string;

  beforeAll(async () => {
    // Create two addresses for User A
    const res1 = await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ ...VALID_ADDRESS, isDefault: true, label: 'Default Test 1' });
    addr1Id = res1.body.data.id;

    const res2 = await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ ...VALID_ADDRESS, isDefault: false, label: 'Default Test 2' });
    addr2Id = res2.body.data.id;
  });

  it('setting new default unsets previous default', async () => {
    // Set addr2 as default
    const res = await request(app)
      .patch(`/api/v1/addresses/${addr2Id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ isDefault: true });

    expect(res.status).toBe(200);
    expect(res.body.data.isDefault).toBe(true);

    // Check addr1 is no longer default
    const list = await request(app)
      .get('/api/v1/addresses')
      .set('Authorization', `Bearer ${tokenA}`);

    const a1 = list.body.data.find((a: { id: string }) => a.id === addr1Id);
    expect(a1.isDefault).toBe(false);
  });
});
