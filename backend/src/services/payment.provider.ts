import * as crypto from 'crypto';

/**
 * PaymentProvider interface — abstracts payment gateway integration.
 * Allows swapping between sandbox/fake and real providers (Mercado Pago, Stripe)
 * without any business logic (controllers/services) depending on a concrete SDK.
 */
export interface PixPaymentResult {
  gatewayId: string;
  qrCode: string;
  qrCodeBase64: string;
  expiresAt: Date;
}

export interface PaymentProvider {
  /**
   * `idempotencyKey` is generated ONCE by the caller (PaymentService) when a
   * payment attempt is first persisted, and must be passed unchanged on every
   * retry of that same attempt. A real provider (Mercado Pago) uses it to
   * guarantee that resending the same request never creates a second charge,
   * even if the first response was lost to a timeout.
   */
  createPixPayment(
    amount: number,
    orderId: string,
    description: string,
    idempotencyKey: string,
    payerEmail?: string,
  ): Promise<PixPaymentResult>;
  verifyPayment(gatewayId: string): Promise<{ status: 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED' | 'REFUNDED' }>;
}

/**
 * Fake/Sandbox PIX Provider — generates deterministic PIX codes without any
 * network call, so automated tests never depend on Mercado Pago being
 * reachable. Also used as the local development fallback when no
 * MERCADOPAGO_ACCESS_TOKEN is configured.
 *
 * Idempotency is honored here too: calling createPixPayment twice with the
 * SAME idempotencyKey returns the SAME gatewayId/qrCode (mirrors what a real
 * provider's idempotency-key contract guarantees), which is what lets the
 * concurrency/retry tests assert "exactly one logical payment" without a
 * live Mercado Pago sandbox.
 *
 * Status transitions (PENDING → PAID/FAILED/CANCELLED/REFUNDED) are driven
 * exclusively through the webhook endpoint in tests (see payment.test.ts /
 * `Webhook — Legacy (sandbox)`), never by this provider deciding on its own
 * — exactly like the real integration, where only Mercado Pago (via webhook
 * + server-side verification) is allowed to move a payment out of PENDING.
 */
export class SandboxPixProvider implements PaymentProvider {
  private readonly PIX_EXPIRATION_MINUTES = 30;

  async createPixPayment(
    amount: number,
    orderId: string,
    description: string,
    idempotencyKey: string,
  ): Promise<PixPaymentResult> {
    const gatewayId = `pix_${idempotencyKey}`;
    const expiresAt = new Date(Date.now() + this.PIX_EXPIRATION_MINUTES * 60 * 1000);

    // Generate a deterministic PIX code (EMV format simplified for sandbox)
    const pixPayload = [
      '00020126',
      `52040000`,
      `5303986`, // BRL
      `54${amount.toFixed(2).length.toString().padStart(2, '0')}${amount.toFixed(2)}`,
      `5802BR`,
      `59${description.substring(0, 25).length.toString().padStart(2, '0')}${description.substring(0, 25)}`,
      `62${orderId.length.toString().padStart(2, '0')}${orderId}`,
      `6304`,
    ].join('');

    // QR Code content is the PIX payload. Deterministic per idempotencyKey —
    // NOT per call — so a retried attempt reproduces the exact same payload.
    const qrCode = `${pixPayload}${crypto.createHash('sha256').update(idempotencyKey).digest('hex').slice(0, 8)}`;

    // Sandbox has no real QR image to return; the frontend renders a real
    // scannable QR client-side from `qrCode` instead of trusting this field
    // as an image. Kept only for interface/shape parity with the real
    // provider (which DOES return a genuine PNG here).
    const qrCodeBase64 = Buffer.from(qrCode).toString('base64');

    return {
      gatewayId,
      qrCode,
      qrCodeBase64,
      expiresAt,
    };
  }

  async verifyPayment(_gatewayId: string): Promise<{ status: 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED' | 'REFUNDED' }> {
    // In sandbox, payment status is controlled via webhook — this provider
    // never invents a status on its own.
    return { status: 'PENDING' };
  }
}

/** Explicit alias — same implementation, named for its role in tests/contract docs. */
export const FakePaymentProvider = SandboxPixProvider;
