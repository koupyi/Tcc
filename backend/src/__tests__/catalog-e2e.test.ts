import request from 'supertest';
import { app } from '../server';
import { prisma } from '../config/database';

/**
 * E2E Tests — FASE 0 / ETAPA 3: Catálogo e Produtos
 * 
 * Validates the full flow: PostgreSQL → Prisma → Backend → API
 * These tests verify that the catalog data truly comes from the database.
 */

afterAll(async () => {
  await prisma.$disconnect();
});

describe('E2E: Catálogo — Listagem e Detalhe', () => {
  it('Lista produtos vindos do PostgreSQL com variantes e imagens', async () => {
    const res = await request(app).get('/api/v1/products');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const products = res.body.data;
    expect(products.length).toBeGreaterThan(0);

    // Verify product structure matches database schema
    const product = products[0];
    expect(product.id).toMatch(/^[a-f0-9-]{36}$/); // UUID from PostgreSQL
    expect(product.name).toBeDefined();
    expect(product.slug).toBeDefined();
    expect(product.basePrice).toBeDefined();
    expect(product.category).toBeDefined();
    expect(product.category.id).toBeDefined();
    expect(product.category.name).toBeDefined();
    expect(product.category.slug).toBeDefined();
    expect(Array.isArray(product.images)).toBe(true);
    expect(Array.isArray(product.variants)).toBe(true);
    expect(product.variants.length).toBeGreaterThan(0);
    expect(product.variants[0].stockQty).toBeDefined();
    expect(typeof product.variants[0].stockQty).toBe('number');
  });

  it('Produto detalhe por slug retorna dados completos do banco', async () => {
    const res = await request(app).get('/api/v1/products/slug/teclado-mecanico-red');
    expect(res.status).toBe(200);

    const product = res.body.data;
    expect(product.name).toBe('Teclado Mecânico RGB Red Switch');
    expect(product.slug).toBe('teclado-mecanico-red');
    expect(Number(product.basePrice)).toBe(299.9);
    expect(product.category.name).toBe('Teclados Mecânicos');

    // Imagens
    expect(product.images.length).toBeGreaterThan(0);
    expect(product.images[0].url).toBeDefined();
    expect(product.images[0].isPrimary).toBe(true);

    // Variantes
    expect(product.variants.length).toBeGreaterThan(0);
    const variant = product.variants[0];
    expect(variant.id).toBeDefined();
    expect(variant.name).toBeDefined();
    expect(variant.sku).toBeDefined();
    expect(variant.stockQty).toBeGreaterThan(0);
  });

  it('Verifica que dados reais existem no PostgreSQL', async () => {
    // Direct database validation
    const productCount = await prisma.product.count({ where: { deletedAt: null } });
    expect(productCount).toBeGreaterThanOrEqual(5);

    const variantCount = await prisma.productVariant.count({ where: { deletedAt: null } });
    expect(variantCount).toBeGreaterThanOrEqual(5);

    const imageCount = await prisma.image.count();
    expect(imageCount).toBeGreaterThanOrEqual(5);

    const categoryCount = await prisma.category.count();
    expect(categoryCount).toBeGreaterThanOrEqual(3);
  });
});

describe('E2E: Busca Server-Side', () => {
  it('Busca por nome retorna resultados filtrados pelo backend', async () => {
    const res = await request(app).get('/api/v1/products?search=Wireless');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);

    // All results should match the search term
    for (const product of res.body.data) {
      const matchesSearch =
        product.name.toLowerCase().includes('wireless') ||
        (product.description && product.description.toLowerCase().includes('wireless')) ||
        (product.brand && product.brand.toLowerCase().includes('wireless')) ||
        (product.sku && product.sku.toLowerCase().includes('wireless'));
      expect(matchesSearch).toBe(true);
    }
  });

  it('Busca sem resultados retorna array vazio', async () => {
    const res = await request(app).get('/api/v1/products?search=xyznonexistent123');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta.total).toBe(0);
  });

  it('Busca por SKU funciona', async () => {
    const res = await request(app).get('/api/v1/products?search=KB-RED');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });
});

