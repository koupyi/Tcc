import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { webhookRateLimiter } from '../middlewares/rateLimiter';
import { PaymentService } from '../services/payment.service';
import { sendSuccess } from '../utils/response';
import { AuthenticatedRequest } from '../types';
import { Request, Response, NextFunction } from 'express';

const router = Router();
const paymentService = new PaymentService();

// Create/get PIX payment for order (requires auth)
router.post('/:orderId/process', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const payment = await paymentService.createPayment(req.params.orderId, user.id);
    sendSuccess(res, payment, 'Pagamento criado');
  } catch (error) {
    next(error);
  }
});

// Get payment status for order (requires auth)
router.get('/:orderId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const payment = await paymentService.getPaymentByOrderId(req.params.orderId, user.id);
    sendSuccess(res, payment);
  } catch (error) {
    next(error);
  }
});

// Webhook (public - validated by signature/server-side verification)
router.post('/webhook', webhookRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await paymentService.handleWebhook(
      req.body,
      {
        xSignature: req.headers['x-signature'] as string | undefined,
        xRequestId: req.headers['x-request-id'] as string | undefined,
        rawSignature: req.headers['x-webhook-signature'] as string | undefined,
      },
      // Mercado Pago calls this endpoint as POST /webhook?data.id=...&type=...
      // — the signature manifest's data.id must come from here, not the body.
      { dataId: req.query['data.id'] as string | undefined },
    );
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
});

export default router;
