import { Router } from 'express';
import { CommunityBuildController } from '../controllers/communityBuild.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();
const controller = new CommunityBuildController();

// Public — anyone (including guests) can browse and inspect builds
router.get('/', (req, res, next) => controller.list(req, res, next));
router.get('/:id', (req, res, next) => controller.getById(req, res, next));
router.post('/:id/like', (req, res, next) => controller.like(req, res, next));

// Auth only — server cart bulk-add (guests add available components client-side
// to the local anonymous cart instead, same as the rest of the catalog)
router.post('/:id/add-to-cart', authenticate, (req, res, next) => controller.addToCart(req, res, next));

export default router;
