import { PrismaClient, Prisma } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed...');

  // ========================
  // ADMIN USER
  // ========================

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@keycaps.dev';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!Dev';
  const adminHash = await argon2.hash(adminPassword);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: 'ADMIN' },
    create: {
      email: adminEmail,
      name: 'Admin',
      passwordHash: adminHash,
      role: 'ADMIN',
      isEmailVerified: true,
    },
  });

  console.log(`✅ Admin user: ${adminEmail}`);

  // ========================
  // CATEGORIAS
  // ========================

  const teclados = await prisma.category.upsert({
    where: { slug: 'teclados' },
    update: {},
    create: {
      name: 'Teclados',
      slug: 'teclados',
    },
  });

  const mecanicos = await prisma.category.upsert({
    where: { slug: 'teclados-mecanicos' },
    update: {},
    create: {
      name: 'Teclados Mecânicos',
      slug: 'teclados-mecanicos',
      parentId: teclados.id,
    },
  });

  await prisma.category.upsert({
    where: { slug: 'rgb' },
    update: {},
    create: {
      name: 'RGB',
      slug: 'rgb',
      parentId: teclados.id,
    },
  });

  // ========================
  // PRODUTOS
  // ========================

  const products = [
    {
      name: 'Teclado Mecânico RGB Red Switch',
      slug: 'teclado-mecanico-red',
      basePrice: 299.9,
      sku: 'KB-RED-001',
      specs: { switch: 'Red', layout: 'ABNT2', rgb: true, size: 'Full Size' },
      isFeatured: true,
      image: '/images/products/Tofu65.png',
    },
    {
      name: 'Teclado Mecânico Blue Switch',
      slug: 'teclado-mecanico-blue',
      basePrice: 259.9,
      sku: 'KB-BLUE-001',
      specs: { switch: 'Blue', layout: 'ABNT2', rgb: false, size: 'TKL' },
      isFeatured: false,
      image: '/images/products/bakeneko.png',
    },
    {
      name: 'Teclado Gamer 60% RGB',
      slug: 'teclado-60-rgb',
      basePrice: 199.9,
      sku: 'KB-60-RGB-001',
      specs: { switch: 'Red', layout: '60%', rgb: true, size: '60%' },
      isFeatured: true,
      image: '/images/products/case1.png',
    },
    {
      name: 'Teclado Mecânico Wireless',
      slug: 'teclado-wireless',
      basePrice: 349.9,
      sku: 'KB-WL-001',
      specs: { switch: 'Brown', layout: 'ABNT2', rgb: true, wireless: true },
      isFeatured: true,
      image: '/images/products/mt3-susuwari.png',
    },
    {
      name: 'Teclado Básico Membrana',
      slug: 'teclado-membrana',
      basePrice: 89.9,
      sku: 'KB-MEMB-001',
      specs: { type: 'membrana', layout: 'ABNT2', rgb: false },
      isFeatured: false,
      image: '/images/products/pbtbotanical.png',
    },
  ];

  const keyboardVariantsBySlug: Record<string, { productId: string; variantId: string; price: number }> = {};

  for (const product of products) {
    const created = await prisma.product.upsert({
      where: { slug: product.slug },
      update: {
        basePrice: product.basePrice,
        isFeatured: product.isFeatured,
      },
      create: {
        name: product.name,
        slug: product.slug,
        basePrice: product.basePrice,
        sku: product.sku,
        specs: product.specs,
        categoryId: mecanicos.id,
        isFeatured: product.isFeatured,
      },
    });

    // Criar variante padrão para cada produto
    const variantSku = `${product.sku}-DEFAULT`;
    const variant = await prisma.productVariant.upsert({
      where: { sku: variantSku },
      update: {
        stockQty: 10,
      },
      create: {
        productId: created.id,
        name: `${product.name} — Padrão`,
        sku: variantSku,
        stockQty: 10,
        price: product.basePrice,
        switchType: product.specs.switch ?? null,
        layout: product.specs.layout ?? null,
      },
    });

    keyboardVariantsBySlug[product.slug] = {
      productId: created.id,
      variantId: variant.id,
      price: product.basePrice,
    };

    // Criar imagem do produto (imagem real do catálogo)
    await prisma.image.upsert({
      where: { id: `img-${product.slug}` },
      update: { url: product.image, altText: product.name },
      create: {
        id: `img-${product.slug}`,
        productId: created.id,
        url: product.image,
        altText: product.name,
        category: 'PRODUCT',
        isPrimary: true,
        sortOrder: 0,
      },
    });
  }

  // ========================
  // CATÁLOGO DE COMPONENTES (switches, keycaps, cases, cabos)
  // ========================
  // Necessário para que as builds da comunidade referenciem produtos/variantes
  // reais do catálogo (preço, estoque e disponibilidade verdadeiros).

  const componentesRoot = await prisma.category.upsert({
    where: { slug: 'componentes' },
    update: {},
    create: { name: 'Componentes', slug: 'componentes' },
  });

  const catSwitches = await prisma.category.upsert({
    where: { slug: 'switches' },
    update: {},
    create: { name: 'Switches', slug: 'switches', parentId: componentesRoot.id },
  });
  const catKeycaps = await prisma.category.upsert({
    where: { slug: 'keycaps' },
    update: {},
    create: { name: 'Keycaps', slug: 'keycaps', parentId: componentesRoot.id },
  });
  const catCases = await prisma.category.upsert({
    where: { slug: 'cases' },
    update: {},
    create: { name: 'Cases', slug: 'cases', parentId: componentesRoot.id },
  });
  const catCabos = await prisma.category.upsert({
    where: { slug: 'cabos' },
    update: {},
    create: { name: 'Cabos', slug: 'cabos', parentId: componentesRoot.id },
  });
  const catPcb = await prisma.category.upsert({
    where: { slug: 'pcb' },
    update: {},
    create: { name: 'PCB', slug: 'pcb', parentId: componentesRoot.id },
  });
  const catPlates = await prisma.category.upsert({
    where: { slug: 'plates' },
    update: {},
    create: { name: 'Plates', slug: 'plates', parentId: componentesRoot.id },
  });
  const catExtras = await prisma.category.upsert({
    where: { slug: 'extras' },
    update: {},
    create: { name: 'Extras', slug: 'extras', parentId: componentesRoot.id },
  });

  // BuilderCategory — normaliza a categoria de exibição (catCases/catPcb/...) para
  // a categoria funcional que o /builder usa para filtrar e validar compatibilidade.
  type BuilderCategory = 'case' | 'pcb' | 'plate' | 'switch' | 'keycap' | 'extra';

  interface ComponentSeed {
    name: string;
    slug: string;
    sku: string;
    brand: string;
    basePrice: number;
    stockQty: number;
    categoryId: string;
    builderCategory: BuilderCategory;
    image: string;
    /** Normalized layout this component supports/requires: '60'|'65'|'75'|'tkl'|'full'. */
    layout?: string;
    /** Mount/switch-type family: 'MX' | 'Low Profile' | 'Optical'. Not applicable to cases/extras. */
    switchType?: string;
    specs?: Record<string, unknown>;
  }

  const components: ComponentSeed[] = [
    // ── Switches (vendidos em packs — specs.packSize) ──────────────────────
    { name: 'Gateron Oil King (Linear)', slug: 'gateron-oil-king', sku: 'SW-GATERON-OIL', brand: 'Gateron', basePrice: 89.9, stockQty: 50, categoryId: catSwitches.id, builderCategory: 'switch', image: '/images/products/gateron-oil.png', switchType: 'MX', specs: { packSize: 10, feel: 'Linear' } },
    { name: 'Cherry MX Blue (Clicky)', slug: 'cherry-mx-blue', sku: 'SW-CHERRY-BLUE', brand: 'Cherry', basePrice: 79.9, stockQty: 40, categoryId: catSwitches.id, builderCategory: 'switch', image: '/images/products/switch-blue.png', switchType: 'MX', specs: { packSize: 10, feel: 'Clicky' } },
    // Deliberadamente sem estoque — usado para validar disponibilidade parcial de builds.
    { name: 'Holy Panda (Tátil)', slug: 'holy-panda', sku: 'SW-HOLY-PANDA', brand: 'Drop', basePrice: 129.9, stockQty: 0, categoryId: catSwitches.id, builderCategory: 'switch', image: '/images/products/mmd_holy_panda.png', switchType: 'MX', specs: { packSize: 10, feel: 'Tátil' } },
    // Mount family diferente — usado para provar incompatibilidade real (não combina com PCB/keycaps MX).
    { name: 'Switch Óptico Flaretech', slug: 'switch-optico-flaretech', sku: 'SW-OPTICAL', brand: 'Flaretech', basePrice: 69.9, stockQty: 30, categoryId: catSwitches.id, builderCategory: 'switch', image: '/images/products/switch-blue.png', switchType: 'Optical', specs: { packSize: 10, feel: 'Linear' } },

    // ── Keycaps (layout = cobertura máxima; switchType = stem) ─────────────
    { name: 'Keycaps GMK Laser', slug: 'keycaps-gmk-laser', sku: 'KC-GMK-LASER', brand: 'GMK', basePrice: 349.9, stockQty: 15, categoryId: catKeycaps.id, builderCategory: 'keycap', image: '/images/products/gmkLaser.png', switchType: 'MX', layout: 'full' },
    { name: 'Keycaps PBT Botanical', slug: 'keycaps-pbt-botanical', sku: 'KC-PBT-BOTANICAL', brand: 'Infinikey', basePrice: 199.9, stockQty: 25, categoryId: catKeycaps.id, builderCategory: 'keycap', image: '/images/products/pbtbotanical.png', switchType: 'MX', layout: 'tkl' },
    { name: 'Keycaps MT3 Compact 65%', slug: 'keycaps-mt3-compact', sku: 'KC-MT3-65', brand: 'Drop', basePrice: 159.9, stockQty: 20, categoryId: catKeycaps.id, builderCategory: 'keycap', image: '/images/products/mt3-susuwari.png', switchType: 'MX', layout: '65' },

    // ── Cases (layout = compatibilidade principal) ─────────────────────────
    { name: 'Case de Alumínio Tofu65', slug: 'case-tofu65', sku: 'CS-TOFU65', brand: 'KBDFans', basePrice: 599.9, stockQty: 10, categoryId: catCases.id, builderCategory: 'case', image: '/images/products/Tofu65.png', layout: '65' },
    { name: 'Case Bakeneko60', slug: 'case-bakeneko60', sku: 'CS-BAKENEKO60', brand: 'CannonKeys', basePrice: 449.9, stockQty: 12, categoryId: catCases.id, builderCategory: 'case', image: '/images/products/bakeneko.png', layout: '60' },
    // Case modular — suporta mais de um layout (specs.supportedLayouts).
    { name: 'Case Modular 75%', slug: 'case-modular-75', sku: 'CS-MODULAR-75', brand: 'KBDFans', basePrice: 649.9, stockQty: 8, categoryId: catCases.id, builderCategory: 'case', image: '/images/products/case1.png', layout: '75', specs: { supportedLayouts: ['65', '75'] } },

    // ── PCB (layout + switchType = mount suportado) ────────────────────────
    { name: 'PCB Hotswap 65%', slug: 'pcb-hotswap-65', sku: 'PCB-HS-65', brand: 'KBDFans', basePrice: 349.9, stockQty: 15, categoryId: catPcb.id, builderCategory: 'pcb', image: '/images/product-placeholder.svg', layout: '65', switchType: 'MX' },
    { name: 'PCB Hotswap 75%', slug: 'pcb-hotswap-75', sku: 'PCB-HS-75', brand: 'KBDFans', basePrice: 399.9, stockQty: 10, categoryId: catPcb.id, builderCategory: 'pcb', image: '/images/product-placeholder.svg', layout: '75', switchType: 'MX' },
    // Deliberadamente sem estoque — usado para provar validação de estoque no builder.
    { name: 'PCB Solder TKL', slug: 'pcb-solder-tkl', sku: 'PCB-SOLDER-TKL', brand: 'KBDFans', basePrice: 429.9, stockQty: 0, categoryId: catPcb.id, builderCategory: 'pcb', image: '/images/product-placeholder.svg', layout: 'tkl', switchType: 'MX' },

    // ── Plates (layout = compatibilidade com PCB/case) ─────────────────────
    { name: 'Plate Alumínio 65%', slug: 'plate-aluminio-65', sku: 'PL-ALU-65', brand: 'KBDFans', basePrice: 149.9, stockQty: 20, categoryId: catPlates.id, builderCategory: 'plate', image: '/images/product-placeholder.svg', layout: '65' },
    { name: 'Plate Alumínio 75%', slug: 'plate-aluminio-75', sku: 'PL-ALU-75', brand: 'KBDFans', basePrice: 169.9, stockQty: 18, categoryId: catPlates.id, builderCategory: 'plate', image: '/images/product-placeholder.svg', layout: '75' },
    { name: 'Plate Policarbonato 60%', slug: 'plate-policarbonato-60', sku: 'PL-PC-60', brand: 'KBDFans', basePrice: 139.9, stockQty: 14, categoryId: catPlates.id, builderCategory: 'plate', image: '/images/product-placeholder.svg', layout: '60' },

    // ── Extras (0..N, sem compatibilidade de layout — exceto foam de case) ─
    // Continua na categoria "Cabos" (display) mas é tagueado builderCategory=extra
    // — o /builder filtra por tag, não por categoria de exibição, então a etapa
    // Extras já o inclui automaticamente.
    { name: 'Cabo USB-C Coiled Personalizado', slug: 'cabo-usb-c-coiled', sku: 'CB-COILED', brand: 'CruzCtrl', basePrice: 149.9, stockQty: 30, categoryId: catCabos.id, builderCategory: 'extra', image: '/images/products/cabo-coiled.png' },
    { name: 'Deskmat Qwerty XL', slug: 'deskmat-qwerty-xl', sku: 'EX-DESKMAT', brand: 'Qwerty', basePrice: 89.9, stockQty: 25, categoryId: catExtras.id, builderCategory: 'extra', image: '/images/product-placeholder.svg' },
    { name: 'Wrist Rest em Madeira', slug: 'wrist-rest-madeira', sku: 'EX-WRIST', brand: 'Qwerty', basePrice: 119.9, stockQty: 18, categoryId: catExtras.id, builderCategory: 'extra', image: '/images/product-placeholder.svg' },
    { name: 'Kit Switch + Keycap Puller', slug: 'kit-puller', sku: 'EX-PULLER', brand: 'KPRepublic', basePrice: 24.9, stockQty: 60, categoryId: catExtras.id, builderCategory: 'extra', image: '/images/products/switchtester.png' },
    { name: 'O-Rings (pack 120un)', slug: 'o-rings-pack', sku: 'EX-ORINGS', brand: 'Qwerty', basePrice: 34.9, stockQty: 40, categoryId: catExtras.id, builderCategory: 'extra', image: '/images/product-placeholder.svg' },
    // Extra com restrição de layout real — a foam precisa caber no case 75%.
    { name: 'Case Foam 75%', slug: 'case-foam-75', sku: 'EX-FOAM-75', brand: 'Qwerty', basePrice: 49.9, stockQty: 22, categoryId: catExtras.id, builderCategory: 'extra', image: '/images/product-placeholder.svg', layout: '75' },
  ];

  const componentVariantsBySlug: Record<string, { productId: string; variantId: string; price: number }> = {};

  for (const c of components) {
    const createdProduct = await prisma.product.upsert({
      where: { slug: c.slug },
      update: {
        basePrice: c.basePrice,
        brand: c.brand,
        categoryId: c.categoryId,
        specs: (c.specs ?? undefined) as Prisma.InputJsonValue | undefined,
        tags: JSON.stringify([c.builderCategory]),
      },
      create: {
        name: c.name,
        slug: c.slug,
        brand: c.brand,
        basePrice: c.basePrice,
        sku: c.sku,
        categoryId: c.categoryId,
        specs: c.specs as Prisma.InputJsonValue | undefined,
        tags: JSON.stringify([c.builderCategory]),
      },
    });

    const variantSku = `${c.sku}-DEFAULT`;
    const variant = await prisma.productVariant.upsert({
      where: { sku: variantSku },
      update: { stockQty: c.stockQty, price: c.basePrice, layout: c.layout ?? null, switchType: c.switchType ?? null },
      create: {
        productId: createdProduct.id,
        name: `${c.name} — Padrão`,
        sku: variantSku,
        stockQty: c.stockQty,
        price: c.basePrice,
        layout: c.layout ?? null,
        switchType: c.switchType ?? null,
      },
    });

    await prisma.image.upsert({
      where: { id: `img-${c.slug}` },
      update: { url: c.image, altText: c.name },
      create: {
        id: `img-${c.slug}`,
        productId: createdProduct.id,
        url: c.image,
        altText: c.name,
        category: 'PRODUCT',
        isPrimary: true,
        sortOrder: 0,
      },
    });

    componentVariantsBySlug[c.slug] = { productId: createdProduct.id, variantId: variant.id, price: c.basePrice };
  }

  console.log('✅ Catálogo de componentes seedado (switches, keycaps, cases, PCB, plates, extras)!');

  // ========================
  // USUÁRIO DEMO (dono das builds da comunidade)
  // ========================

  const communityUserEmail = 'comunidade@keycaps.dev';
  const communityUser = await prisma.user.upsert({
    where: { email: communityUserEmail },
    update: {},
    create: {
      email: communityUserEmail,
      name: 'Comunidade Qwerty',
      passwordHash: await argon2.hash('Community123!Dev'),
      role: 'USER',
      isEmailVerified: true,
    },
  });

  // ========================
  // BUILDS DA COMUNIDADE
  // ========================

  interface CommunityBuildSeed {
    id: string;
    title: string;
    description: string;
    layout: string;
    likes: number;
    imageUrl: string;
    items: Array<{ category: string; slug: string; sortOrder: number }>;
  }

  const communityBuildsSeed: CommunityBuildSeed[] = [
    {
      id: 'seed-build-midnight-purple',
      title: 'Midnight Purple',
      description: 'Build em alumínio anodizado roxo escuro com switches lineares suaves e keycaps laser.',
      layout: '65%',
      likes: 234,
      imageUrl: '/images/community/midnight-purple.png',
      items: [
        { category: 'Case', slug: 'case-tofu65', sortOrder: 0 },
        { category: 'Switch', slug: 'gateron-oil-king', sortOrder: 1 },
        { category: 'Keycaps', slug: 'keycaps-gmk-laser', sortOrder: 2 },
        { category: 'Extras', slug: 'cabo-usb-c-coiled', sortOrder: 3 },
      ],
    },
    {
      id: 'seed-build-botanical-garden',
      title: 'Botanical Garden',
      description: 'Build com keycaps artísticos em PBT e case compacto, inspirada em jardins botânicos.',
      layout: '60%',
      likes: 189,
      imageUrl: '/images/community/botanic-garden.png',
      items: [
        { category: 'Case', slug: 'case-bakeneko60', sortOrder: 0 },
        // Holy Panda está sem estoque de propósito — demonstra build parcialmente disponível.
        { category: 'Switch', slug: 'holy-panda', sortOrder: 1 },
        { category: 'Keycaps', slug: 'keycaps-pbt-botanical', sortOrder: 2 },
        { category: 'Extras', slug: 'cabo-usb-c-coiled', sortOrder: 3 },
      ],
    },
    {
      id: 'seed-build-vintage-terminal',
      title: 'Vintage Terminal',
      description: 'Build minimalista com switches clicky clássicos e keycaps em tema botânico, visual retrô.',
      layout: 'Full Size',
      likes: 312,
      imageUrl: '/images/community/retro-terminal.png',
      items: [
        { category: 'Case', slug: 'case-tofu65', sortOrder: 0 },
        { category: 'Switch', slug: 'cherry-mx-blue', sortOrder: 1 },
        { category: 'Keycaps', slug: 'keycaps-pbt-botanical', sortOrder: 2 },
      ],
    },
  ];

  for (const b of communityBuildsSeed) {
    const build = await prisma.communityBuild.upsert({
      where: { id: b.id },
      update: {
        title: b.title,
        description: b.description,
        layout: b.layout,
        likes: b.likes,
        imageUrl: b.imageUrl,
      },
      create: {
        id: b.id,
        title: b.title,
        description: b.description,
        layout: b.layout,
        likes: b.likes,
        imageUrl: b.imageUrl,
        ownerId: communityUser.id,
      },
    });

    // Substitui os itens para manter o seed idempotente e consistente com a lista acima.
    await prisma.communityBuildItem.deleteMany({ where: { buildId: build.id } });
    for (const item of b.items) {
      const ref = componentVariantsBySlug[item.slug];
      if (!ref) throw new Error(`Componente não encontrado no seed: ${item.slug}`);
      await prisma.communityBuildItem.create({
        data: {
          buildId: build.id,
          category: item.category,
          sortOrder: item.sortOrder,
          productId: ref.productId,
          variantId: ref.variantId,
        },
      });
    }
  }

  console.log('✅ Builds da comunidade seedadas!');

  // ========================
  // PEDIDOS DEMO (para "Mais vendidos" ter dados reais de vendas)
  // ========================

  const demoOrders: Array<{ number: string; items: Array<{ slug: string; qty: number }> }> = [
    { number: 'DEMO-0001', items: [{ slug: 'teclado-mecanico-red', qty: 3 }, { slug: 'teclado-60-rgb', qty: 2 }] },
    { number: 'DEMO-0002', items: [{ slug: 'teclado-mecanico-red', qty: 2 }, { slug: 'teclado-wireless', qty: 1 }] },
    { number: 'DEMO-0003', items: [{ slug: 'teclado-60-rgb', qty: 4 }, { slug: 'teclado-mecanico-blue', qty: 1 }] },
  ];

  for (const demoOrder of demoOrders) {
    const existing = await prisma.order.findUnique({ where: { orderNumber: demoOrder.number } });
    if (existing) continue;

    const itemsData = demoOrder.items.map(({ slug, qty }) => {
      const ref = keyboardVariantsBySlug[slug];
      const productMeta = products.find((p) => p.slug === slug)!;
      return {
        productId: ref.productId,
        variantId: ref.variantId,
        productName: productMeta.name,
        variantName: `${productMeta.name} — Padrão`,
        sku: `${productMeta.sku}-DEFAULT`,
        quantity: qty,
        unitPrice: ref.price,
        total: Number((ref.price * qty).toFixed(2)),
      };
    });
    const subtotal = itemsData.reduce((sum, i) => sum + i.total, 0);

    await prisma.order.create({
      data: {
        orderNumber: demoOrder.number,
        userId: communityUser.id,
        status: 'DELIVERED',
        subtotal,
        shippingCost: 0,
        total: subtotal,
        items: { create: itemsData },
      },
    });
  }

  console.log('✅ Pedidos demo seedados (base real para "Mais vendidos")!');

  console.log('✅ Seed finalizado!');
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
