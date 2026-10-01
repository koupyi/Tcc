import { Router, Request, Response, NextFunction } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate';
import { authRateLimiter } from '../middlewares/rateLimiter';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  changePasswordSchema,
} from '../validators/auth.validator';
import { prisma } from '../config/database';
import { sendSuccess, sendNoContent } from '../utils/response';
import { AuthenticatedRequest } from '../types';

const router = Router();
const controller = new AuthController();

// Public
router.post('/register', authRateLimiter, validate(registerSchema), (req, res, next) => controller.register(req, res, next));
router.post('/login', authRateLimiter, validate(loginSchema), (req, res, next) => controller.login(req, res, next));
router.post('/refresh', validate(refreshTokenSchema), (req, res, next) => controller.refresh(req, res, next));

// Protected
router.post('/logout', authenticate, (req, res, next) => controller.logout(req, res, next));
router.post('/change-password', authenticate, validate(changePasswordSchema), (req, res, next) => controller.changePassword(req, res, next));
router.get('/me', authenticate, (req, res, next) => controller.me(req, res, next));
router.patch('/me', authenticate, (req, res, next) => controller.updateProfile(req, res, next));

// ==========================================
// LGPD — Data Export
// ==========================================

router.get('/me/data-export', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.id;

    const [user, addresses, orders, carts] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true, phone: true, role: true, isEmailVerified: true, createdAt: true, updatedAt: true },
      }),
      prisma.address.findMany({
        where: { userId, deletedAt: null },
        select: { id: true, label: true, recipientName: true, street: true, number: true, complement: true, neighborhood: true, city: true, state: true, zipCode: true, country: true, isDefault: true, createdAt: true },
      }),
      prisma.order.findMany({
        where: { userId },
        select: { id: true, orderNumber: true, status: true, subtotal: true, shippingCost: true, total: true, createdAt: true, items: { select: { productName: true, variantName: true, quantity: true, unitPrice: true, total: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.cart.findMany({
        where: { userId, isActive: true },
        select: { id: true, isActive: true, createdAt: true, items: { select: { quantity: true, unitPrice: true } } },
      }),
    ]);

    sendSuccess(res, { user, addresses, orders, carts }, 'Dados exportados');
  } catch (error) {
    next(error);
  }
});

// ==========================================
// LGPD — Account Deletion / Anonymization
// ==========================================

router.delete('/me/account', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.id;

    await prisma.$transaction(async (tx) => {
      // Anonymize user data (preserve for order history integrity)
      await tx.user.update({
        where: { id: userId },
        data: {
          email: `deleted_${userId}@anonymized.local`,
          name: 'Usuário Removido',
          phone: null,
          avatarUrl: null,
          passwordHash: 'DELETED',
          isActive: false,
          deletedAt: new Date(),
        },
      });

      // Revoke all tokens
      await tx.refreshToken.deleteMany({ where: { userId } });

      // Anonymize addresses
      await tx.address.updateMany({
        where: { userId },
        data: { recipientName: 'Removido', street: 'Removido', number: null, complement: null, neighborhood: null, deletedAt: new Date() },
      });

      // Deactivate carts
      await tx.cart.updateMany({
        where: { userId, isActive: true },
        data: { isActive: false },
      });

      // Delete notification deliveries (non-essential)
      await tx.notificationDelivery.deleteMany({ where: { userId } });
    });

    sendNoContent(res);
  } catch (error) {
    next(error);
  }
});

export default router;
