import { Router } from 'express';
import { authenticate, isAdmin, isSuperAdmin } from '../middlewares/auth.middleware';
import { AdminService } from '../services/admin.service';
import { OrderService } from '../services/order.service';
import { OrderRepository } from '../repositories/order.repository';
import { sendSuccess, sendCreated, sendNoContent } from '../utils/response';
import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import { generateSlug } from '../utils/slug';
import { z } from 'zod';
import { validate } from '../middlewares/validate';
import { updateOrderStatusSchema, orderQuerySchema } from '../validators/order.validator';
import { parsePagination, buildPaginatedResult } from '../utils/pagination';

const router = Router();
const adminService = new AdminService();
const orderService = new OrderService();
const orderRepo = new OrderRepository();

// All admin routes require auth + admin role
router.use(authenticate);
router.use(isAdmin);

// ==========================================
// DASHBOARD
// ==========================================

router.get('/dashboard', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await adminService.getDashboardStats();
    sendSuccess(res, stats);
  } catch (error) {
    next(error);
  }
});

// ==========================================
// ORDERS (admin — full visibility, any owner)
// ==========================================

// List all orders (paginated, filterable by status/date). Reuses the same
// service the customer's /orders (isAdmin) route uses, but under /admin/orders
// so the admin UI has a dedicated, clearly-scoped endpoint.
router.get('/orders', validate(orderQuerySchema, 'query'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await orderService.listAllOrders(req.query as never);
    sendSuccess(res, result.data, 'Pedidos listados', 200, result.meta as unknown as Record<string, unknown>);
  } catch (error) {
    next(error);
  }
});

// Full detail of ANY order (admin bypasses ownership). The customer route
// GET /orders/:id remains owner-only — this endpoint does NOT relax that.
router.get('/orders/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const order = await orderRepo.findById(req.params.id);
    if (!order) throw AppError.notFound('Pedido não encontrado');
    sendSuccess(res, order);
  } catch (error) {
    next(error);
  }
});

// Change order status (respects the backend state machine in OrderService.updateStatus).
router.patch('/orders/:id/status', validate(updateOrderStatusSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const admin = (req as AuthenticatedRequest).user;
    const order = await orderService.updateStatus(req.params.id, req.body, admin.id);
    sendSuccess(res, order, 'Status atualizado');
  } catch (error) {
    next(error);
  }
});

// ==========================================
// USERS
// ==========================================

router.get('/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await adminService.listUsers(req.query as never);
    sendSuccess(res, result.data, 'Usuários listados', 200, result.meta as unknown as Record<string, unknown>);
  } catch (error) {
    next(error);
  }
});

router.patch('/users/:id/role', isSuperAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const admin = (req as AuthenticatedRequest).user;
    const user = await adminService.updateUserRole(req.params.id, req.body.role, admin.id);
    sendSuccess(res, user, 'Role atualizada');
  } catch (error) {
    next(error);
  }
});

router.patch('/users/:id/deactivate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const admin = (req as AuthenticatedRequest).user;
    await adminService.deactivateUser(req.params.id, admin.id);
    sendSuccess(res, null, 'Usuário desativado');
  } catch (error) {
    next(error);
  }
});

// ==========================================
// AUDIT LOGS
// ==========================================

router.get('/audit-logs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await adminService.getAuditLogs(req.query as never);
    sendSuccess(res, result.data, 'Audit logs', 200, result.meta as unknown as Record<string, unknown>);
  } catch (error) {
    next(error);
  }
});

// ==========================================
// REVENUE
// ==========================================

router.get('/revenue', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { dateFrom, dateTo } = req.query as { dateFrom?: string; dateTo?: string };
    const report = await adminService.getRevenueReport(dateFrom, dateTo);
    sendSuccess(res, report);
  } catch (error) {
    next(error);
  }
});

// ==========================================
// CATEGORIES CRUD
// ==========================================

const categorySchema = z.object({
  name: z.string().min(1).max(100).trim(),
  slug: z.string().min(1).max(100).trim().optional(),
  parentId: z.string().uuid().optional().nullable(),
});

router.get('/categories', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } }, parent: { select: { id: true, name: true } } },
    });
    sendSuccess(res, categories);
  } catch (error) { next(error); }
});

router.get('/categories/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const category = await prisma.category.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { products: true } }, children: true, parent: true },
    });
    if (!category) throw AppError.notFound('Categoria não encontrada');
    sendSuccess(res, category);
  } catch (error) { next(error); }
});

router.post('/categories', validate(categorySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, slug, parentId } = req.body;
    const finalSlug = slug || generateSlug(name);
    const existing = await prisma.category.findFirst({ where: { slug: finalSlug } });
    if (existing) throw AppError.conflict('Slug já existe');
    const category = await prisma.category.create({ data: { name, slug: finalSlug, parentId: parentId || null } });
    sendCreated(res, category, 'Categoria criada');
  } catch (error) { next(error); }
});

router.patch('/categories/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cat = await prisma.category.findUnique({ where: { id: req.params.id } });
    if (!cat) throw AppError.notFound('Categoria não encontrada');
    const { name, slug, parentId } = req.body;
    if (slug && slug !== cat.slug) {
      const dup = await prisma.category.findFirst({ where: { slug, id: { not: cat.id } } });
      if (dup) throw AppError.conflict('Slug já existe');
    }
    const updated = await prisma.category.update({ where: { id: req.params.id }, data: { ...(name && { name }), ...(slug && { slug }), ...(parentId !== undefined && { parentId: parentId || null }) } });
    sendSuccess(res, updated, 'Categoria atualizada');
  } catch (error) { next(error); }
});

