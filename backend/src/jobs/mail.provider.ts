/**
 * Mail Provider abstraction — allows swapping SMTP/Resend/SES/Mock.
 */

export interface MailMessage {
  to: string;
  subject: string;
  template: string;
  data: Record<string, unknown>;
}

export interface MailProvider {
  send(message: MailMessage): Promise<void>;
}

/**
 * Mock Mail Provider — stores sent messages in memory for testing.
 * Does NOT send real emails.
 */
export class MockMailProvider implements MailProvider {
  private static instance: MockMailProvider | null = null;
  private sentMessages: MailMessage[] = [];

  static getInstance(): MockMailProvider {
    if (!MockMailProvider.instance) {
      MockMailProvider.instance = new MockMailProvider();
    }
    return MockMailProvider.instance;
  }

  async send(message: MailMessage): Promise<void> {
    this.sentMessages.push(message);
  }

  getSentMessages(): MailMessage[] {
    return [...this.sentMessages];
  }

  getLastMessage(): MailMessage | undefined {
    return this.sentMessages[this.sentMessages.length - 1];
  }

  clear(): void {
    this.sentMessages = [];
  }

  getMessagesByTemplate(template: string): MailMessage[] {
    return this.sentMessages.filter((m) => m.template === template);
  }

  getMessagesByRecipient(to: string): MailMessage[] {
    return this.sentMessages.filter((m) => m.to === to);
  }
}

/**
 * SMTP Mail Provider — sends real emails via nodemailer.
 */
export class SmtpMailProvider implements MailProvider {
  async send(message: MailMessage): Promise<void> {
    const { sendMail } = await import('../middlewares/mailer');
    const html = renderTemplate(message.template, message.data);
    await sendMail(message.to, message.subject, html);
  }
}

/**
 * Get the configured mail provider.
 * Uses MockMailProvider in test/development when SMTP is not configured.
 */
export function getMailProvider(): MailProvider {
  const isTest = process.env.NODE_ENV === 'test';
  const hasSmtp = process.env.SMTP_HOST && process.env.SMTP_USER;

  if (isTest || !hasSmtp) {
    return MockMailProvider.getInstance();
  }
  return new SmtpMailProvider();
}

/**
 * Simple template renderer. Returns HTML string.
 */
function renderTemplate(template: string, data: Record<string, unknown>): string {
  switch (template) {
    case 'welcome':
      return `<h1>Bem-vindo, ${data.name}!</h1><p>Obrigado por se cadastrar na Qwerty Build Hub.</p><p>Explore nossos produtos e monte seu teclado perfeito!</p>`;

    case 'order_created':
      return `<h1>Pedido #${data.orderNumber} recebido!</h1><p>Seu pedido com ${data.itemCount} item(ns) no valor de R$ ${Number(data.total).toFixed(2)} foi criado com sucesso.</p><p>Acompanhe o status na área "Meus Pedidos".</p>`;

    case 'payment_approved':
      return `<h1>Pagamento confirmado! ✓</h1><p>O pagamento de R$ ${Number(data.amount).toFixed(2)} para o pedido #${data.orderNumber} foi aprovado.</p><p>Seu pedido será preparado para envio em breve.</p>`;

    case 'payment_failed':
      return `<h1>Pagamento não aprovado</h1><p>Infelizmente o pagamento do pedido #${data.orderNumber} não foi aprovado.</p><p>Você pode tentar novamente na área "Meus Pedidos".</p>`;

    case 'shipment_created':
      return `<h1>Pedido enviado! 📦</h1><p>O pedido #${data.orderNumber} foi despachado.</p><p>Transportadora: ${data.carrier}</p><p>Código de rastreio: ${data.trackingCode}</p>`;

    default:
      return `<p>Notificação: ${template}</p><pre>${JSON.stringify(data, null, 2)}</pre>`;
  }
}