describe('E2E: Paginação', () => {
  it('Página 1 com limit=2 retorna 2 produtos', async () => {
    const res = await request(app).get('/api/v1/products?page=1&limit=2');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
    expect(res.body.meta.page).toBe(1);
    expect(res.body.meta.limit).toBe(2);
    expect(res.body.meta.total).toBeGreaterThanOrEqual(5);
    expect(res.body.meta.totalPages).toBeGreaterThanOrEqual(3);
    expect(res.body.meta.hasNext).toBe(true);
    expect(res.body.meta.hasPrev).toBe(false);
  });

  it('Página 2 retorna produtos diferentes da página 1', async () => {
    const page1 = await request(app).get('/api/v1/products?page=1&limit=2');
    const page2 = await request(app).get('/api/v1/products?page=2&limit=2');

    expect(page1.status).toBe(200);
    expect(page2.status).toBe(200);

    const page1Ids = page1.body.data.map((p: { id: string }) => p.id);
    const page2Ids = page2.body.data.map((p: { id: string }) => p.id);

    // No overlap between pages
    for (const id of page2Ids) {
      expect(page1Ids).not.toContain(id);
    }
  });

  it('Última página tem hasPrev=true e hasNext=false', async () => {
    const res = await request(app).get('/api/v1/products?page=1&limit=2');
    const lastPage = res.body.meta.totalPages;

    const last = await request(app).get(`/api/v1/products?page=${lastPage}&limit=2`);
    expect(last.body.meta.hasPrev).toBe(true);
    expect(last.body.meta.hasNext).toBe(false);
  });
});

describe('E2E: Categorias', () => {
  it('Lista categorias vindas do PostgreSQL', async () => {
    const res = await request(app).get('/api/v1/categories');
    expect(res.status).toBe(200);

    const categories = res.body.data;
    expect(categories.length).toBeGreaterThanOrEqual(3);

    // Verify seed categories exist
    const names = categories.map((c: { name: string }) => c.name);
    expect(names).toContain('Teclados');
    expect(names).toContain('Teclados Mecânicos');
    expect(names).toContain('RGB');
  });

  it('Filtrar produtos por categoryId retorna apenas produtos da categoria', async () => {
    // Get category "Teclados Mecânicos"
    const catRes = await request(app).get('/api/v1/categories/slug/teclados-mecanicos');
    expect(catRes.status).toBe(200);
    const categoryId = catRes.body.data.id;

    // Filter products
    const res = await request(app).get(`/api/v1/products?categoryId=${categoryId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);

    // Validate all products belong to this category
    for (const product of res.body.data) {
      expect(product.category.id).toBe(categoryId);
    }
  });

  it('Categorias possuem contagem de produtos', async () => {
    const res = await request(app).get('/api/v1/categories');
    expect(res.status).toBe(200);

    const withProducts = res.body.data.find(
      (c: { _count: { products: number } }) => c._count.products > 0,
    );
    expect(withProducts).toBeDefined();
    expect(withProducts._count.products).toBeGreaterThan(0);
  });
});

describe('E2E: Variantes e Estoque', () => {
  it('Produto tem variante com estoque > 0', async () => {
    const res = await request(app).get('/api/v1/products/slug/teclado-mecanico-red');
    expect(res.status).toBe(200);

    const variant = res.body.data.variants[0];
    expect(variant.stockQty).toBeGreaterThan(0);
    expect(variant.sku).toMatch(/^KB-RED-001-DEFAULT$/);
    expect(variant.isActive).toBe(true);
  });

  it('Adicionar variante real ao carrinho funciona', async () => {
    // Register/login user
    const email = `e2e-catalog-${Date.now()}@test.com`;
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({ email, password: 'TestPass123!', name: 'E2E User' });
    expect(regRes.status).toBe(201);
    const token = regRes.body.data.accessToken;
    const userId = regRes.body.data.user.id;

    // Get product with variant
    const productRes = await request(app).get('/api/v1/products/slug/teclado-mecanico-red');
    const variantId = productRes.body.data.variants[0].id;

    // Add to cart
    const cartRes = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ variantId, quantity: 1 });

    expect(cartRes.status).toBe(200);
    expect(cartRes.body.data.items.length).toBe(1);
    expect(cartRes.body.data.items[0].variantId).toBe(variantId);

    // Cleanup
    await prisma.cartItem.deleteMany({ where: { cart: { userId } } });
    await prisma.cart.deleteMany({ where: { userId } });
    await prisma.refreshToken.deleteMany({ where: { userId } });
    await prisma.auditLog.deleteMany({ where: { OR: [{ actorId: userId }, { userId }] } });
    await prisma.user.delete({ where: { id: userId } });
  });
});

describe('E2E: Segurança', () => {
  it('Endpoints públicos de catálogo funcionam sem token', async () => {
    const products = await request(app).get('/api/v1/products');
    expect(products.status).toBe(200);

    const detail = await request(app).get('/api/v1/products/slug/teclado-mecanico-red');
    expect(detail.status).toBe(200);

    const categories = await request(app).get('/api/v1/categories');
    expect(categories.status).toBe(200);
  });

  it('Respostas não expõem campos sensíveis', async () => {
    const res = await request(app).get('/api/v1/products');
    const product = res.body.data[0];

    // Should not contain sensitive fields
    expect(product.passwordHash).toBeUndefined();
    // deletedAt can be null (filtered, but returned by Prisma) - that's OK
    // The important thing is passwordHash/tokens are never exposed
  });
});
