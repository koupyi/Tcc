import { Request, Response, NextFunction } from 'express';
import { BuilderService } from '../services/builder.service';
import { AuthenticatedRequest } from '../types';
import { sendSuccess } from '../utils/response';

const service = new BuilderService();

export class BuilderController {
  async getOptions(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await service.getOptions();
      sendSuccess(res, result, 'Opções do builder listadas');
    } catch (error) {
      next(error);
    }
  }

  async validate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await service.validateConfiguration(req.body);
      sendSuccess(res, result, 'Configuração validada');
    } catch (error) {
      next(error);
    }
  }

  async addToCart(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as AuthenticatedRequest).user.id;
      const result = await service.addToCart(userId, req.body);
      sendSuccess(res, result, 'Configuração adicionada ao carrinho');
    } catch (error) {
      next(error);
    }
  }
}
