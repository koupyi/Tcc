import { Request, Response, NextFunction } from 'express';
import { CommunityBuildService } from '../services/communityBuild.service';
import { AuthenticatedRequest } from '../types';
import { sendSuccess } from '../utils/response';

const service = new CommunityBuildService();

export class CommunityBuildController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = req.query.limit ? Math.min(50, Math.max(1, parseInt(String(req.query.limit), 10) || 12)) : undefined;
      const builds = await service.list(limit);
      sendSuccess(res, builds, 'Builds da comunidade listadas');
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const build = await service.getById(req.params.id);
      sendSuccess(res, build);
    } catch (error) {
      next(error);
    }
  }

  async like(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await service.like(req.params.id);
      sendSuccess(res, result, 'Build curtida');
    } catch (error) {
      next(error);
    }
  }

  async addToCart(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as AuthenticatedRequest).user.id;
      const result = await service.addToCart(userId, req.params.id);
      sendSuccess(res, result, 'Componentes disponíveis adicionados ao carrinho');
    } catch (error) {
      next(error);
    }
  }
}
