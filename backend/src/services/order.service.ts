import * as crypto from 'crypto';
import { OrderStatus, PaymentStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { OrderRepository } from '../repositories/order.repository';
import { CartRepository } from '../repositories/cart.repository';
import { AuditRepository } from '../repositories/audit.repository';
import { ShippingService } from './shipping.service';
import { AppError } from '../utils/AppError';
import { generateOrderNumber } from '../utils/slug';
import { parsePagination, buildPaginatedResult } from '../utils/pagination';
import { logPayment, logAdmin } from '../config/logger';
import { CreateOrderInput, OrderQueryInput, UpdateOrderStatusInput } from '../validators/order.validator';

export class OrderService {
  private orderRepo = new OrderRepository();
  private cartRepo = new CartRepository();
  private auditRepo = new AuditRepository();
  private shippingService = new ShippingService();

  async createOrder(userId: string, input: CreateOrderInput) {
    // Proteção contra pedido duplicado (mesmo user, PENDING, < 5 min)
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentOrder = await prisma.order.findFirst({
      where: {
        userId,
        status: OrderStatus.PENDING,
        createdAt: { gte: fiveMinAgo },
      },
      include: { items: true, payment: true, shipment: true },
    });
    if (recentOrder) {
      return recentOrder; // Retorna pedido existente ao invés de duplicar
    }

    // Carrega carrinho
    const cart = await this.cartRepo.findActiveByUserId(userId);
    if (!cart || !cart.items.length) {
      throw AppError.badRequest('Carrinho vazio');
    }

    // Valida endereço
    const address = await prisma.address.findFirst({
      where: { id: input.addressId, userId, deletedAt: null },
    });
    if (!address) throw AppError.notFound('Endereço não encontrado');

    // Calculate shipping based on address zip code and chosen option
    const shippingOptionCode = input.shippingOptionCode || 'ECONOMICO';
    const shippingOption = this.shippingService.validateOption(address.zipCode, shippingOptionCode);
    if (!shippingOption) {
      // Fallback to cheapest option if code is invalid
      const fallback = this.shippingService.calculate(address.zipCode);
      var shippingCost = fallback.price;
      var shippingCarrier = 'KeyCaps Express';
      var shippingServiceName = fallback.name;
      var shippingServiceCode = 'ECONOMICO';
    } else {
      var shippingCost = shippingOption.price;
      var shippingCarrier = shippingOption.carrier;
      var shippingServiceName = shippingOption.name;
      var shippingServiceCode = shippingOption.code;
    }

    // Cria pedido em transação com SELECT FOR UPDATE para concorrência
    const order = await prisma.$transaction(async (tx) => {
      // Lock and validate stock for each item INSIDE the transaction
      const orderItems: Array<{
        variantId: string;
        productId: string;
        productName: string;
        variantName: string;
        sku: string;
        quantity: number;
        unitPrice: number;
        total: number;
      }> = [];

      for (const item of cart.items) {
        // SELECT FOR UPDATE — locks the row until transaction completes
        const lockedVariants = await tx.$queryRaw<Array<{
          id: string;
          productId: string;
          name: string;
          sku: string;
          price: string | null;
          stockQty: number;
          isActive: boolean;
        }>>`
          SELECT id, "productId", name, sku, price::text, "stockQty", "isActive"
          FROM product_variants
          WHERE id = ${item.variantId}
            AND "deletedAt" IS NULL
          FOR UPDATE
        `;

        const variant = lockedVariants[0];
        if (!variant || !variant.isActive) {
          throw AppError.badRequest(`Variante "${item.variant.name}" indisponível`);
        }

        if (variant.stockQty < item.quantity) {
          throw AppError.insufficientStock(
            `Estoque insuficiente para "${variant.name}". Disponível: ${variant.stockQty}`,
            variant.stockQty,
          );
        }

        // Get product info for order snapshot
        const product = await tx.product.findUnique({
          where: { id: variant.productId },
        });

        if (!product) {
          throw AppError.badRequest(`Produto não encontrado para variante "${variant.name}"`);
        }

        const unitPrice = variant.price
          ? Number(variant.price)
          : (product.salePrice ? Number(product.salePrice) : Number(product.basePrice));

        orderItems.push({
          variantId: variant.id,
          productId: variant.productId,
          productName: product.name,
          variantName: variant.name,
          sku: variant.sku,
          quantity: item.quantity,
          unitPrice,
          total: unitPrice * item.quantity,
        });
      }

      const subtotal = orderItems.reduce((sum, i) => sum + i.total, 0);
      const total = subtotal + shippingCost;

      const newOrder = await tx.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          userId,
          status: OrderStatus.PENDING,
          subtotal,
          shippingCost,
          total,
          notes: input.notes,
          items: {
            create: orderItems.map((i) => ({
              productId: i.productId,
              variantId: i.variantId,
              productName: i.productName,
              variantName: i.variantName,
              sku: i.sku,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              total: i.total,
            })),
          },
          payment: {
            create: {
              method: input.paymentMethod,
              status: PaymentStatus.PENDING,
              amount: total,
              currency: 'BRL',
              // Generated once, here, at the same moment the Payment row itself
              // is created — PaymentService.createPayment() reuses this same
              // key for every retry of the first payment attempt on this order.
              idempotencyKey: crypto.randomUUID(),
            },
          },
          shipment: {
            create: {
              addressId: input.addressId,
              status: 'PENDING',
              carrier: shippingCarrier,
              serviceName: shippingServiceName,
              serviceCode: shippingServiceCode,
              shippingCost,
              // Frozen at creation time — the live Address can be edited or
              // deleted later without rewriting what this order actually shipped to.
              snapshotRecipientName: address.recipientName,
              snapshotStreet: address.street,
              snapshotNumber: address.number,
              snapshotComplement: address.complement,
              snapshotNeighborhood: address.neighborhood,
              snapshotCity: address.city,
              snapshotState: address.state,
              snapshotZipCode: address.zipCode,
            },
          },
        },
        include: {
          items: true,
          payment: true,
          shipment: true,
        },
      });

      // Decrementa estoque atomicamente com check condicional
      for (const item of orderItems) {
        // Use conditional update: only decrement if stockQty >= quantity
        const updateResult = await tx.$executeRaw`
          UPDATE product_variants
          SET "stockQty" = "stockQty" - ${item.quantity},
              "updatedAt" = NOW()
          WHERE id = ${item.variantId}
            AND "stockQty" >= ${item.quantity}
        `;

        if (updateResult === 0) {
          // This should not happen due to FOR UPDATE lock, but is a safety net
          throw AppError.insufficientStock(
            `Estoque insuficiente para "${item.variantName}" (race condition detectada)`,
            0,
          );
        }

        // Get updated stock values for log
        const updatedVariant = await tx.productVariant.findUnique({
          where: { id: item.variantId },
        });

        await tx.stockLog.create({
          data: {
            variantId: item.variantId,
            previousQty: updatedVariant!.stockQty + item.quantity,
            newQty: updatedVariant!.stockQty,
            changeQty: -item.quantity,
            reason: 'Pedido criado',
            reference: newOrder.id,
          },
        });
      }

      // Desativa carrinho
      await tx.cart.update({
        where: { id: cart.id },
        data: { isActive: false },
      });

      return newOrder;
    });

    await this.auditRepo.create({
      actorId: userId,
      userId,
      action: 'CREATE',
      resource: 'Order',
      resourceId: order.id,
      newData: { orderNumber: order.orderNumber, total: order.total, paymentMethod: input.paymentMethod },
    });

    logPayment('ORDER_CREATED', order.id, {
      userId,
      total: order.total,
      method: input.paymentMethod,
    });

    // Enqueue order notification (async)
    try {
      const { enqueueNotification } = require('../jobs');
      enqueueNotification({ eventType: 'order_created', entityId: order.id, userId });
    } catch { /* Jobs may not be available */ }

    return order;
  }

  async getMyOrders(userId: string, query: OrderQueryInput) {
    const pagination = parsePagination(query.page, query.limit);
    const { orders, total } = await this.orderRepo.findMany({
      skip: pagination.skip,
      take: pagination.limit,
      filters: {
        userId,
        status: query.status,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
      },
    });
    return buildPaginatedResult(orders, total, pagination);
  }

  async getOrderById(orderId: string, userId: string, isAdmin = false) {
    const order = await this.orderRepo.findById(orderId);
    if (!order) throw AppError.notFound('Pedido não encontrado');

    if (!isAdmin && order.userId !== userId) {
      throw AppError.forbidden('Acesso negado');
    }

    return order;
  }

  async updateStatus(orderId: string, input: UpdateOrderStatusInput, adminId: string) {
    const order = await this.orderRepo.findById(orderId);
    if (!order) throw AppError.notFound('Pedido não encontrado');

    // Valida transição de status
    const validTransitions: Partial<Record<OrderStatus, OrderStatus[]>> = {
      [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
      [OrderStatus.CONFIRMED]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
      [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
      [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
      [OrderStatus.DELIVERED]: [OrderStatus.REFUNDED],
    };

    const allowed = validTransitions[order.status] ?? [];
    if (!allowed.includes(input.status)) {
      throw AppError.badRequest(
        `Transição de status inválida: ${order.status} → ${input.status}`,
      );
    }

    const updated = await this.orderRepo.updateStatus(
      orderId,
      input.status,
      input.cancelReason,
    );

    // Devolver estoque se cancelado
    if (input.status === OrderStatus.CANCELLED) {
      for (const item of order.items) {
        await prisma.productVariant.update({
          where: { id: item.variantId },
          data: { stockQty: { increment: item.quantity } },
        });
      }
    }

    await this.auditRepo.create({
      actorId: adminId,
      userId: order.userId,
      action: 'ORDER_STATUS_CHANGE',
      resource: 'Order',
      resourceId: orderId,
      oldData: { status: order.status },
      newData: { status: input.status },
    });

    logAdmin('ORDER_STATUS_CHANGED', adminId, {
      orderId,
      from: order.status,
      to: input.status,
    });

    return updated;
  }

  // Admin: listar todos os pedidos
  async listAllOrders(query: OrderQueryInput) {
    const pagination = parsePagination(query.page, query.limit);
    const { orders, total } = await this.orderRepo.findMany({
      skip: pagination.skip,
      take: pagination.limit,
      filters: {
        status: query.status,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
      },
    });
    return buildPaginatedResult(orders, total, pagination);
  }
}