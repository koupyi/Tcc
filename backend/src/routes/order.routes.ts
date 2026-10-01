import { Router } from 'express';
import { authenticate, isAdmin } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate';
import { OrderService } from '../services/order.service';
import { createOrderSchema, updateOrderStatusSchema, orderQuerySchema } from '../validators/order.validator';
import { sendSuccess, sendCreated } from '../utils/response';
import { AuthenticatedRequest } from '../types';
import { Request, Response, NextFunction } from 'express';

const router = Router();
const orderService = new OrderService();

// All order operations require authentication
router.use(authenticate);

// Customer routes
router.post('/', validate(createOrderSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const order = await orderService.createOrder(user.id, req.body);
    sendCreated(res, order, 'Pedido criado com sucesso');
  } catch (error) {
    next(error);
  }
});

router.get('/my', validate(orderQuerySchema, 'query'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const result = await orderService.getMyOrders(user.id, req.query as never);
    sendSuccess(res, result.data, 'Pedidos listados', 200, result.meta as unknown as Record<string, unknown>);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const order = await orderService.getOrderById(req.params.id, user.id);
    sendSuccess(res, order);
  } catch (error) {
    next(error);
  }
});

// Admin routes
router.get('/', isAdmin, validate(orderQuerySchema, 'query'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await orderService.listAllOrders(req.query as never);
    sendSuccess(res, result.data, 'Pedidos listados', 200, result.meta as unknown as Record<string, unknown>);
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/status', isAdmin, validate(updateOrderStatusSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const admin = (req as AuthenticatedRequest).user;
    const order = await orderService.updateStatus(req.params.id, req.body, admin.id);
    sendSuccess(res, order, 'Status atualizado');
  } catch (error) {
    next(error);
  }
});

export default router;
