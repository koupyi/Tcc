import * as crypto from 'crypto';
import { Prisma, PaymentStatus, OrderStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { AuditRepository } from '../repositories/audit.repository';
import { OrderRepository } from '../repositories/order.repository';
import { SandboxPixProvider, PaymentProvider } from './payment.provider';
import { MercadoPagoProvider, PaymentProviderUnknownOutcomeError } from './mercadopago.provider';
import { AppError } from '../utils/AppError';
import { logPayment } from '../config/logger';

const PRISMA_UNIQUE_CONSTRAINT_ERROR = 'P2002';

/**
 * Returns the appropriate payment provider based on environment configuration.
 * Uses MercadoPago when MERCADOPAGO_ACCESS_TOKEN is set, otherwise falls back to Sandbox.
 */
function getPaymentProvider(): PaymentProvider {
  const mpToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (mpToken) {
    return new MercadoPagoProvider(mpToken);
  }
  return new SandboxPixProvider();
}

export class PaymentService {
  private auditRepo = new AuditRepository();
  private orderRepo = new OrderRepository();

  /**
   * Create (or idempotently return) a PIX payment for an order.
   * Value comes from the Order in the database — NEVER from the frontend.
   *
   * Concurrency-safe by construction: `payments.orderId` is a unique
   * constraint, and this method always tries a bare INSERT (claiming the
   * attempt) BEFORE calling the external provider. Two simultaneous requests
   * for the same order can both reach this method, but only one of them can
   * win the INSERT — the loser reads back the winner's row and returns it
   * without ever calling Mercado Pago a second time. This is what keeps
   * "double click" / concurrent retries from ever producing two external
   * charges (see payment.test.ts "Concurrent create").
   */
  async createPayment(orderId: string, userId: string) {
    const order = await this.orderRepo.findById(orderId);
    if (!order) throw AppError.notFound('Pedido não encontrado');
    if (order.userId !== userId) throw AppError.forbidden('Acesso negado');

    // Only allow payment for PENDING orders
    if (order.status !== OrderStatus.PENDING) {
      throw AppError.badRequest(`Pedido não está disponível para pagamento (status: ${order.status})`);
    }

    const payment = await this.claimPaymentAttempt(orderId, Number(order.total));

    if (payment.status === PaymentStatus.PAID) {
      throw AppError.conflict('Pagamento já realizado');
    }

    // Already has a live (non-expired) external attempt — idempotent return,
    // no second call to the provider for the same attempt.
    if (payment.gatewayId) {
      const expiresAt = (payment.gatewayResponse as { expiresAt?: string } | null)?.expiresAt;
      if (expiresAt && new Date(expiresAt) > new Date()) {
        return payment;
      }
      // Expired attempt — legitimately start a NEW attempt with a NEW
      // idempotency key (this is not a retry of the same intent anymore).
      return this.startNewAttempt(orderId, Number(order.total));
    }

    // Defense-in-depth: every code path that creates a Payment row sets
    // idempotencyKey at creation time, but never trust that blindly — claim
    // one now (persisted immediately) if it is somehow still missing, rather
    // than ever calling the provider without a stable key to pass it.
    const idempotencyKey = payment.idempotencyKey ?? (await this.backfillIdempotencyKey(payment.id));

    // This request won the claim (fresh PENDING row, no gatewayId yet) —
    // it, and only it, calls the external provider for this attempt.
    return this.callProviderAndPersist(payment.id, orderId, idempotencyKey, Number(order.total), order.orderNumber);
  }

  private async backfillIdempotencyKey(paymentId: string): Promise<string> {
    const key = crypto.randomUUID();
    await prisma.payment.update({ where: { id: paymentId }, data: { idempotencyKey: key } });
    return key;
  }

  /**
   * Atomically claims the right to create (or reuse) the single Payment row
   * for this order. Insert-first, catch-unique-violation-second — never a
   * check-then-act race, because the DB unique constraint is the lock.
   */
  private async claimPaymentAttempt(orderId: string, amount: number) {
    try {
      return await prisma.payment.create({
        data: {
          orderId,
          method: 'PIX',
          status: PaymentStatus.PENDING,
          amount,
          currency: 'BRL',
          idempotencyKey: crypto.randomUUID(),
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === PRISMA_UNIQUE_CONSTRAINT_ERROR) {
        // Another concurrent request already claimed this order's payment row.
        const existing = await prisma.payment.findUniqueOrThrow({ where: { orderId } });
        return existing;
      }
      throw err;
    }
  }

  /**
   * Starts a brand-new payment attempt after the previous one expired.
   * `payments.orderId` is unique, so this reuses the SAME row (UPDATE, not
   * INSERT) — but a NEW idempotencyKey, because this is genuinely a new
   * intent, not a retry of the expired one.
   */
  private async startNewAttempt(orderId: string, amount: number) {
    const newKey = crypto.randomUUID();
    const updated = await prisma.payment.update({
      where: { orderId },
      data: {
        status: PaymentStatus.PENDING,
        amount,
        idempotencyKey: newKey,
        gatewayId: null,
        gatewayResponse: Prisma.JsonNull,
        paidAt: null,
        failedAt: null,
      },
    });
    const order = await this.orderRepo.findById(orderId);
    return this.callProviderAndPersist(updated.id, orderId, newKey, amount, order!.orderNumber);
  }

  /**
   * Calls the provider exactly once for the given (already-persisted)
   * idempotencyKey, then persists the result. If the provider call's outcome
   * is unknown (timeout/network/5xx), the row is left as PENDING with no
   * gatewayId — a subsequent retry reuses the SAME idempotencyKey (fetched
   * back from the row), so it is still safe to call the provider again.
   */
  private async callProviderAndPersist(paymentId: string, orderId: string, idempotencyKey: string, amount: number, orderNumber: string) {
    const provider = getPaymentProvider();
    logPayment('PAYMENT_CREATION_STARTED', orderId, { idempotencyKey: maskKey(idempotencyKey) });

    let pixResult;
    try {
      pixResult = await provider.createPixPayment(amount, orderId, `Pedido ${orderNumber}`, idempotencyKey);
    } catch (err) {
      if (err instanceof PaymentProviderUnknownOutcomeError) {
        logPayment('PAYMENT_CREATION_UNKNOWN_OUTCOME', orderId, { idempotencyKey: maskKey(idempotencyKey) });
        // Leave the row PENDING/no-gatewayId — safe to retry with the same key.
        throw AppError.internal('Seu pagamento ainda está sendo processado. Tente consultar novamente em instantes.');
      }
      logPayment('PAYMENT_CREATION_FAILED', orderId, { idempotencyKey: maskKey(idempotencyKey) });
      throw AppError.internal('Não foi possível iniciar o pagamento. Tente novamente.');
    }

    const payment = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.PENDING,
        gatewayId: pixResult.gatewayId,
        gatewayResponse: {
          qrCode: pixResult.qrCode,
          qrCodeBase64: pixResult.qrCodeBase64,
          expiresAt: pixResult.expiresAt.toISOString(),
        },
      },
    });

    logPayment('PAYMENT_CREATION_COMPLETED', orderId, { gatewayId: pixResult.gatewayId });
    return payment;
  }

  /**
   * Re-verifies every PENDING payment whose external attempt is old enough
   * that a webhook should have arrived by now, and applies the same
   * idempotent transition logic the webhook path uses. Recovers payments
   * stuck in an intermediate state (provider timeout, missed webhook)
   * without ever creating a second external charge — it only ever calls
   * `verifyPayment` (read-only) against the SAME gatewayId already on file.
   */
  async reconcilePendingPayments(olderThanMs = 2 * 60 * 1000): Promise<{ checked: number; updated: number }> {
    const cutoff = new Date(Date.now() - olderThanMs);
    const stuck = await prisma.payment.findMany({
      where: { status: PaymentStatus.PENDING, gatewayId: { not: null }, updatedAt: { lt: cutoff } },
    });

    let updated = 0;
    for (const payment of stuck) {
      try {
        const provider = getPaymentProvider();
        const verification = await provider.verifyPayment(payment.gatewayId!);
        const targetStatus = this.mapVerifiedStatus(verification.status);
        if (targetStatus !== PaymentStatus.PENDING) {
          const result = await this.applyVerifiedStatus(payment.id, targetStatus, { source: 'reconciliation', verifiedStatus: verification.status });
          if (result.applied) updated += 1;
        }
      } catch (err) {
        if (!(err instanceof PaymentProviderUnknownOutcomeError)) {
          logPayment('RECONCILIATION_ERROR', payment.orderId, {});
        }
        // Unknown outcome — leave PENDING, try again on the next reconciliation pass.
      }
    }

    logPayment('RECONCILIATION_COMPLETED', 'batch', { checked: stuck.length, updated });
    return { checked: stuck.length, updated };
  }

  /**
   * Get payment details for an order (with expiration check).
   */
  async getPaymentByOrderId(orderId: string, userId: string) {
    const order = await this.orderRepo.findById(orderId);
    if (!order) throw AppError.notFound('Pedido não encontrado');
    if (order.userId !== userId) throw AppError.forbidden('Acesso negado');

    const payment = await prisma.payment.findFirst({ where: { orderId } });
    if (!payment) throw AppError.notFound('Pagamento não encontrado');

    // Check expiration for pending payments
    if (payment.status === PaymentStatus.PENDING) {
      const gatewayData = payment.gatewayResponse as { expiresAt?: string } | null;
      if (gatewayData?.expiresAt && new Date(gatewayData.expiresAt) < new Date()) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: PaymentStatus.CANCELLED },
        });
        return { ...payment, status: PaymentStatus.CANCELLED };
      }
    }

    return payment;
  }

  /**
   * Handle webhook from Mercado Pago (or sandbox).
   *
   * Mercado Pago webhook format:
   * { action: "payment.updated", data: { id: "ORDER_ID" }, type: "payment" }
   *
   * Sandbox/legacy format:
   * { paymentId: "...", status: "approved", eventId: "..." }
   *
   * This handler supports BOTH formats for backward compatibility.
   */
  async handleWebhook(
    payload: Record<string, unknown>,
    headers: { xSignature?: string; xRequestId?: string; rawSignature?: string },
    query: { dataId?: string } = {},
  ) {
    // Detect format: Mercado Pago vs legacy sandbox
    const isMercadoPagoFormat = payload.action && payload.data && payload.type;

    if (isMercadoPagoFormat) {
      return this.handleMercadoPagoWebhook(payload, headers, query);
    }

    // Legacy sandbox format
    return this.handleLegacyWebhook(payload, headers.rawSignature || '');
  }

  /**
   * Process Mercado Pago webhook notification.
   * ALWAYS verifies payment server-side — never trusts webhook payload alone.
   */
  private async handleMercadoPagoWebhook(
    payload: Record<string, unknown>,
    headers: { xSignature?: string; xRequestId?: string },
    query: { dataId?: string },
  ) {
    const bodyData = payload.data as { id?: string } | undefined;
    // Per official docs, the `data.id` used in the signature manifest comes
    // from the URL QUERY STRING (MP calls the webhook as
    // `POST /webhook?data.id=...&type=...`), not the JSON body. The body's
    // `data.id` (present for "payment"/"order" topic notifications) is used
    // as a fallback only when the query value is absent, and purely for
    // resource lookup — never as the signature input once a query value exists.
    const signatureDataId = query.dataId || bodyData?.id;
    const lookupId = query.dataId || bodyData?.id;

    if (!lookupId) {
      throw AppError.badRequest('Webhook: data.id ausente');
    }

    // Validate signature if webhook secret is configured
    const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
    const isValid = MercadoPagoProvider.validateWebhookSignature(
      headers.xSignature,
      headers.xRequestId,
      signatureDataId!,
      webhookSecret,
    );

    if (!isValid) {
      logPayment('WEBHOOK_INVALID_SIGNATURE', lookupId, {});
      throw AppError.unauthorized('Assinatura de webhook inválida');
    }

    // Find payment by gatewayId (MP order ID)
    const payment = await prisma.payment.findFirst({ where: { gatewayId: lookupId } });
    if (!payment) {
      // Payment not found — could be for an order we don't know about
      logPayment('WEBHOOK_PAYMENT_NOT_FOUND', lookupId, {});
      // Return 200 to MP so it doesn't retry
      return { processed: true, skipped: true, reason: 'payment_not_found' };
    }

    // ALWAYS verify payment server-side with MP API — the webhook body is only a signal.
    const provider = getPaymentProvider();
    const verification = await provider.verifyPayment(lookupId);
    const targetStatus = this.mapVerifiedStatus(verification.status);

    const result = await this.applyVerifiedStatus(payment.id, targetStatus, {
      source: 'webhook',
      rawAction: String(payload.action || ''),
      verifiedStatus: verification.status,
    });

    return { processed: true, idempotent: result.reason === 'idempotent', skipped: !result.applied && result.reason !== undefined && result.reason !== 'idempotent' };
  }

  /**
   * Legacy webhook handler (sandbox/HMAC-based).
   */
  private async handleLegacyWebhook(payload: Record<string, unknown>, signature: string) {
    const { paymentId, status, eventId } = payload as {
      paymentId?: string;
      status?: string;
      eventId?: string;
    };

    if (!paymentId || !status) {
      throw AppError.badRequest('Payload de webhook inválido');
    }

    // Validate HMAC signature
    const webhookSecret = process.env.WEBHOOK_SECRET || 'dev-webhook-secret-change-in-production';
    const expectedSignature = crypto.createHmac('sha256', webhookSecret).update(JSON.stringify(payload)).digest('hex');
    if (signature !== expectedSignature) {
      logPayment('WEBHOOK_INVALID_SIGNATURE', paymentId, {});
      throw AppError.unauthorized('Assinatura inválida');
    }

    // Find payment by gatewayId
    const payment = await prisma.payment.findFirst({ where: { gatewayId: paymentId } });
    if (!payment) {
      throw AppError.notFound('Pagamento não encontrado');
    }

    const targetStatus = this.mapWebhookStatus(status);

    // Idempotency
    if (payment.status === targetStatus) {
      return { processed: true, idempotent: true };
    }

    if (payment.status === PaymentStatus.PAID || payment.status === PaymentStatus.REFUNDED) {
      return { processed: true, skipped: true };
    }

    await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: targetStatus,
          paidAt: targetStatus === PaymentStatus.PAID ? new Date() : undefined,
          failedAt: targetStatus === PaymentStatus.FAILED ? new Date() : undefined,
          refundedAt: targetStatus === PaymentStatus.REFUNDED ? new Date() : undefined,
          gatewayResponse: {
            ...(payment.gatewayResponse as object || {}),
            lastWebhook: { eventId, status, processedAt: new Date().toISOString() },
          },
        },
      });

      if (targetStatus === PaymentStatus.PAID) {
        await tx.order.update({
          where: { id: payment.orderId },
          data: { status: OrderStatus.CONFIRMED },
        });
      }
    });

    await this.auditRepo.create({
      actorId: undefined,
      action: 'PAYMENT_PROCESSED',
      resource: 'Payment',
      resourceId: payment.id,
      newData: { status: targetStatus, eventId, gatewayId: paymentId },
    });

    logPayment('WEBHOOK_PROCESSED', paymentId, { orderId: payment.orderId, status: targetStatus });
    return { processed: true };
  }

  private mapVerifiedStatus(status: string): PaymentStatus {
    switch (status) {
      case 'PAID': return PaymentStatus.PAID;
      case 'FAILED': return PaymentStatus.FAILED;
      case 'EXPIRED': return PaymentStatus.CANCELLED;
      case 'REFUNDED': return PaymentStatus.REFUNDED;
      default: return PaymentStatus.PENDING;
    }
  }

  /**
   * Single canonical state-machine transition, shared by the webhook path
   * and `reconcilePendingPayments` — so "duplicate event" / "out-of-order
   * event" / "don't downgrade from PAID" behave identically regardless of
   * which caller triggered the re-check. Idempotent: applying the same
   * targetStatus twice for the same payment is a no-op the second time.
   */
  private async applyVerifiedStatus(
    paymentId: string,
    targetStatus: PaymentStatus,
    meta: { source: 'webhook' | 'reconciliation'; rawAction?: string; verifiedStatus?: string },
  ): Promise<{ applied: boolean; reason?: string }> {
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) return { applied: false, reason: 'payment_not_found' };

    if (payment.status === targetStatus) {
      logPayment('WEBHOOK_IDEMPOTENT', payment.orderId, { status: targetStatus, source: meta.source });
      return { applied: false, reason: 'idempotent' };
    }

    // A final PAID state is never downgraded by a stale/out-of-order event —
    // the only forward transition allowed out of PAID is REFUNDED.
    if (payment.status === PaymentStatus.PAID && targetStatus !== PaymentStatus.REFUNDED) {
      logPayment('WEBHOOK_SKIPPED_FINAL_STATE', payment.orderId, { current: payment.status, incoming: targetStatus, source: meta.source });
      return { applied: false, reason: 'final_state_protected' };
    }

    const order = await prisma.order.findUnique({ where: { id: payment.orderId } });
    if (!order) {
      logPayment('WEBHOOK_ORDER_NOT_FOUND', payment.orderId, {});
      return { applied: false, reason: 'order_not_found' };
    }

    await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: targetStatus,
          paidAt: targetStatus === PaymentStatus.PAID ? new Date() : undefined,
          failedAt: targetStatus === PaymentStatus.FAILED ? new Date() : undefined,
          refundedAt: targetStatus === PaymentStatus.REFUNDED ? new Date() : undefined,
          gatewayResponse: {
            ...((payment.gatewayResponse as object) || {}),
            lastUpdate: { source: meta.source, action: meta.rawAction, verifiedStatus: meta.verifiedStatus, processedAt: new Date().toISOString() },
          },
        },
      });

      // Order transition happens exactly once per approval (guarded by the
      // idempotent-skip above). Stock is intentionally NOT touched here —
      // it was already decremented atomically at order creation (see
      // order.service.ts), so an approval is a no-op for inventory by
      // construction, which is what guarantees STOCK_APPLIED_ONCE even
      // under a duplicated/replayed webhook.
      if (targetStatus === PaymentStatus.PAID) {
        await tx.order.update({ where: { id: payment.orderId }, data: { status: OrderStatus.CONFIRMED } });
      }
    });

    await this.auditRepo.create({
      actorId: undefined,
      action: 'PAYMENT_PROCESSED',
      resource: 'Payment',
      resourceId: payment.id,
      newData: { status: targetStatus, gatewayId: payment.gatewayId, source: meta.source },
    });

    logPayment('WEBHOOK_PROCESSED', payment.orderId, { status: targetStatus, source: meta.source });

    try {
      const { enqueueNotification } = require('../jobs');
      const eventType = targetStatus === PaymentStatus.PAID ? 'payment_approved' : 'payment_failed';
      enqueueNotification({ eventType, entityId: payment.id, userId: order.userId });
    } catch { /* Jobs may not be available */ }

    return { applied: true };
  }

  private mapWebhookStatus(status: string): PaymentStatus {
    const map: Record<string, PaymentStatus> = {
      approved: PaymentStatus.PAID,
      paid: PaymentStatus.PAID,
      rejected: PaymentStatus.FAILED,
      failed: PaymentStatus.FAILED,
      refunded: PaymentStatus.REFUNDED,
      cancelled: PaymentStatus.CANCELLED,
    };
    return map[status.toLowerCase()] || PaymentStatus.FAILED;
  }
}

/** Never log a full idempotency key or secret — only enough to correlate log lines. */
function maskKey(key: string): string {
  return key.length <= 8 ? '***' : `${key.slice(0, 4)}...${key.slice(-4)}`;
}
