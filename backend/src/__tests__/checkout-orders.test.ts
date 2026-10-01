import request from 'supertest';
import { app } from '../server';
import { prisma } from '../config/database';

/**
 * FASE 0 / ETAPA 5 — Testes de Checkout e Pedidos (F5-B01 a F5-B20)
 */

let testUser: { id: string; token: string; email: string };
let testVariantId: string;
let testAddressId: string;
let originalStock: number;

beforeAll(async () => {
  // Create test user
  const email = `checkout-test-${Date.now()}@test.com`;
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password: 'TestPass123!', name: 'Checkout Test' });
  testUser = { id: res.body.data.user.id, token: res.body.data.accessToken, email };

  // Get variant and set stock
  const variant = await prisma.productVariant.findFirst({
    where: { isActive: true, deletedAt: null },
  });
  testVariantId = variant!.id;
  originalStock = variant!.stockQty;
  await prisma.productVariant.update({ where: { id: testVariantId }, data: { stockQty: 20 } });

  // Create address
  const addr = await prisma.address.create({
    data: { userId: testUser.id, recipientName: 'Test User', street: 'Rua Teste', number: '100', city: 'São Paulo', state: 'SP', zipCode: '01001000', country: 'BR' },
  });
  testAddressId = addr.id;
});

afterAll(async () => {
  await prisma.productVariant.update({ where: { id: testVariantId }, data: { stockQty: originalStock } });
  // Cleanup
  try {
    await prisma.stockLog.deleteMany({ where: { variantId: testVariantId, reference: { not: null } } });
    await prisma.orderItem.deleteMany({ where: { order: { userId: testUser.id } } });
    await prisma.payment.deleteMany({ where: { order: { userId: testUser.id } } });
    await prisma.shipment.deleteMany({ where: { order: { userId: testUser.id } } });
    await prisma.order.deleteMany({ where: { userId: testUser.id } });
    await prisma.cartItem.deleteMany({ where: { cart: { userId: testUser.id } } });
    await prisma.cart.deleteMany({ where: { userId: testUser.id } });
    await prisma.address.deleteMany({ where: { userId: testUser.id } });
    await prisma.refreshToken.deleteMany({ where: { userId: testUser.id } });
    await prisma.auditLog.deleteMany({ where: { OR: [{ actorId: testUser.id }, { userId: testUser.id }] } });
    await prisma.user.delete({ where: { id: testUser.id } });
  } catch { /* ignore */ }
  await prisma.$disconnect();
});

// Helper to add item to cart and create order
async function setupCartAndOrder(token: string, variantId: string, quantity: number) {
  // Ensure user has a fresh active cart
  await request(app).delete('/api/v1/cart').set('Authorization', `Bearer ${token}`);
  // Force create new active cart by adding item
  await request(app).post('/api/v1/cart/items').set('Authorization', `Bearer ${token}`).send({ variantId, quantity });
}

// Helper to cancel recent pending orders so duplicate protection doesn't interfere
async function cancelRecentOrders(userId: string) {
  await prisma.order.updateMany({
    where: { userId, status: 'PENDING' },
    data: { status: 'CANCELLED' },
  });
}

describe('F5-B01: Criar pedido autenticado', () => {
  beforeAll(async () => { await setupCartAndOrder(testUser.token, testVariantId, 2); });

  it('POST /orders → 201 com dados válidos', async () => {
    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${testUser.token}`)
      .send({ addressId: testAddressId, paymentMethod: 'PIX' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.orderNumber).toBeDefined();
    expect(res.body.data.status).toBe('PENDING');
    expect(res.body.data.items.length).toBeGreaterThan(0);
  });
});

describe('F5-B02: Criar pedido sem autenticação', () => {
  it('POST /orders sem token → 401', async () => {
    const res = await request(app).post('/api/v1/orders').send({ addressId: testAddressId, paymentMethod: 'PIX' });
    expect(res.status).toBe(401);
  });
});

describe('F5-B03: Carrinho vazio', () => {
  it('POST /orders com carrinho vazio → erro', async () => {
    await cancelRecentOrders(testUser.id);
    // Ensure cart is empty
    await request(app).delete('/api/v1/cart').set('Authorization', `Bearer ${testUser.token}`);
    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${testUser.token}`)
      .send({ addressId: testAddressId, paymentMethod: 'PIX' });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('vazio');
  });
});

