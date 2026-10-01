import { Router } from 'express';
import authRoutes from './auth.routes';
import productRoutes from './product.routes';
import categoryRoutes from './category.routes';
import cartRoutes from './cart.routes';
import orderRoutes from './order.routes';
import paymentRoutes from './payment.routes';
import adminRoutes from './admin.routes';
import uploadRoutes from './upload.routes';
import passwordRoutes from './password.routes';
import addressRoutes from './address.routes';
import shippingRoutes from './shipping.routes';
import communityBuildRoutes from './communityBuild.routes';
import builderRoutes from './builder.routes';

export const router = Router();

// Mount routes
router.use('/auth', authRoutes);
router.use('/auth', passwordRoutes); // forgot/reset password under /auth
router.use('/products', productRoutes);
router.use('/categories', categoryRoutes);
router.use('/cart', cartRoutes);
router.use('/orders', orderRoutes);
router.use('/payments', paymentRoutes);
router.use('/admin', adminRoutes);
router.use('/uploads', uploadRoutes);
router.use('/addresses', addressRoutes);
router.use('/shipping', shippingRoutes);
router.use('/community-builds', communityBuildRoutes);
router.use('/builder', builderRoutes);
