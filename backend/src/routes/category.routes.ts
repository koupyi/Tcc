import { Router } from 'express';
import { CategoryController } from '../controllers/category.controller';

const router = Router();
const controller = new CategoryController();

// Public routes
router.get('/', (req, res, next) => controller.list(req, res, next));
router.get('/slug/:slug', (req, res, next) => controller.getBySlug(req, res, next));

export default router;