router.delete('/categories/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cat = await prisma.category.findUnique({ where: { id: req.params.id }, include: { _count: { select: { products: true } } } });
    if (!cat) throw AppError.notFound('Categoria não encontrada');
    if (cat._count.products > 0) throw AppError.badRequest('Categoria possui produtos associados. Remova-os primeiro.');
    await prisma.category.delete({ where: { id: req.params.id } });
    sendNoContent(res);
  } catch (error) { next(error); }
});

// ==========================================
// INVENTORY
// ==========================================

router.get('/inventory', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, search, lowStock } = req.query as { page?: string; limit?: string; search?: string; lowStock?: string };
    const pagination = parsePagination(page, limit);
    const where: Record<string, unknown> = { deletedAt: null, isActive: true };
    if (search) { where.OR = [{ name: { contains: search } }, { sku: { contains: search } }]; }
    if (lowStock === 'true') { where.stockQty = { lte: 5 }; }
    const [variants, total] = await prisma.$transaction([
      prisma.productVariant.findMany({ where, skip: pagination.skip, take: pagination.limit, orderBy: { stockQty: 'asc' }, include: { product: { select: { id: true, name: true, slug: true } } } }),
      prisma.productVariant.count({ where }),
    ]);
    sendSuccess(res, buildPaginatedResult(variants, total, pagination).data, 'Inventário', 200, buildPaginatedResult(variants, total, pagination).meta as unknown as Record<string, unknown>);
  } catch (error) { next(error); }
});

router.patch('/inventory/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { stockQty } = req.body;
    if (typeof stockQty !== 'number' || stockQty < 0 || !Number.isInteger(stockQty)) {
      throw AppError.badRequest('Quantidade de estoque deve ser um inteiro >= 0');
    }
    const variant = await prisma.productVariant.findFirst({ where: { id: req.params.id, deletedAt: null } });
    if (!variant) throw AppError.notFound('Variante não encontrada');
    const updated = await prisma.productVariant.update({ where: { id: req.params.id }, data: { stockQty } });
    sendSuccess(res, updated, 'Estoque atualizado');
  } catch (error) { next(error); }
});

// ==========================================
// PAYMENTS (read-only admin)
// ==========================================

router.get('/payments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, status, orderId } = req.query as { page?: string; limit?: string; status?: string; orderId?: string };
    const pagination = parsePagination(page, limit);
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (orderId) where.orderId = orderId;
    const [payments, total] = await prisma.$transaction([
      prisma.payment.findMany({ where, skip: pagination.skip, take: pagination.limit, orderBy: { createdAt: 'desc' }, include: { order: { select: { id: true, orderNumber: true, userId: true } } } }),
      prisma.payment.count({ where }),
    ]);
    sendSuccess(res, buildPaginatedResult(payments, total, pagination).data, 'Pagamentos', 200, buildPaginatedResult(payments, total, pagination).meta as unknown as Record<string, unknown>);
  } catch (error) { next(error); }
});

router.get('/payments/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payment = await prisma.payment.findUnique({ where: { id: req.params.id }, include: { order: true } });
    if (!payment) throw AppError.notFound('Pagamento não encontrado');
    sendSuccess(res, payment);
  } catch (error) { next(error); }
});

// ==========================================
// SHIPMENTS
// ==========================================

router.get('/shipments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, status, orderId } = req.query as { page?: string; limit?: string; status?: string; orderId?: string };
    const pagination = parsePagination(page, limit);
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (orderId) where.orderId = orderId;
    const [shipments, total] = await prisma.$transaction([
      prisma.shipment.findMany({ where, skip: pagination.skip, take: pagination.limit, orderBy: { createdAt: 'desc' }, include: { order: { select: { id: true, orderNumber: true } }, address: true } }),
      prisma.shipment.count({ where }),
    ]);
    sendSuccess(res, buildPaginatedResult(shipments, total, pagination).data, 'Shipments', 200, buildPaginatedResult(shipments, total, pagination).meta as unknown as Record<string, unknown>);
  } catch (error) { next(error); }
});

router.get('/shipments/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shipment = await prisma.shipment.findUnique({ where: { id: req.params.id }, include: { order: { include: { user: { select: { id: true, name: true, email: true } } } }, address: true } });
    if (!shipment) throw AppError.notFound('Shipment não encontrado');
    sendSuccess(res, shipment);
  } catch (error) { next(error); }
});

router.patch('/shipments/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body;
    const validStatuses = ['PENDING', 'PROCESSING', 'SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'CANCELLED'];
    if (!status || !validStatuses.includes(status)) {
      throw AppError.badRequest(`Status inválido. Valores aceitos: ${validStatuses.join(', ')}`);
    }
    const shipment = await prisma.shipment.findUnique({ where: { id: req.params.id } });
    if (!shipment) throw AppError.notFound('Shipment não encontrado');
    const updated = await prisma.shipment.update({ where: { id: req.params.id }, data: { status, ...(status === 'SHIPPED' ? { shippedAt: new Date() } : {}), ...(status === 'DELIVERED' ? { deliveredAt: new Date() } : {}) } });
    sendSuccess(res, updated, 'Status atualizado');
  } catch (error) { next(error); }
});

export default router;
