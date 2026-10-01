import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { AuthenticatedRequest } from '../types';
import { AppError } from '../utils/AppError';
import { sendSuccess, sendCreated } from '../utils/response';

const authService = new AuthService();

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.register(
        req.body,
        req.ip,
        req.get('User-Agent'),
      );
      sendCreated(res, result, 'Conta criada com sucesso');
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.login(
        req.body,
        req.ip,
        req.get('User-Agent'),
      );
      sendSuccess(res, result, 'Login realizado com sucesso');
    } catch (error) {
      next(error);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;
      const result = await authService.refreshTokens(
        refreshToken,
        req.ip,
        req.get('User-Agent'),
      );
      sendSuccess(res, result, 'Tokens renovados com sucesso');
    } catch (error) {
      next(error);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const { refreshToken } = req.body;
      await authService.logout(user.id, refreshToken);
      sendSuccess(res, null, 'Logout realizado com sucesso');
    } catch (error) {
      next(error);
    }
  }

  async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const { currentPassword, newPassword } = req.body;
      await authService.changePassword(user.id, currentPassword, newPassword);
      sendSuccess(res, null, 'Senha alterada com sucesso');
    } catch (error) {
      next(error);
    }
  }

  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authUser = (req as AuthenticatedRequest).user;
      const { prisma } = await import('../config/database');
      const user = await prisma.user.findUnique({
        where: { id: authUser.id },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          avatarUrl: true,
          isEmailVerified: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      if (!user) {
        next(AppError.notFound('Usuário não encontrado'));
        return;
      }
      sendSuccess(res, { user });
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authUser = (req as AuthenticatedRequest).user;
      const { prisma } = await import('../config/database');

      // Allowlist: only permit safe fields
      const { name, email, phone } = req.body;
      const updateData: Record<string, unknown> = {};

      if (name !== undefined) updateData.name = String(name).trim();
      if (phone !== undefined) updateData.phone = phone ? String(phone).trim() : null;

      if (email !== undefined) {
        const normalizedEmail = String(email).toLowerCase().trim();
        if (normalizedEmail !== authUser.email) {
          // Check uniqueness
          const existing = await prisma.user.findFirst({
            where: { email: normalizedEmail, id: { not: authUser.id }, deletedAt: null },
          });
          if (existing) {
            next(AppError.conflict('Email já cadastrado'));
            return;
          }
          updateData.email = normalizedEmail;
        }
      }

      if (Object.keys(updateData).length === 0) {
        next(AppError.badRequest('Nenhum campo para atualizar'));
        return;
      }

      const user = await prisma.user.update({
        where: { id: authUser.id },
        data: updateData,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          avatarUrl: true,
          isEmailVerified: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      sendSuccess(res, { user }, 'Perfil atualizado com sucesso');
    } catch (error) {
      next(error);
    }
  }
}