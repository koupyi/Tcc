import request from 'supertest';
import { app } from '../server';
import { prisma } from '../config/database';

/**
 * FASE 0 / ETAPA 4 — Testes de Estoque e Concorrência
 * 
 * Validates:
 * - Stock validation on add/update cart
 * - Stock revalidation on order creation
 * - Atomic transaction with SELECT FOR UPDATE
 * - Concurrency (two simultaneous purchases)
 * - Negative stock prevention
 * - Structured error responses
 */

// Test user helpers
const createTestUser = async (suffix: string) => {
  const email = `stock-test-${suffix}-${Date.now()}@test.com`;
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password: 'TestPass123!', name: `Stock Test ${suffix}` });
  
  if (res.status !== 201 || !res.body.data) {
    throw new Error(`Failed to create test user ${suffix}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  
  return {
    userId: res.body.data.user.id,
    token: res.body.data.accessToken,
    email,
  };
};

const cleanupUser = async (userId: string) => {
  try {
    await prisma.orderItem.deleteMany({ where: { order: { userId } } });
    await prisma.payment.deleteMany({ where: { order: { userId } } });
    await prisma.shipment.deleteMany({ where: { order: { userId } } });
    await prisma.order.deleteMany({ where: { userId } });
    await prisma.cartItem.deleteMany({ where: { cart: { userId } } });
    await prisma.cart.deleteMany({ where: { userId } });
    await prisma.address.deleteMany({ where: { userId } });
    await prisma.refreshToken.deleteMany({ where: { userId } });
    await prisma.auditLog.deleteMany({ where: { OR: [{ actorId: userId }, { userId }] } });
    await prisma.user.delete({ where: { id: userId } });
  } catch {
    // Ignore cleanup errors
  }
};

// Get a known variant for testing
let testVariantId: string;
let testVariantOriginalStock: number;

beforeAll(async () => {
  const variant = await prisma.productVariant.findFirst({
    where: { isActive: true, deletedAt: null },
  });
  if (!variant) throw new Error('No test variant found');
  testVariantId = variant.id;
  testVariantOriginalStock = variant.stockQty;
});

afterAll(async () => {
  // Restore original stock
  await prisma.productVariant.update({
    where: { id: testVariantId },
    data: { stockQty: testVariantOriginalStock },
  });
  await prisma.$disconnect();
});

describe('TESTE 1: Adicionar item com estoque suficiente', () => {
  let user: { userId: string; token: string };

  beforeAll(async () => {
    // Ensure stock is sufficient
    await prisma.productVariant.update({
      where: { id: testVariantId },
      data: { stockQty: 10 },
    });
    user = await createTestUser('t1');
  });

  afterAll(async () => await cleanupUser(user.userId));

  it('deve permitir adicionar com estoque suficiente', async () => {
    const res = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ variantId: testVariantId, quantity: 2 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items[0].quantity).toBe(2);
  });
});

describe('TESTE 2: Adicionar item acima do estoque', () => {
  let user: { userId: string; token: string };

  beforeAll(async () => {
    await prisma.productVariant.update({
      where: { id: testVariantId },
      data: { stockQty: 3 },
    });
    user = await createTestUser('t2');
  });

  afterAll(async () => await cleanupUser(user.userId));

  it('deve rejeitar quantidade acima do estoque', async () => {
    const res = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ variantId: testVariantId, quantity: 5 });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('INSUFFICIENT_STOCK');
    expect(res.body.message).toContain('Estoque insuficiente');
  });
});

describe('TESTE 3: Quantidade somada ao carrinho excede estoque', () => {
  let user: { userId: string; token: string };

  beforeAll(async () => {
    await prisma.productVariant.update({
      where: { id: testVariantId },
      data: { stockQty: 5 },
    });
    user = await createTestUser('t3');
  });

  afterAll(async () => await cleanupUser(user.userId));

  it('deve rejeitar quando existente + novo > estoque', async () => {
    // First add 3
    const add1 = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ variantId: testVariantId, quantity: 3 });
    expect(add1.status).toBe(200);

    // Try to add 3 more (3+3=6 > 5)
    const add2 = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ variantId: testVariantId, quantity: 3 });

    expect(add2.status).toBe(409);
    expect(add2.body.code).toBe('INSUFFICIENT_STOCK');
  });
});

describe('TESTE 4: Atualizar carrinho para quantidade válida', () => {
  let user: { userId: string; token: string };
  let cartItemId: string;

  beforeAll(async () => {
    await prisma.productVariant.update({
      where: { id: testVariantId },
      data: { stockQty: 10 },
    });
    user = await createTestUser('t4');
    // Add item first
    const res = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ variantId: testVariantId, quantity: 2 });
    cartItemId = res.body.data.items[0].id;
  });

  afterAll(async () => await cleanupUser(user.userId));

  it('deve permitir atualizar para quantidade válida', async () => {
    const res = await request(app)
      .patch(`/api/v1/cart/items/${cartItemId}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ quantity: 5 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items[0].quantity).toBe(5);
  });
});

