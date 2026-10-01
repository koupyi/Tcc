import { Router } from 'express';
import { ProductController } from '../controllers/product.controller';
import { authenticate, isAdmin } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate';
import {
  createProductSchema,
  updateProductSchema,
  createVariantSchema,
  updateVariantSchema,
  productQuerySchema,
} from '../validators/product.validator';

const router = Router();
const controller = new ProductController();

// Public
router.get('/', validate(productQuerySchema, 'query'), (req, res, next) => controller.list(req, res, next));
router.get('/best-sellers', (req, res, next) => controller.bestSellers(req, res, next));
router.get('/slug/:slug', (req, res, next) => controller.getBySlug(req, res, next));
router.get('/:id', (req, res, next) => controller.getById(req, res, next));

// Admin only
router.post('/', authenticate, isAdmin, validate(createProductSchema), (req, res, next) => controller.create(req, res, next));
router.patch('/:id', authenticate, isAdmin, validate(updateProductSchema), (req, res, next) => controller.update(req, res, next));
router.delete('/:id', authenticate, isAdmin, (req, res, next) => controller.delete(req, res, next));

// Variants (admin)
router.post('/:id/variants', authenticate, isAdmin, validate(createVariantSchema), (req, res, next) => controller.createVariant(req, res, next));
router.patch('/variants/:variantId', authenticate, isAdmin, validate(updateVariantSchema), (req, res, next) => controller.updateVariant(req, res, next));
router.patch('/variants/:variantId/stock', authenticate, isAdmin, (req, res, next) => controller.updateStock(req, res, next));

export default router;
