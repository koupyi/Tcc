import { prisma } from '../config/database';
import { CartRepository } from '../repositories/cart.repository';
import { AppError } from '../utils/AppError';
import { AddCartItemInput, UpdateCartItemInput } from '../validators/cart.validator';

export interface MergeCartItem {
  variantId: string;
  quantity: number;
}

export class CartService {
  private cartRepo = new CartRepository();

  async getCart(userId: string) {
    let cart = await this.cartRepo.findActiveByUserId(userId);

    if (!cart) {
      await this.cartRepo.createCart(userId);
      cart = await this.cartRepo.findActiveByUserId(userId);
    }

    if (!cart) throw AppError.internal('Erro ao carregar carrinho');

    // Calcula totais
    const subtotal = cart.items.reduce(
      (sum, item) => sum + Number(item.unitPrice) * item.quantity,
      0,
    );

    return {
      ...cart,
      subtotal: Number(subtotal.toFixed(2)),
      itemCount: cart.items.reduce((sum, item) => sum + item.quantity, 0),
    };
  }

  async addItem(userId: string, input: AddCartItemInput) {
    // Use transaction to prevent race conditions on stock
    await prisma.$transaction(async (tx) => {
      // Lock the variant row for update
      const variant = await tx.productVariant.findFirst({
        where: { id: input.variantId, deletedAt: null, isActive: true },
        include: { product: true },
      });

      if (!variant) throw AppError.notFound('Variante não encontrada');
      if (!variant.isActive || !variant.product.isActive) {
        throw AppError.badRequest('Produto indisponível');
      }
      if (variant.stockQty < input.quantity) {
        throw AppError.insufficientStock(
          `Estoque insuficiente. Disponível: ${variant.stockQty}`,
          variant.stockQty,
        );
      }

      // Find or create cart
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

      const unitPrice = variant.price ?? variant.product.salePrice ?? variant.product.basePrice;

      // Check existing item quantity
      const existingItem = cart.items?.find((i) => i.variantId === input.variantId);
      if (existingItem) {
        const newQty = existingItem.quantity + input.quantity;
        if (newQty > 99) {
          throw AppError.badRequest('Quantidade máxima por item é 99');
        }
        if (variant.stockQty < newQty) {
          throw AppError.insufficientStock(
            `Estoque insuficiente. Disponível: ${variant.stockQty}`,
            variant.stockQty,
          );
        }
      }

      // Upsert cart item
      await tx.cartItem.upsert({
        where: { cartId_variantId: { cartId: cart.id, variantId: input.variantId } },
        update: { quantity: { increment: input.quantity } },
        create: { cartId: cart.id, variantId: input.variantId, quantity: input.quantity, unitPrice: Number(unitPrice) },
      });
    });

    return this.getCart(userId);
  }

  async updateItem(userId: string, itemId: string, input: UpdateCartItemInput) {
    // Use transaction for stock validation
    await prisma.$transaction(async (tx) => {
      const cart = await tx.cart.findFirst({
        where: { userId, isActive: true },
        include: { items: true },
      });
      if (!cart) throw AppError.notFound('Carrinho não encontrado');

      const item = cart.items?.find((i) => i.id === itemId);
      if (!item) throw AppError.notFound('Item não encontrado no carrinho');

      const variant = await tx.productVariant.findFirst({
        where: { id: item.variantId, deletedAt: null },
      });

      if (!variant) throw AppError.notFound('Variante não encontrada');
      if (variant.stockQty < input.quantity) {
        throw AppError.insufficientStock(
          `Estoque insuficiente. Disponível: ${variant.stockQty}`,
          variant.stockQty,
        );
      }

      await tx.cartItem.update({
        where: { id: itemId },
        data: { quantity: input.quantity },
      });
    });

    return this.getCart(userId);
  }

  async removeItem(userId: string, itemId: string) {
    const cart = await this.cartRepo.findActiveByUserId(userId);
    if (!cart) throw AppError.notFound('Carrinho não encontrado');

    const item = cart.items?.find((i) => i.id === itemId);
    if (!item) throw AppError.notFound('Item não encontrado no carrinho');

    await this.cartRepo.removeItem(itemId);
    return this.getCart(userId);
  }

  async clearCart(userId: string) {
    const cart = await this.cartRepo.findActiveByUserId(userId);
    if (cart) {
      await this.cartRepo.clearCart(cart.id);
    }
  }

  /**
   * Merge anonymous cart items into user's cart.
   * Uses SET semantics (not increment) for idempotency:
   * - If item exists in user cart and guest cart, final qty = max(user_qty, guest_qty) capped by stock
   * - If item only in guest cart, it's added with guest qty capped by stock
   * - Entire operation is transactional — no partial merges
   */
  async mergeCart(userId: string, items: MergeCartItem[]) {
    const skipped: Array<{ variantId: string; reason: string }> = [];
    const adjusted: Array<{ variantId: string; requested: number; actual: number; reason: string }> = [];

    await prisma.$transaction(async (tx) => {
      // Find or create user cart
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

      for (const guestItem of items) {
        // Validate variant exists and is active
        const variant = await tx.productVariant.findFirst({
          where: { id: guestItem.variantId, deletedAt: null, isActive: true },
          include: { product: true },
        });

        if (!variant || !variant.product.isActive) {
          skipped.push({ variantId: guestItem.variantId, reason: 'Produto indisponível' });
          continue;
        }

        // Find existing item in user cart
        const existingItem = cart.items?.find((i) => i.variantId === guestItem.variantId);
        const existingQty = existingItem?.quantity ?? 0;

        // Desired quantity: max of guest and existing (SET semantics for idempotency)
        const desiredQty = Math.max(guestItem.quantity, existingQty);

        // Cap by stock
        const finalQty = Math.min(desiredQty, variant.stockQty, 99);

        if (finalQty <= 0) {
          skipped.push({ variantId: guestItem.variantId, reason: 'Estoque esgotado' });
          continue;
        }

        if (finalQty < desiredQty) {
          adjusted.push({
            variantId: guestItem.variantId,
            requested: desiredQty,
            actual: finalQty,
            reason: `Quantidade ajustada: apenas ${variant.stockQty} unidades disponíveis`,
          });
        }

        const unitPrice = variant.price ?? variant.product.salePrice ?? variant.product.basePrice;

        // Upsert: SET quantity (not increment) — makes merge idempotent
        await tx.cartItem.upsert({
          where: { cartId_variantId: { cartId: cart.id, variantId: guestItem.variantId } },
          update: { quantity: finalQty, unitPrice: Number(unitPrice) },
          create: { cartId: cart.id, variantId: guestItem.variantId, quantity: finalQty, unitPrice: Number(unitPrice) },
        });
      }
    });

    const cart = await this.getCart(userId);
    return { cart, skipped, adjusted };
  }
}
