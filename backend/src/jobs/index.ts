/**
 * Jobs infrastructure — BullMQ queues, workers, processors.
 * Lazy initialization: queues/workers only start when startWorkers() is called.
 */
import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { prisma } from '../config/database';
import { getMailProvider } from './mail.provider';

// ==========================================
// Job Types
// ==========================================

export interface NotificationJobData {
  eventType: 'welcome' | 'order_created' | 'payment_approved' | 'payment_failed' | 'shipment_created';
  entityId: string;
  userId: string;
  eventId: string;
}

// ==========================================
// Lazy-initialized infrastructure
// ==========================================

let connection: IORedis | null = null;
let notificationQueue: Queue<NotificationJobData> | null = null;
let cartCleanupQueue: Queue | null = null;
let paymentReconciliationQueue: Queue | null = null;
let notificationWorker: Worker | null = null;
let cartCleanupWorker: Worker | null = null;
let paymentReconciliationWorker: Worker | null = null;
let initialized = false;

function getConnection(): IORedis {
  if (!connection) {
    connection = new IORedis({
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD || undefined,
      db: env.REDIS_DB,
      maxRetriesPerRequest: null,
      enableOfflineQueue: false,
      lazyConnect: true,
    });
    connection.on('error', (err) => {
      logger.error('[BullMQ Redis] Error', { message: err.message });
    });
  }
  return connection;
}

function getNotificationQueue(): Queue<NotificationJobData> {
  if (!notificationQueue) {
    notificationQueue = new Queue('notifications', {
      connection: getConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
      },
    });
  }
  return notificationQueue;
}

// ==========================================
// Start Workers (called from server.ts)
// ==========================================

export function startWorkers(): void {
  if (initialized) return;
  initialized = true;

  const conn = getConnection();

  // Notification worker
  notificationWorker = new Worker<NotificationJobData>('notifications', async (job: Job<NotificationJobData>) => {
    const { eventType, entityId, userId, eventId } = job.data;
    const startTime = Date.now();

    logger.info('[JOB_STARTED]', { jobId: job.id, queue: 'notifications', jobType: eventType, entityId, attempt: job.attemptsMade + 1 });

    // Idempotency check
    const existing = await prisma.notificationDelivery.findUnique({ where: { eventId } });
    if (existing && existing.status === 'SENT') {
      logger.info('[JOB_IDEMPOTENT]', { jobId: job.id, eventId });
      return;
    }

    const delivery = await prisma.notificationDelivery.upsert({
      where: { eventId },
      create: { eventId, type: eventType, entityId, userId, status: 'PROCESSING', attempts: 1 },
      update: { status: 'PROCESSING', attempts: { increment: 1 } },
    });

    try {
      await processNotification(eventType, entityId, userId);

      await prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: { status: 'SENT', sentAt: new Date(), lastError: null },
      });

      logger.info('[JOB_COMPLETED]', { jobId: job.id, jobType: eventType, entityId, duration: Date.now() - startTime });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      await prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: { status: 'FAILED', lastError: errMsg },
      });
      logger.error('[JOB_RETRY]', { jobId: job.id, jobType: eventType, entityId, attempt: job.attemptsMade + 1, error: errMsg });
      throw error;
    }
  }, { connection: conn, concurrency: 3 });

  notificationWorker.on('failed', (job, err) => {
    if (job) {
      logger.error('[JOB_FAILED]', { jobId: job.id, jobType: job.data.eventType, entityId: job.data.entityId, attempts: job.attemptsMade, error: err.message });
    }
  });

  // Cart cleanup worker
  cartCleanupQueue = new Queue('cart-cleanup', {
    connection: conn,
    defaultJobOptions: { attempts: 2, removeOnComplete: { count: 10 }, removeOnFail: { count: 50 } },
  });

  cartCleanupWorker = new Worker('cart-cleanup', async (job: Job) => {
    logger.info('[JOB_STARTED]', { jobId: job.id, queue: 'cart-cleanup', jobType: 'cleanup' });
    const now = new Date();
    const result = await prisma.cart.updateMany({
      where: { isActive: true, expiresAt: { lt: now } },
      data: { isActive: false },
    });
    logger.info('[JOB_COMPLETED]', { jobId: job.id, queue: 'cart-cleanup', deactivated: result.count });
  }, { connection: conn, concurrency: 1 });

  // Payment reconciliation worker — recovers PENDING payments stuck in an
  // intermediate state (provider timeout, missed webhook) by re-querying
  // Mercado Pago directly. Never called for FakePaymentProvider/Sandbox in
  // tests, only relevant once a real provider is configured.
  paymentReconciliationQueue = new Queue('payment-reconciliation', {
    connection: conn,
    defaultJobOptions: { attempts: 2, removeOnComplete: { count: 20 }, removeOnFail: { count: 50 } },
  });

  paymentReconciliationWorker = new Worker('payment-reconciliation', async (job: Job) => {
    logger.info('[JOB_STARTED]', { jobId: job.id, queue: 'payment-reconciliation', jobType: 'reconcile' });
    // Lazy import — avoids a top-level cycle with services that lazily require('../jobs').
    const { PaymentService } = require('../services/payment.service');
    const result = await new PaymentService().reconcilePendingPayments();
    logger.info('[JOB_COMPLETED]', { jobId: job.id, queue: 'payment-reconciliation', ...result });
  }, { connection: conn, concurrency: 1 });

  logger.info('[WORKERS] Started');
}