describe('F5-B04: Endereço inválido', () => {
  beforeAll(async () => {
    await cancelRecentOrders(testUser.id);
    await setupCartAndOrder(testUser.token, testVariantId, 1);
  });

  it('POST /orders com addressId inexistente → 404', async () => {
    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${testUser.token}`)
      .send({ addressId: '00000000-0000-0000-0000-000000000000', paymentMethod: 'PIX' });
    expect(res.status).toBe(404);
  });
});

describe('F5-B05: Quantidade inválida (Zod)', () => {
  it('POST /cart/items com quantity 0 → 422', async () => {
    const res = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${testUser.token}`)
      .send({ variantId: testVariantId, quantity: 0 });
    expect(res.status).toBe(422);
  });

  it('POST /cart/items com quantity negativa → 422', async () => {
    const res = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${testUser.token}`)
      .send({ variantId: testVariantId, quantity: -5 });
    expect(res.status).toBe(422);
  });
});

describe('F5-B06: Estoque insuficiente no checkout', () => {
  it('POST /orders com estoque insuficiente → 409', async () => {
    await cancelRecentOrders(testUser.id);
    // Add large quantity to cart while stock is high
    await prisma.productVariant.update({ where: { id: testVariantId }, data: { stockQty: 20 } });
    await setupCartAndOrder(testUser.token, testVariantId, 15);
    // Now reduce stock below cart quantity
    await prisma.productVariant.update({ where: { id: testVariantId }, data: { stockQty: 2 } });

    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${testUser.token}`)
      .send({ addressId: testAddressId, paymentMethod: 'PIX' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('INSUFFICIENT_STOCK');

    // Restore
    await prisma.productVariant.update({ where: { id: testVariantId }, data: { stockQty: 20 } });
  });
});

describe('F5-B07: Preço do frontend ignorado', () => {
  it('Backend não aceita price field no POST /orders', async () => {
    await cancelRecentOrders(testUser.id);
    await setupCartAndOrder(testUser.token, testVariantId, 1);
    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${testUser.token}`)
      .send({ addressId: testAddressId, paymentMethod: 'PIX', total: 0.01, subtotal: 0.01 });

    expect(res.status).toBe(201);
    // Total is calculated by backend, not from client
    expect(Number(res.body.data.total)).toBeGreaterThan(1);
  });
});

describe('F5-B08: Total calculado pelo backend', () => {
  it('Total = subtotal + frete, calculado server-side', async () => {
    await cancelRecentOrders(testUser.id);
    await setupCartAndOrder(testUser.token, testVariantId, 2);
    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${testUser.token}`)
      .send({ addressId: testAddressId, paymentMethod: 'PIX' });

    expect(res.status).toBe(201);
    const subtotal = Number(res.body.data.subtotal);
    const shipping = Number(res.body.data.shippingCost);
    const total = Number(res.body.data.total);
    expect(total).toBe(subtotal + shipping);
    expect(subtotal).toBeGreaterThan(0);
    expect(shipping).toBeGreaterThanOrEqual(0);
  });
});

describe('F5-B09: Frete calculado server-side', () => {
  it('POST /shipping/calculate → retorna opções com preço e prazo', async () => {
    const res = await request(app)
      .post('/api/v1/shipping/calculate')
      .send({ zipCode: '01001000' });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].price).toBeDefined();
    expect(res.body.data[0].days).toBeDefined();
    expect(res.body.data[0].code).toBeDefined();
    expect(res.body.data[0].name).toBeDefined();
    expect(res.body.data[0].price).toBeGreaterThan(0);
  });
});

