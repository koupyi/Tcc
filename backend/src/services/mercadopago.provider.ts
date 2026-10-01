import * as crypto from 'crypto';
import { PaymentProvider, PixPaymentResult } from './payment.provider';
import { logger } from '../config/logger';

const MP_API_BASE = 'https://api.mercadopago.com';
const REQUEST_TIMEOUT_MS = 8000;

/**
 * Thrown when the outcome of a create/verify call against Mercado Pago is
 * genuinely unknown (network error, timeout, 5xx) — the caller must NOT
 * assume FAILED, since the external order may well have been created. The
 * caller keeps the local Payment row in its pre-call state (PENDING, no
 * gatewayId) so a retry safely reuses the same persisted idempotency key.
 */
export class PaymentProviderUnknownOutcomeError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'PaymentProviderUnknownOutcomeError';
  }
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export interface MercadoPagoOrderResponse {
  id: string;
  status: string;
  status_detail: string;
  external_reference: string;
  total_amount: string;
  transactions: {
    payments: Array<{
      id: string;
      status: string;
      status_detail: string;
      amount: string;
      payment_method: {
        id: string;
        type: string;
        ticket_url?: string;
        qr_code?: string;
        qr_code_base64?: string;
      };
    }>;
  };
}

/**
 * Mercado Pago Provider — integrates with the Orders API for PIX payments.
 * Uses the newest Checkout Transparente (Orders API) endpoint.
 *
 * Requires: MERCADOPAGO_ACCESS_TOKEN env var (test token starts with APP_USR).
 */
export class MercadoPagoProvider implements PaymentProvider {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  /**
   * Create a PIX payment via Mercado Pago Orders API.
   *
   * `idempotencyKey` is provided by the caller (persisted on the local
   * Payment row before this is ever invoked) — never generated here. Per
   * https://www.mercadopago.com.br/developers/en/docs/checkout-api-orders/payment-integration/pix
   * the X-Idempotency-Key header is what lets Mercado Pago itself dedupe a
   * retried request; generating a fresh key on every call would defeat that
   * guarantee entirely (the exact "STOP CONDITION" this integration must avoid).
   */
  async createPixPayment(
    amount: number,
    orderId: string,
    description: string,
    idempotencyKey: string,
    payerEmail?: string,
  ): Promise<PixPaymentResult> {
    const body = {
      type: 'online',
      total_amount: amount.toFixed(2),
      external_reference: orderId,
      processing_mode: 'automatic', // simple, synchronous flow — see MERCADOPAGO_PROCESSING_MODE in the phase report
      description: description.substring(0, 240),
      transactions: {
        payments: [
          {
            amount: amount.toFixed(2),
            payment_method: {
              id: 'pix',
              type: 'bank_transfer',
            },
            expiration_time: 'PT30M', // ISO 8601 duration — 30 minutes
          },
        ],
      },
      payer: {
        email: payerEmail || 'test_user_br@testuser.com',
      },
    };

    let response: Response;
    try {
      response = await fetchWithTimeout(`${MP_API_BASE}/v1/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`,
          'X-Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      // Network error / timeout / abort — the order may or may not have been
      // created on Mercado Pago's side. Do NOT treat as FAILED.
      logger.error('[MercadoPago] Erro de rede ao criar pagamento (outcome desconhecido)', { orderId });
      throw new PaymentProviderUnknownOutcomeError('Falha de rede ao criar pagamento no Mercado Pago', err);
    }

    if (response.status === 429) {
      const retryAfter = response.headers.get('retry-after');
      logger.warn('[MercadoPago] Rate limited (429)', { orderId, retryAfter });
      throw new PaymentProviderUnknownOutcomeError(`Mercado Pago rate limit (retry-after: ${retryAfter ?? 'n/a'})`);
    }

    if (response.status >= 500) {
      // Server-side failure at Mercado Pago — outcome unknown, same as a network error.
      logger.error(`[MercadoPago] Erro 5xx ao criar pagamento: ${response.status}`, { orderId });
      throw new PaymentProviderUnknownOutcomeError(`Mercado Pago API 5xx: ${response.status}`);
    }

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error(`[MercadoPago] Erro ao criar pagamento: ${response.status}`, { body: errorBody });
      throw new Error(`Mercado Pago API error: ${response.status} - ${errorBody}`);
    }

    const data = await response.json() as MercadoPagoOrderResponse;
    const payment = data.transactions.payments[0];

    if (!payment) {
      throw new Error('Mercado Pago: nenhum pagamento retornado na resposta');
    }

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30min from now

    return {
      gatewayId: data.id, // MP Order ID — used as external_reference lookup key
      qrCode: payment.payment_method.qr_code || '',
      qrCodeBase64: payment.payment_method.qr_code_base64 || '',
      expiresAt,
    };
  }

