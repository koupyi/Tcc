import { Request, Response, NextFunction } from 'express';
import { AddressService } from '../services/address.service';
import { AuthenticatedRequest } from '../types';
import { sendSuccess, sendCreated } from '../utils/response';

const addressService = new AddressService();

export class AddressController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const addresses = await addressService.list(user.id);
      sendSuccess(res, addresses, 'Endereços listados');
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const address = await addressService.create(user.id, req.body);
      sendCreated(res, address, 'Endereço criado');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const address = await addressService.update(user.id, req.params.id, req.body);
      sendSuccess(res, address, 'Endereço atualizado');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      await addressService.delete(user.id, req.params.id);
      sendSuccess(res, null, 'Endereço removido');
    } catch (error) {
      next(error);
    }
  }
}
