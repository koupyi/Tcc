import { Router } from 'express';
import { BuilderController } from '../controllers/builder.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate';
import { builderConfigurationSchema } from '../validators/builder.validator';

const router = Router();
const controller = new BuilderController();

// Public — reads the real catalog, filtered/shaped for the builder.
router.get('/options', (req, res, next) => controller.getOptions(req, res, next));

// Public — guests validate before adding to their local cart too.
router.post('/validate', validate(builderConfigurationSchema), (req, res, next) => controller.validate(req, res, next));

// Auth only — atomic server-cart add.
router.post('/add-to-cart', authenticate, validate(builderConfigurationSchema), (req, res, next) => controller.addToCart(req, res, next));

export default router;