describe('TESTE 5: Atualizar carrinho acima do estoque', () => {
  let user: { userId: string; token: string };
  let cartItemId: string;

  beforeAll(async () => {
    await prisma.productVariant.update({
      where: { id: testVariantId },
      data: { stockQty: 5 },
    });
    user = await createTestUser('t5');
    const res = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ variantId: testVariantId, quantity: 2 });
    cartItemId = res.body.data.items[0].id;
  });

  afterAll(async () => await cleanupUser(user.userId));

  it('deve rejeitar atualização acima do estoque', async () => {
    const res = await request(app)
      .patch(`/api/v1/cart/items/${cartItemId}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ quantity: 8 });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('INSUFFICIENT_STOCK');
  });
});

describe('TESTE 6: Produto/variante com estoque 0', () => {
  let user: { userId: string; token: string };

  beforeAll(async () => {
    await prisma.productVariant.update({
      where: { id: testVariantId },
      data: { stockQty: 0 },
    });
    user = await createTestUser('t6');
  });

  afterAll(async () => await cleanupUser(user.userId));

  it('deve rejeitar adicionar variante com estoque 0', async () => {
    const res = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ variantId: testVariantId, quantity: 1 });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('INSUFFICIENT_STOCK');
  });
});

describe('TESTE 7: Quantidade 0', () => {
  let user: { userId: string; token: string };

  beforeAll(async () => {
    await prisma.productVariant.update({
      where: { id: testVariantId },
      data: { stockQty: 10 },
    });
    user = await createTestUser('t7');
  });

  afterAll(async () => await cleanupUser(user.userId));

  it('deve rejeitar quantidade 0 (validação Zod)', async () => {
    const res = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ variantId: testVariantId, quantity: 0 });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

describe('TESTE 8: Quantidade negativa', () => {
  let user: { userId: string; token: string };

  beforeAll(async () => {
    user = await createTestUser('t8');
  });

  afterAll(async () => await cleanupUser(user.userId));

  it('deve rejeitar quantidade negativa (validação Zod)', async () => {
    const res = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ variantId: testVariantId, quantity: -1 });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

describe('TESTE 9: Estoque alterado depois do carrinho - checkout rejeitado', () => {
  let user: { userId: string; token: string };

  beforeAll(async () => {
    // Start with stock = 10
    await prisma.productVariant.update({
      where: { id: testVariantId },
      data: { stockQty: 10 },
    });
    user = await createTestUser('t9');
  });

  afterAll(async () => await cleanupUser(user.userId));

  it('deve rejeitar pedido se estoque diminuiu após adicionar ao carrinho', async () => {
    // Add 8 to cart (valid, stock=10)
    const addRes = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ variantId: testVariantId, quantity: 8 });
    expect(addRes.status).toBe(200);

    // Simulate external stock change: reduce to 3
    await prisma.productVariant.update({
      where: { id: testVariantId },
      data: { stockQty: 3 },
    });

    // Create address for checkout
    const addr = await prisma.address.create({
      data: {
        userId: user.userId,
        street: 'Rua Teste',
        city: 'São Paulo',
        state: 'SP',
        zipCode: '01001000',
        country: 'BR',
      },
    });

    // Try to create order — should fail (cart=8, stock=3)
    const orderRes = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ addressId: addr.id, paymentMethod: 'PIX' });

    expect(orderRes.status).toBe(409);
    expect(orderRes.body.code).toBe('INSUFFICIENT_STOCK');
  });
});

describe('TESTE 10: Criação de pedido decrementa estoque corretamente', () => {
  let user: { userId: string; token: string };

  beforeAll(async () => {
    await prisma.productVariant.update({
      where: { id: testVariantId },
      data: { stockQty: 10 },
    });
    user = await createTestUser('t10');
  });

  afterAll(async () => await cleanupUser(user.userId));

  it('stock_before=10, quantity=2, stock_after=8', async () => {
    // Add to cart
    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ variantId: testVariantId, quantity: 2 });

    // Create address
    const addr = await prisma.address.create({
      data: {
        userId: user.userId,
        street: 'Rua Teste',
        city: 'São Paulo',
        state: 'SP',
        zipCode: '01001000',
        country: 'BR',
      },
    });

    // Verify stock before
    const before = await prisma.productVariant.findUnique({ where: { id: testVariantId } });
    expect(before!.stockQty).toBe(10);

    // Create order
    const orderRes = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ addressId: addr.id, paymentMethod: 'PIX' });

    expect(orderRes.status).toBe(201);

    // Verify stock after
    const after = await prisma.productVariant.findUnique({ where: { id: testVariantId } });
    expect(after!.stockQty).toBe(8);
  });
});

describe('TESTE 11: Falha não deixa estoque parcialmente decrementado (rollback)', () => {
  let user: { userId: string; token: string };

  beforeAll(async () => {
    await prisma.productVariant.update({
      where: { id: testVariantId },
      data: { stockQty: 5 },
    });
    user = await createTestUser('t11');
  });

  afterAll(async () => await cleanupUser(user.userId));

  it('estoque permanece inalterado após falha de checkout', async () => {
    // Add to cart
    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ variantId: testVariantId, quantity: 2 });

    // Try to create order with INVALID address (will fail)
    const orderRes = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ addressId: '00000000-0000-0000-0000-000000000000', paymentMethod: 'PIX' });

    expect(orderRes.status).toBe(404); // Address not found

    // Verify stock is unchanged
    const variant = await prisma.productVariant.findUnique({ where: { id: testVariantId } });
    expect(variant!.stockQty).toBe(5);
  });
});

describe('TESTE 12: Concorrência — duas compras simultâneas, stock=1', () => {
  let userA: { userId: string; token: string };
  let userB: { userId: string; token: string };
  let addrAId: string;
  let addrBId: string;

  beforeAll(async () => {
    // Set stock to exactly 1
    await prisma.productVariant.update({
      where: { id: testVariantId },
      data: { stockQty: 1 },
    });
    userA = await createTestUser('t12a');
    userB = await createTestUser('t12b');

    // Add 1 to each cart
    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ variantId: testVariantId, quantity: 1 });

    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${userB.token}`)
      .send({ variantId: testVariantId, quantity: 1 });

    // Create addresses with real UUIDs
    const addrA = await prisma.address.create({
      data: {
        userId: userA.userId,
        street: 'Rua A',
        city: 'São Paulo',
        state: 'SP',
        zipCode: '01001000',
        country: 'BR',
      },
    });
    addrAId = addrA.id;

    const addrB = await prisma.address.create({
      data: {
        userId: userB.userId,
        street: 'Rua B',
        city: 'São Paulo',
        state: 'SP',
        zipCode: '01001000',
        country: 'BR',
      },
    });
    addrBId = addrB.id;
  });

  afterAll(async () => {
    await cleanupUser(userA.userId);
    await cleanupUser(userB.userId);
  });

  it('apenas uma compra deve suceder, stock nunca negativo', async () => {
    // Fire both orders simultaneously
    const [resA, resB] = await Promise.all([
      request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ addressId: addrAId, paymentMethod: 'PIX' }),
      request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${userB.token}`)
        .send({ addressId: addrBId, paymentMethod: 'PIX' }),
    ]);

    const statuses = [resA.status, resB.status].sort();
    
    // One should succeed (201), one should fail (409)
    expect(statuses).toContain(201);
    expect(statuses.filter((s) => s === 201).length).toBe(1);
    expect(statuses.filter((s) => s !== 201).length).toBe(1);

    // Check stock is 0, never negative
    const variant = await prisma.productVariant.findUnique({ where: { id: testVariantId } });
    expect(variant!.stockQty).toBe(0);
    expect(variant!.stockQty).toBeGreaterThanOrEqual(0);
  });
});

describe('TESTE 13: Nunca permitir estoque negativo', () => {
  let user: { userId: string; token: string };

  beforeAll(async () => {
    await prisma.productVariant.update({
      where: { id: testVariantId },
      data: { stockQty: 1 },
    });
    user = await createTestUser('t13');
  });

  afterAll(async () => await cleanupUser(user.userId));

  it('estoque nunca fica negativo após operações', async () => {
    // Try to add quantity > stock
    const res = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ variantId: testVariantId, quantity: 5 });

    expect(res.status).toBe(409);

    // Verify stock is unchanged
    const variant = await prisma.productVariant.findUnique({ where: { id: testVariantId } });
    expect(variant!.stockQty).toBeGreaterThanOrEqual(0);
    expect(variant!.stockQty).toBe(1);
  });
});

describe('TESTE 14: Erro retornado possui formato padrão da API', () => {
  let user: { userId: string; token: string };

  beforeAll(async () => {
    await prisma.productVariant.update({
      where: { id: testVariantId },
      data: { stockQty: 2 },
    });
    user = await createTestUser('t14');
  });

  afterAll(async () => await cleanupUser(user.userId));

  it('erro de estoque tem success, message, code', async () => {
    const res = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ variantId: testVariantId, quantity: 10 });

    expect(res.status).toBe(409);
    expect(res.body).toHaveProperty('success', false);
    expect(res.body).toHaveProperty('message');
    expect(res.body).toHaveProperty('code', 'INSUFFICIENT_STOCK');
    expect(res.body.message).toContain('Estoque insuficiente');
    expect(res.body.message).toContain('Disponível: 2');
  });
});

describe('TESTE 15: Frontend trata INSUFFICIENT_STOCK', () => {
  it('ApiError retornado pelo backend tem code acessível', async () => {
    // This verifies the contract that the frontend consumes
    const user = await createTestUser('t15');

    await prisma.productVariant.update({
      where: { id: testVariantId },
      data: { stockQty: 1 },
    });

    const res = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ variantId: testVariantId, quantity: 99 });

    // Verify the response shape matches what frontend expects
    expect(res.status).toBe(409);
    const body = res.body;

    // Frontend ApiError interface: { success, message, code?, errors? }
    expect(typeof body.success).toBe('boolean');
    expect(body.success).toBe(false);
    expect(typeof body.message).toBe('string');
    expect(body.message.length).toBeGreaterThan(0);
    expect(body.code).toBe('INSUFFICIENT_STOCK');

    // Frontend can use: toast.error(body.message) — works correctly
    // Frontend can check: body.code === 'INSUFFICIENT_STOCK' for special handling

    await cleanupUser(user.userId);
  });
});
