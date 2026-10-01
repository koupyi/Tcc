import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { sendSuccess } from '../utils/response';
import { AppError } from '../utils/AppError';

export class CategoryController {
  async list(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const categories = await prisma.category.findMany({
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          slug: true,
          parentId: true,
          _count: {
            select: { products: true },
          },
        },
      });

      sendSuccess(res, categories, 'Categorias listadas');
    } catch (error) {
      next(error);
    }
  }

  async getBySlug(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const category = await prisma.category.findFirst({
        where: { slug: req.params.slug },
        select: {
          id: true,
          name: true,
          slug: true,
          parentId: true,
          children: {
            select: { id: true, name: true, slug: true },
          },
          _count: {
            select: { products: true },
          },
        },
      });

      if (!category) {
        throw AppError.notFound('Categoria não encontrada');
      }

      sendSuccess(res, category);
    } catch (error) {
      next(error);
    }
  }
}