// ==========================================
// Scheduler
// ==========================================

export async function startScheduler(): Promise<void> {
  if (!cartCleanupQueue) {
    cartCleanupQueue = new Queue('cart-cleanup', {
      connection: getConnection(),
      defaultJobOptions: { attempts: 2, removeOnComplete: { count: 10 } },
    });
  }
  await cartCleanupQueue.upsertJobScheduler(
    'cart-cleanup-scheduler',
    { every: 30 * 60 * 1000 },
    { name: 'cleanup-expired-carts' },
  );
  logger.info('[SCHEDULER] Cart cleanup every 30 min');

  if (!paymentReconciliationQueue) {
    paymentReconciliationQueue = new Queue('payment-reconciliation', {
      connection: getConnection(),
      defaultJobOptions: { attempts: 2, removeOnComplete: { count: 20 } },
    });
  }
  await paymentReconciliationQueue.upsertJobScheduler(
    'payment-reconciliation-scheduler',
    { every: 5 * 60 * 1000 },
    { name: 'reconcile-pending-payments' },
  );
  logger.info('[SCHEDULER] Payment reconciliation every 5 min');
}

// ==========================================
// Enqueue (safe — returns immediately if Redis unavailable)
// ==========================================

export async function enqueueNotification(data: Omit<NotificationJobData, 'eventId'>): Promise<void> {
  const eventId = `${data.eventType}:${data.entityId}`;
  try {
    const queue = getNotificationQueue();
    await queue.add(data.eventType, { ...data, eventId }, { jobId: eventId });
    logger.info('[JOB_ENQUEUED]', { queue: 'notifications', jobType: data.eventType, entityId: data.entityId });
  } catch (error) {
    // Graceful: if Redis is down or job exists, don't crash the request
    const msg = (error as Error).message || '';
    if (msg.includes('Job already exists')) {
      return; // Duplicate — OK
    }
    logger.warn('[JOB_ENQUEUE_FAILED]', { eventType: data.eventType, entityId: data.entityId, error: msg });
  }
}

// ==========================================
// Graceful shutdown
// ==========================================

export async function shutdownJobs(): Promise<void> {
  logger.info('[SHUTDOWN] Closing jobs...');
  if (notificationWorker) await notificationWorker.close();
  if (cartCleanupWorker) await cartCleanupWorker.close();
  if (paymentReconciliationWorker) await paymentReconciliationWorker.close();
  if (notificationQueue) await notificationQueue.close();
  if (cartCleanupQueue) await cartCleanupQueue.close();
  if (paymentReconciliationQueue) await paymentReconciliationQueue.close();
  if (connection) await connection.quit();
  connection = null;
  notificationQueue = null;
  cartCleanupQueue = null;
  paymentReconciliationQueue = null;
  initialized = false;
  logger.info('[SHUTDOWN] Jobs closed');
}

// ==========================================
// Notification Processor
// ==========================================

async function processNotification(eventType: string, entityId: string, userId: string): Promise<void> {
  const mailProvider = getMailProvider();

  switch (eventType) {
    case 'welcome': {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return;
      await mailProvider.send({ to: user.email, subject: 'Bem-vindo à Qwerty Build Hub!', template: 'welcome', data: { name: user.name || user.email } });
      break;
    }
    case 'order_created': {
      const order = await prisma.order.findUnique({ where: { id: entityId }, include: { user: true, items: true } });
      if (!order) return;
      await mailProvider.send({ to: order.user.email, subject: `Pedido #${order.orderNumber} recebido`, template: 'order_created', data: { orderNumber: order.orderNumber, total: Number(order.total), itemCount: order.items.length } });
      break;
    }
    case 'payment_approved': {
      const payment = await prisma.payment.findUnique({ where: { id: entityId }, include: { order: { include: { user: true } } } });
      if (!payment) return;
      await mailProvider.send({ to: payment.order.user.email, subject: `Pagamento confirmado — Pedido #${payment.order.orderNumber}`, template: 'payment_approved', data: { orderNumber: payment.order.orderNumber, amount: Number(payment.amount) } });
      break;
    }
    case 'payment_failed': {
      const payment = await prisma.payment.findUnique({ where: { id: entityId }, include: { order: { include: { user: true } } } });
      if (!payment) return;
      await mailProvider.send({ to: payment.order.user.email, subject: `Pagamento não aprovado — Pedido #${payment.order.orderNumber}`, template: 'payment_failed', data: { orderNumber: payment.order.orderNumber } });
      break;
    }
    case 'shipment_created': {
      const shipment = await prisma.shipment.findUnique({ where: { id: entityId }, include: { order: { include: { user: true } } } });
      if (!shipment) return;
      await mailProvider.send({ to: shipment.order.user.email, subject: `Pedido #${shipment.order.orderNumber} — envio preparado`, template: 'shipment_created', data: { orderNumber: shipment.order.orderNumber, carrier: shipment.carrier || 'N/A', trackingCode: shipment.trackingCode || 'Pendente' } });
      break;
    }
  }
}
