import { Router } from 'express';
import { authenticate, isAdmin } from '../middlewares/auth.middleware';
import { uploadProductImages } from '../middlewares/upload.middleware';
import { uploadRateLimiter } from '../middlewares/rateLimiter';
import { UploadService } from '../services/upload.service';
import { sendSuccess, sendNoContent } from '../utils/response';
import { Request, Response, NextFunction } from 'express';

const router = Router();
const uploadService = new UploadService();

// All upload routes require auth + admin
router.use(authenticate);
router.use(isAdmin);
router.use(uploadRateLimiter);

// Product images
router.post(
  '/products/:productId',
  uploadProductImages.array('images', 10),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const files = req.files as Express.Multer.File[];
      const images = await uploadService.attachImagesToProduct(req.params.productId, files);
      sendSuccess(res, images, 'Imagens adicionadas');
    } catch (error) {
      next(error);
    }
  },
);

// Variant images
router.post(
  '/variants/:variantId',
  uploadProductImages.array('images', 10),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const files = req.files as Express.Multer.File[];
      const images = await uploadService.attachImagesToVariant(req.params.variantId, files);
      sendSuccess(res, images, 'Imagens adicionadas');
    } catch (error) {
      next(error);
    }
  },
);

// Delete image
router.delete('/:imageId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await uploadService.deleteImage(req.params.imageId);
    sendNoContent(res);
  } catch (error) {
    next(error);
  }
});

// Reorder images
router.patch('/reorder', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await uploadService.reorderImages(req.body.imageIds);
    sendSuccess(res, null, 'Imagens reordenadas');
  } catch (error) {
    next(error);
  }
});

export default router;