describe('F5-B10: Pedido persistido no banco', () => {
  it('Order existe no PostgreSQL após criação', async () => {
    await cancelRecentOrders(testUser.id);
    await setupCartAndOrder(testUser.token, testVariantId, 1);
    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${testUser.token}`)
      .send({ addressId: testAddressId, paymentMethod: 'PIX' });

    expect(res.status).toBe(201);
    const orderId = res.body.data.id;

    const dbOrder = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true, payment: true, shipment: true } });
    expect(dbOrder).not.toBeNull();
    expect(dbOrder!.userId).toBe(testUser.id);
    expect(dbOrder!.items.length).toBeGreaterThan(0);
    expect(dbOrder!.payment).not.toBeNull();
    expect(dbOrder!.shipment).not.toBeNull();
  });
});

describe('F5-B11: OrderItems persistidos', () => {
  it('OrderItems refletem carrinho original', async () => {
    await cancelRecentOrders(testUser.id);
    await setupCartAndOrder(testUser.token, testVariantId, 3);
    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${testUser.token}`)
      .send({ addressId: testAddressId, paymentMethod: 'PIX' });

    expect(res.status).toBe(201);
    const item = res.body.data.items[0];
    expect(item.variantId).toBe(testVariantId);
    expect(item.quantity).toBe(3);
    expect(Number(item.unitPrice)).toBeGreaterThan(0);
    expect(Number(item.total)).toBeCloseTo(Number(item.unitPrice) * 3, 2);
  });
});

describe('F5-B12: Endereço associado ao pedido (shipment)', () => {
  it('Shipment referencia o addressId correto', async () => {
    await cancelRecentOrders(testUser.id);
    await setupCartAndOrder(testUser.token, testVariantId, 1);
    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${testUser.token}`)
      .send({ addressId: testAddressId, paymentMethod: 'PIX' });

    expect(res.status).toBe(201);
    expect(res.body.data.shipment.addressId).toBe(testAddressId);
  });
});

describe('F5-B13: Estoque decrementado', () => {
  it('Stock diminui após criação de pedido', async () => {
    await cancelRecentOrders(testUser.id);
    await prisma.productVariant.update({ where: { id: testVariantId }, data: { stockQty: 20 } });
    await setupCartAndOrder(testUser.token, testVariantId, 2);

    const before = await prisma.productVariant.findUnique({ where: { id: testVariantId } });
    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${testUser.token}`)
      .send({ addressId: testAddressId, paymentMethod: 'PIX' });
    expect(res.status).toBe(201);

    const after = await prisma.productVariant.findUnique({ where: { id: testVariantId } });
    expect(after!.stockQty).toBe(before!.stockQty - 2);
  });
});