  /**
   * Verify payment status by consulting the MP Orders API. This is the ONLY
   * source of truth for a status transition — webhooks are just a signal to
   * call this.
   */
  async verifyPayment(gatewayId: string): Promise<{ status: 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED' | 'REFUNDED' }> {
    let response: Response;
    try {
      response = await fetchWithTimeout(`${MP_API_BASE}/v1/orders/${gatewayId}`, {
        headers: { 'Authorization': `Bearer ${this.accessToken}` },
      });
    } catch (err) {
      logger.error('[MercadoPago] Erro de rede ao consultar pagamento (outcome desconhecido)', { gatewayId });
      throw new PaymentProviderUnknownOutcomeError('Falha de rede ao consultar pagamento no Mercado Pago', err);
    }

    if (!response.ok) {
      logger.error(`[MercadoPago] Erro ao consultar pagamento: ${response.status}`);
      throw new PaymentProviderUnknownOutcomeError(`Mercado Pago API error on verify: ${response.status}`);
    }

    const data = await response.json() as MercadoPagoOrderResponse;
    // Prefer the individual payment's status (stable, well-documented
    // vocabulary shared across every MP payment API: approved/pending/
    // in_process/rejected/cancelled/refunded) over the order-level `status`
    // field, whose vocabulary (action_required/processed/expired/canceled)
    // is less consistently documented across Orders API versions. Falls
    // back to the order-level status if no payment sub-object is present yet.
    const paymentStatus = data.transactions?.payments?.[0]?.status;
    return { status: this.mapStatus(paymentStatus || data.status) };
  }

  /**
   * Validate webhook notification from Mercado Pago.
   * MP sends x-signature header with format: ts=TIMESTAMP,v1=HASH
   * The hash is HMAC-SHA256 of "id:{data.id};request-id:{x-request-id};ts:{ts};{template}"
   * signed with the webhook secret.
   *
   * For sandbox/development when no secret is configured, we skip validation
   * but still require server-side verification of the payment.
   */
  static validateWebhookSignature(
    xSignature: string | undefined,
    xRequestId: string | undefined,
    dataId: string,
    webhookSecret: string | undefined,
  ): boolean {
    if (!webhookSecret) {
      // In development without secret, skip signature validation
      // but ALWAYS verify payment server-side
      return true;
    }

    if (!xSignature) return false;

    // Parse x-signature header: "ts=TIMESTAMP,v1=HASH"
    const parts: Record<string, string> = {};
    xSignature.split(',').forEach((part) => {
      const [key, value] = part.split('=');
      if (key && value) parts[key.trim()] = value.trim();
    });

    const ts = parts['ts'];
    const v1 = parts['v1'];
    if (!ts || !v1) return false;

    // Build manifest string. Per official docs, data.id must be lowercased
    // before being placed in the manifest (it may arrive as uppercase alphanumeric).
    const manifest = `id:${dataId.toLowerCase()};request-id:${xRequestId || ''};ts:${ts};`;

    // Compute expected signature
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(manifest)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(v1),
      Buffer.from(expectedSignature),
    );
  }

  /**
   * Maps both the order-level status vocabulary (action_required, processed,
   * expired, canceled) and the individual-payment vocabulary shared across
   * MP payment APIs (approved, pending, in_process, rejected, cancelled,
   * refunded) to our internal set. `verifyPayment` prefers the payment-level
   * value when available; this still handles the order-level value as a
   * fallback for orders with no payment sub-object yet.
   */
  private mapStatus(mpStatus: string): 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED' | 'REFUNDED' {
    switch (mpStatus) {
      case 'paid':
      case 'approved':
      case 'processed':
      case 'accredited':
        return 'PAID';
      case 'action_required':
      case 'pending':
      case 'in_process':
        return 'PENDING';
      case 'expired':
        return 'EXPIRED';
      case 'refunded':
      case 'charged_back':
        return 'REFUNDED';
      case 'rejected':
      case 'cancelled':
      case 'canceled':
      default:
        return 'FAILED';
    }
  }
}
