import { Router } from 'express';
import { CartController } from '../controllers/cart.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate';
import { addCartItemSchema, updateCartItemSchema, mergeCartSchema } from '../validators/cart.validator';

const router = Router();
const controller = new CartController();

// All cart operations require authentication
router.use(authenticate);

router.get('/', (req, res, next) => controller.get(req, res, next));
router.post('/items', validate(addCartItemSchema), (req, res, next) => controller.addItem(req, res, next));
router.post('/merge', validate(mergeCartSchema), (req, res, next) => controller.merge(req, res, next));
router.patch('/items/:itemId', validate(updateCartItemSchema), (req, res, next) => controller.updateItem(req, res, next));
router.delete('/items/:itemId', (req, res, next) => controller.removeItem(req, res, next));
router.delete('/', (req, res, next) => controller.clear(req, res, next));

export default router;
