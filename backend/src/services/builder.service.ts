import { Prisma, ProductVariant, Product } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import { checkCompatibility, REQUIRED_BUILDER_CATEGORIES, BuilderCategory } from './builderCompatibility';
import { BuilderConfigurationInput } from '../validators/builder.validator';

const BUILDER_CATEGORIES: BuilderCategory[] = ['case', 'pcb', 'plate', 'switch', 'keycap', 'extra'];

interface BuilderOptionDTO {
  productId: string;
  variantId: string;
  category: BuilderCategory;
  slug: string;
  name: string;
  variantName: string;
  imageUrl: string | null;
  unitPrice: number;
  stockQty: number;
  layout: string | null;
  switchType: string | null;
  specs: Record<string, unknown> | null;
}

export interface ResolvedBuilderItem {
  category: BuilderCategory;
  variantId: string;
  quantity: number;
  valid: boolean;
  reason?: string;
  productId?: string;
  productName?: string;
  variantName?: string;
  unitPrice?: number;
  stockQty?: number;
}

function parseBuilderCategory(tags: string | null): BuilderCategory | null {
  if (!tags) return null;
  try {
    const arr = JSON.parse(tags);
    const val = Array.isArray(arr) ? arr[0] : null;
    return BUILDER_CATEGORIES.includes(val) ? (val as BuilderCategory) : null;
  } catch {
    return null;
  }
}

function extractSupportedLayouts(specs: Prisma.JsonValue | null): string[] | null {
  if (!specs || typeof specs !== 'object' || Array.isArray(specs)) return null;
  const val = (specs as Record<string, unknown>).supportedLayouts;
  return Array.isArray(val) ? val.filter((v): v is string => typeof v === 'string') : null;
}

type VariantWithProduct = ProductVariant & { product: Product };

export class BuilderService {
  /** Single aggregated read — no N+1 across builder steps. */
  async getOptions(): Promise<{ layouts: string[]; options: Record<BuilderCategory, BuilderOptionDTO[]> }> {
    const products = await prisma.product.findMany({
      where: { isActive: true, deletedAt: null, tags: { not: null } },
      include: {
        images: { where: { isPrimary: true }, take: 1 },
        variants: { where: { deletedAt: null, isActive: true } },
      },
    });

    const options: Record<BuilderCategory, BuilderOptionDTO[]> = {
      case: [],
      pcb: [],
      plate: [],
      switch: [],
      keycap: [],
      extra: [],
    };
    const layoutsSet = new Set<string>();

    for (const p of products) {
      const category = parseBuilderCategory(p.tags);
      if (!category) continue;

      for (const v of p.variants) {
        const unitPrice = Number(v.price ?? p.salePrice ?? p.basePrice);
        options[category].push({
          productId: p.id,
          variantId: v.id,
          category,
          slug: p.slug,
          name: p.name,
          variantName: v.name,
          imageUrl: p.images[0]?.url ?? null,
          unitPrice,
          stockQty: v.stockQty,
          layout: v.layout,
          switchType: v.switchType,
          specs: (p.specs as Record<string, unknown> | null) ?? null,
        });
        if (v.layout) layoutsSet.add(v.layout);
      }
    }

    const LAYOUT_ORDER = ['60', '65', '75', 'tkl', 'full'];
    const layouts = LAYOUT_ORDER.filter((l) => layoutsSet.has(l));

    return { layouts, options };
  }

  /**
   * Re-fetches every submitted item fresh from the database and re-checks
   * active state, stock, and compatibility. The client's price/stock are
   * never read — only `category`, `variantId`, `quantity` are trusted as input.
   */
  private async resolveAndValidate(input: BuilderConfigurationInput): Promise<ResolvedBuilderItem[]> {
    const variantCache = new Map<string, VariantWithProduct | null>();

    for (const item of input.items) {
      if (variantCache.has(item.variantId)) continue;
      const variant = await prisma.productVariant.findFirst({
        where: { id: item.variantId, deletedAt: null },
        include: { product: true },
      });
      variantCache.set(item.variantId, variant as VariantWithProduct | null);
    }

    // Lock in the mount/stem family from whichever submitted switch/pcb/keycap resolves first —
    // order-independent, since every item is checked against the same locked-in value.
    let ctxSwitchType: string | null = null;
    for (const item of input.items) {
      if (item.category !== 'switch' && item.category !== 'pcb' && item.category !== 'keycap') continue;
      const variant = variantCache.get(item.variantId);
      if (variant?.switchType) {
        ctxSwitchType = ctxSwitchType ?? variant.switchType;
      }
    }

    const ctx = { layout: input.layout ?? null, switchType: ctxSwitchType };
    const results: ResolvedBuilderItem[] = [];

    for (const item of input.items) {
      const variant = variantCache.get(item.variantId);

      if (!variant || !variant.product || variant.product.deletedAt || !variant.product.isActive) {
        results.push({ category: item.category, variantId: item.variantId, quantity: item.quantity, valid: false, reason: 'Produto indisponível.' });
        continue;
      }
      if (!variant.isActive || variant.deletedAt) {
        results.push({ category: item.category, variantId: item.variantId, quantity: item.quantity, valid: false, reason: 'Variante indisponível.', productId: variant.productId, productName: variant.product.name });
        continue;
      }

      const compat = checkCompatibility(
        item.category,
        { layout: variant.layout, switchType: variant.switchType, supportedLayouts: extractSupportedLayouts(variant.product.specs) },
        ctx,
      );
      if (!compat.compatible) {
        results.push({
          category: item.category,
          variantId: item.variantId,
          quantity: item.quantity,
          valid: false,
          reason: compat.reason,
          productId: variant.productId,
          productName: variant.product.name,
        });
        continue;
      }

      if (variant.stockQty < item.quantity) {
        results.push({
          category: item.category,
          variantId: item.variantId,
          quantity: item.quantity,
          valid: false,
          reason: `Estoque insuficiente. Disponível: ${variant.stockQty}`,
          productId: variant.productId,
          productName: variant.product.name,
        });
        continue;
      }

      const unitPrice = Number(variant.price ?? variant.product.salePrice ?? variant.product.basePrice);
      results.push({
        category: item.category,
        variantId: item.variantId,
        quantity: item.quantity,
        valid: true,
        productId: variant.productId,
        productName: variant.product.name,
        variantName: variant.name,
        unitPrice,
        stockQty: variant.stockQty,
      });
    }

    return results;
  }

