import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ShippingService } from '../services/shipping.service';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate';
import { sendSuccess } from '../utils/response';
import { AppError } from '../utils/AppError';
import { prisma } from '../config/database';
import { AuthenticatedRequest } from '../types';

const router = Router();
const shippingService = new ShippingService();

const calculateShippingSchema = z.object({
  zipCode: z.string().regex(/^\d{5}-?\d{3}$/, 'CEP inválido'),
});

// Public: calculate shipping options (multiple)
router.post('/calculate', validate(calculateShippingSchema), (req: Request, res: Response, next: NextFunction) => {
  try {
    const options = shippingService.calculateOptions(req.body.zipCode);
    sendSuccess(res, options, 'Opções de frete calculadas');
  } catch (error) {
    next(error);
  }
});

// Authenticated: get shipping/tracking info for an order
router.get('/orders/:orderId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const orderId = req.params.orderId;

    // Find order with ownership check
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { shipment: { include: { address: true } } },
    });

    if (!order) throw AppError.notFound('Pedido não encontrado');
    if (order.userId !== user.id) throw AppError.forbidden('Acesso negado');

    if (!order.shipment) {
      throw AppError.notFound('Informações de envio não disponíveis');
    }

    sendSuccess(res, {
      id: order.shipment.id,
      status: order.shipment.status,
      carrier: order.shipment.carrier,
      serviceName: order.shipment.serviceName,
      serviceCode: order.shipment.serviceCode,
      trackingCode: order.shipment.trackingCode,
      shippingCost: order.shipment.shippingCost,
      shippedAt: order.shipment.shippedAt,
      deliveredAt: order.shipment.deliveredAt,
      createdAt: order.shipment.createdAt,
      updatedAt: order.shipment.updatedAt,
      address: order.shipment.address,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
