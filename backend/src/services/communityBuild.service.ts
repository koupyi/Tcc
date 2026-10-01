import { prisma } from '../config/database';
import { CommunityBuildRepository, CommunityBuildWithItems } from '../repositories/communityBuild.repository';
import { AppError } from '../utils/AppError';

export interface ResolvedBuildItem {
  id: string;
  category: string;
  sortOrder: number;
  productId: string;
  productSlug: string;
  productName: string;
  categoryId: string | null;
  variantId: string;
  variantName: string;
  sku: string;
  imageUrl: string | null;
  unitPrice: number;
  stockQty: number;
  available: boolean;
}

export interface ResolvedBuild {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  layout: string | null;
  likes: number;
  owner: { id: string; name: string | null };
  items: ResolvedBuildItem[];
  totalComponents: number;
  availableComponents: number;
  estimatedPrice: number;
}

function resolveItem(item: CommunityBuildWithItems['items'][number]): ResolvedBuildItem {
  const { product, variant } = item;
  const unitPrice = Number(variant.price ?? product.salePrice ?? product.basePrice);
  const available =
    product.isActive &&
    !product.deletedAt &&
    variant.isActive &&
    !variant.deletedAt &&
    variant.stockQty > 0;

  const imageUrl = variant.images[0]?.url ?? product.images[0]?.url ?? null;

  return {
    id: item.id,
    category: item.category,
    sortOrder: item.sortOrder,
    productId: product.id,
    productSlug: product.slug,
    productName: product.name,
    categoryId: product.categoryId,
    variantId: variant.id,
    variantName: variant.name,
    sku: variant.sku,
    imageUrl,
    unitPrice,
    stockQty: variant.stockQty,
    available,
  };
}

function resolveBuild(build: CommunityBuildWithItems): ResolvedBuild {
  const items = build.items.map(resolveItem);
  const availableComponents = items.filter((i) => i.available).length;
  const estimatedPrice = items.reduce((sum, i) => sum + i.unitPrice, 0);

  return {
    id: build.id,
    title: build.title,
    description: build.description,
    imageUrl: build.imageUrl,
    layout: build.layout,
    likes: build.likes,
    owner: build.owner,
    items,
    totalComponents: items.length,
    availableComponents,
    estimatedPrice: Number(estimatedPrice.toFixed(2)),
  };
}

export class CommunityBuildService {
  private repo = new CommunityBuildRepository();

  async list(limit?: number): Promise<ResolvedBuild[]> {
    const builds = await this.repo.findMany(limit);
    return builds.map(resolveBuild);
  }

  async getById(id: string): Promise<ResolvedBuild> {
    const build = await this.repo.findById(id);
    if (!build) throw AppError.notFound('Build não encontrada');
    return resolveBuild(build);
  }

  async like(id: string): Promise<{ likes: number }> {
    const build = await this.repo.findById(id);
    if (!build) throw AppError.notFound('Build não encontrada');
    const updated = await this.repo.incrementLikes(id);
    return { likes: updated.likes };
  }

  /**
   * Adds every currently-available component of a build to the user's server cart.
   * Fully transactional and re-validates price/stock/active-state fresh at write time —
   * never trusts the availability snapshot the client fetched earlier.
   */
  async addToCart(userId: string, buildId: string) {
    const build = await this.repo.findById(buildId);
    if (!build) throw AppError.notFound('Build não encontrada');

    const added: Array<{ variantId: string; productName: string; quantity: number }> = [];
    const skipped: Array<{ variantId: string; productName: string; reason: string }> = [];

    await prisma.$transaction(async (tx) => {
      let cart = await tx.cart.findFirst({
        where: { userId, isActive: true },
        include: { items: true },
      });

      if (!cart) {
        cart = await tx.cart.create({
          data: {
            userId,
            isActive: true,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
          include: { items: true },
        });
      }

      for (const item of build.items) {
        // Re-fetch fresh inside the transaction — the list/detail read that
        // rendered the UI may be stale by the time the user clicks "buy".
        const variant = await tx.productVariant.findFirst({
          where: { id: item.variantId, deletedAt: null, isActive: true },
          include: { product: true },
        });

        if (!variant || !variant.product.isActive || variant.product.deletedAt) {
          skipped.push({
            variantId: item.variantId,
            productName: item.product.name,
            reason: 'Produto indisponível',
          });
          continue;
        }

        if (variant.stockQty < 1) {
          skipped.push({
            variantId: item.variantId,
            productName: item.product.name,
            reason: 'Sem estoque no momento da compra',
          });
          continue;
        }

        const existing = cart.items.find((i) => i.variantId === variant.id);
        const nextQty = (existing?.quantity ?? 0) + 1;

        if (nextQty > 99 || variant.stockQty < nextQty) {
          skipped.push({
            variantId: item.variantId,
            productName: item.product.name,
            reason: `Estoque insuficiente. Disponível: ${variant.stockQty}`,
          });
          continue;
        }

        const unitPrice = variant.price ?? variant.product.salePrice ?? variant.product.basePrice;

        await tx.cartItem.upsert({
          where: { cartId_variantId: { cartId: cart.id, variantId: variant.id } },
          update: { quantity: { increment: 1 } },
          create: {
            cartId: cart.id,
            variantId: variant.id,
            quantity: 1,
            unitPrice: Number(unitPrice),
          },
        });

        added.push({ variantId: variant.id, productName: variant.product.name, quantity: 1 });
      }
    });

    return { added, skipped, totalComponents: build.items.length };
  }
}