describe('F5-B14: Carrinho desativado', () => {
  it('Cart fica inativo após criação de pedido', async () => {
    await cancelRecentOrders(testUser.id);
    await setupCartAndOrder(testUser.token, testVariantId, 1);

    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${testUser.token}`)
      .send({ addressId: testAddressId, paymentMethod: 'PIX' });
    expect(res.status).toBe(201);

    // Cart should be inactive now
    const cart = await prisma.cart.findFirst({ where: { userId: testUser.id, isActive: true } });
    expect(cart).toBeNull();
  });
});

describe('F5-B15: Listagem de pedidos', () => {
  it('GET /orders/my → retorna pedidos do usuário', async () => {
    const res = await request(app)
      .get('/api/v1/orders/my')
      .set('Authorization', `Bearer ${testUser.token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });
});

describe('F5-B16: Detalhe do pedido', () => {
  it('GET /orders/:id → retorna pedido completo', async () => {
    // Find a recent order
    const listRes = await request(app)
      .get('/api/v1/orders/my')
      .set('Authorization', `Bearer ${testUser.token}`);
    const orderId = listRes.body.data[0].id;

    const res = await request(app)
      .get(`/api/v1/orders/${orderId}`)
      .set('Authorization', `Bearer ${testUser.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(orderId);
    expect(res.body.data.items).toBeDefined();
    expect(res.body.data.payment).toBeDefined();
    expect(res.body.data.shipment).toBeDefined();
  });
});

describe('F5-B17: Acesso ao pedido de outro usuário', () => {
  it('GET /orders/:id de outro user → 403', async () => {
    // Create second user
    const email2 = `other-user-${Date.now()}@test.com`;
    const reg = await request(app).post('/api/v1/auth/register').send({ email: email2, password: 'TestPass123!', name: 'Other' });
    const otherToken = reg.body.data.accessToken;
    const otherUserId = reg.body.data.user.id;

    // Get testUser's order
    const listRes = await request(app).get('/api/v1/orders/my').set('Authorization', `Bearer ${testUser.token}`);
    const orderId = listRes.body.data[0].id;

    // Try to access with other user
    const res = await request(app).get(`/api/v1/orders/${orderId}`).set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(403);

    // Cleanup
    await prisma.refreshToken.deleteMany({ where: { userId: otherUserId } });
    await prisma.auditLog.deleteMany({ where: { OR: [{ actorId: otherUserId }, { userId: otherUserId }] } });
    await prisma.user.delete({ where: { id: otherUserId } });
  });
});

describe('F5-B18: Rollback em caso de erro', () => {
  it('Estoque não muda se pedido falha por endereço inválido', async () => {
    await cancelRecentOrders(testUser.id);
    await prisma.productVariant.update({ where: { id: testVariantId }, data: { stockQty: 10 } });
    await setupCartAndOrder(testUser.token, testVariantId, 2);

    const before = await prisma.productVariant.findUnique({ where: { id: testVariantId } });
    await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${testUser.token}`)
      .send({ addressId: '00000000-0000-0000-0000-000000000000', paymentMethod: 'PIX' });

    const after = await prisma.productVariant.findUnique({ where: { id: testVariantId } });
    expect(after!.stockQty).toBe(before!.stockQty);
  });
});

describe('F5-B19: Pedido com variante', () => {
  it('OrderItem contém variantId e variantName', async () => {
    await cancelRecentOrders(testUser.id);
    await setupCartAndOrder(testUser.token, testVariantId, 1);
    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${testUser.token}`)
      .send({ addressId: testAddressId, paymentMethod: 'PIX' });

    expect(res.status).toBe(201);
    const item = res.body.data.items[0];
    expect(item.variantId).toBe(testVariantId);
    expect(item.variantName).toBeDefined();
    expect(item.sku).toBeDefined();
  });
});

describe('F5-B20: Pedido com múltiplos itens', () => {
  it('Pedido pode ter itens de variantes diferentes', async () => {
    await cancelRecentOrders(testUser.id);
    // Find a second variant
    const variant2 = await prisma.productVariant.findFirst({
      where: { isActive: true, deletedAt: null, id: { not: testVariantId }, stockQty: { gt: 0 } },
    });

    if (!variant2) {
      // Create a second variant if needed
      console.log('Only one variant available, testing single item');
      await setupCartAndOrder(testUser.token, testVariantId, 2);
    } else {
      // Add two different variants to cart
      await request(app).delete('/api/v1/cart').set('Authorization', `Bearer ${testUser.token}`);
      await request(app).post('/api/v1/cart/items').set('Authorization', `Bearer ${testUser.token}`).send({ variantId: testVariantId, quantity: 1 });
      await request(app).post('/api/v1/cart/items').set('Authorization', `Bearer ${testUser.token}`).send({ variantId: variant2.id, quantity: 1 });
    }

    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${testUser.token}`)
      .send({ addressId: testAddressId, paymentMethod: 'PIX' });

    expect(res.status).toBe(201);
    if (variant2) {
      expect(res.body.data.items.length).toBe(2);
    } else {
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
    }
  });
});