  async validateConfiguration(input: BuilderConfigurationInput) {
    const items = await this.resolveAndValidate(input);

    const requiredPresent = new Set(items.filter((r) => REQUIRED_BUILDER_CATEGORIES.includes(r.category)).map((r) => r.category));
    const missingRequired = REQUIRED_BUILDER_CATEGORIES.filter((c) => !requiredPresent.has(c));
    const requiredInvalid = items.filter((r) => REQUIRED_BUILDER_CATEGORIES.includes(r.category) && !r.valid);

    const valid = missingRequired.length === 0 && requiredInvalid.length === 0;

    return { valid, items, missingRequired };
  }

  /**
   * Validates then atomically adds every valid REQUIRED item to the user's
   * server cart. If any required item is invalid or missing, nothing is
   * added and structured reasons are returned. Optional extras that are
   * invalid are skipped individually and reported — they never block the
   * required components from being added.
   */
  async addToCart(userId: string, input: BuilderConfigurationInput) {
    const validation = await this.validateConfiguration(input);

    if (!validation.valid) {
      const errors: Record<string, string[]> = {};
      for (const item of validation.items) {
        if (!item.valid && REQUIRED_BUILDER_CATEGORIES.includes(item.category)) {
          errors[item.category] = [item.reason ?? 'Item inválido.'];
        }
      }
      for (const missing of validation.missingRequired) {
        errors[missing] = errors[missing] ?? ['Este componente é obrigatório e não foi selecionado.'];
      }
      throw AppError.unprocessable('Revise sua configuração antes de adicionar ao carrinho.', errors);
    }

    const added: Array<{ category: BuilderCategory; variantId: string; productName: string; quantity: number }> = [];
    const skipped: Array<{ category: BuilderCategory; variantId: string; productName?: string; reason: string }> = [];

    await prisma.$transaction(async (tx) => {
      let cart = await tx.cart.findFirst({ where: { userId, isActive: true }, include: { items: true } });
      if (!cart) {
        cart = await tx.cart.create({
          data: { userId, isActive: true, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
          include: { items: true },
        });
      }

      for (const item of validation.items) {
        if (!item.valid) {
          // Only optional extras can reach here — required-invalid already aborted above.
          skipped.push({ category: item.category, variantId: item.variantId, productName: item.productName, reason: item.reason ?? 'Indisponível.' });
          continue;
        }

        // Re-fetch fresh one more time inside the transaction — the validation
        // read above may already be stale by the time we actually write.
        const variant = await tx.productVariant.findFirst({
          where: { id: item.variantId, deletedAt: null, isActive: true },
          include: { product: true },
        });

        if (!variant || !variant.product.isActive || variant.product.deletedAt) {
          skipped.push({ category: item.category, variantId: item.variantId, productName: item.productName, reason: 'Produto indisponível.' });
          continue;
        }
        if (variant.stockQty < item.quantity) {
          skipped.push({ category: item.category, variantId: item.variantId, productName: item.productName, reason: `Estoque insuficiente. Disponível: ${variant.stockQty}` });
          continue;
        }

        const existing = cart.items.find((i) => i.variantId === variant.id);
        const nextQty = (existing?.quantity ?? 0) + item.quantity;
        if (nextQty > 99 || variant.stockQty < nextQty) {
          skipped.push({ category: item.category, variantId: item.variantId, productName: item.productName, reason: `Estoque insuficiente. Disponível: ${variant.stockQty}` });
          continue;
        }

        const unitPrice = variant.price ?? variant.product.salePrice ?? variant.product.basePrice;

        await tx.cartItem.upsert({
          where: { cartId_variantId: { cartId: cart.id, variantId: variant.id } },
          update: { quantity: { increment: item.quantity } },
          create: { cartId: cart.id, variantId: variant.id, quantity: item.quantity, unitPrice: Number(unitPrice) },
        });

        added.push({ category: item.category, variantId: variant.id, productName: variant.product.name, quantity: item.quantity });
      }

      // Every required category was valid at validation time; if the atomic
      // re-check above skipped any of them (stock changed mid-flight), the
      // whole operation must not silently look successful.
      const skippedRequired = skipped.filter((s) => REQUIRED_BUILDER_CATEGORIES.includes(s.category));
      if (skippedRequired.length > 0) {
        throw AppError.conflict(
          `Um dos componentes obrigatórios ficou sem estoque durante a compra: ${skippedRequired.map((s) => s.productName ?? s.category).join(', ')}.`,
        );
      }
    });

    return { added, skipped };
  }
}
