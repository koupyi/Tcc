import { Router } from 'express';
import { authRateLimiter } from '../middlewares/rateLimiter';
import {
  forgotPasswordController,
  resetPasswordController,
} from '../modules/auth/auth.controller';

const router = Router();

router.post('/forgot-password', authRateLimiter, forgotPasswordController);
router.post('/reset-password', authRateLimiter, resetPasswordController);

export default router;
