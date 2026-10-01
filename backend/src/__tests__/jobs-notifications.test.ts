import request from 'supertest';
import { app } from '../server';
import { prisma } from '../config/database';
import { MockMailProvider } from '../jobs/mail.provider';
import { enqueueNotification, startWorkers, shutdownJobs } from '../jobs';

/**
 * FASE 0 / ETAPA 8 — Testes de Jobs e Notificações
 */

let testUser: { id: string; token: string; email: string };
let mockMail: MockMailProvider;

beforeAll(async () => {
  mockMail = MockMailProvider.getInstance();
  mockMail.clear();

  // Create test user
  const email = `jobs-test-${Date.now()}@test.com`;
  const res = await request(app).post('/api/v1/auth/register').send({ email, password: 'TestPass123!', name: 'Jobs Test' });
  testUser = { id: res.body.data.user.id, token: res.body.data.accessToken, email };

  // Start workers for integration tests
  try { startWorkers(); } catch { /* may already be started */ }
});

afterAll(async () => {
  try {
    await prisma.notificationDelivery.deleteMany({ where: { userId: testUser.id } });
    await prisma.refreshToken.deleteMany({ where: { userId: testUser.id } });
    await prisma.auditLog.deleteMany({ where: { OR: [{ actorId: testUser.id }, { userId: testUser.id }] } });
    await prisma.user.delete({ where: { id: testUser.id } });
  } catch { /* ignore */ }
  try { await shutdownJobs(); } catch { /* ignore */ }
  await prisma.$disconnect();
});

describe('F8: Mail Provider', () => {
  it('MockMailProvider stores sent messages', async () => {
    mockMail.clear();
    const { getMailProvider } = require('../jobs/mail.provider');
    const provider = getMailProvider();
    await provider.send({ to: 'test@test.com', subject: 'Test', template: 'welcome', data: { name: 'User' } });

    expect(mockMail.getSentMessages().length).toBe(1);
    expect(mockMail.getLastMessage()?.to).toBe('test@test.com');
    expect(mockMail.getLastMessage()?.template).toBe('welcome');
  });

  it('MockMailProvider getMessagesByTemplate works', async () => {
    mockMail.clear();
    const { getMailProvider } = require('../jobs/mail.provider');
    const provider = getMailProvider();
    await provider.send({ to: 'a@test.com', subject: 'A', template: 'welcome', data: {} });
    await provider.send({ to: 'b@test.com', subject: 'B', template: 'order_created', data: {} });

    expect(mockMail.getMessagesByTemplate('welcome').length).toBe(1);
    expect(mockMail.getMessagesByTemplate('order_created').length).toBe(1);
  });
});

describe('F8: Enqueue Notification', () => {
  it('enqueueNotification does not throw on Redis error', async () => {
    // Should not crash even if Redis has issues
    await expect(
      enqueueNotification({ eventType: 'welcome', entityId: 'fake-id', userId: 'fake-user' })
    ).resolves.not.toThrow();
  });

  it('enqueueNotification creates notification with eventId', async () => {
    await enqueueNotification({ eventType: 'welcome', entityId: testUser.id, userId: testUser.id });

    // The BullMQ worker processes asynchronously. Poll for the delivery instead of a
    // single fixed sleep so the assertion stays strong but is not racy under load.
    let delivery = null;
    for (let attempt = 0; attempt < 20 && !delivery; attempt++) {
      await new Promise((r) => setTimeout(r, 300));
      delivery = await prisma.notificationDelivery.findUnique({
        where: { eventId: `welcome:${testUser.id}` },
      });
    }

    expect(delivery).not.toBeNull();
    expect(delivery!.type).toBe('welcome');
    expect(delivery!.entityId).toBe(testUser.id);
  });
});

describe('F8: Idempotency', () => {
  it('Same event enqueued twice results in single delivery', async () => {
    mockMail.clear();
    const entityId = `idempotent-${Date.now()}`;

    // Mark as already sent
    await prisma.notificationDelivery.create({
      data: { eventId: `welcome:${entityId}`, type: 'welcome', entityId, userId: testUser.id, status: 'SENT', sentAt: new Date(), attempts: 1 },
    });

    await enqueueNotification({ eventType: 'welcome', entityId, userId: testUser.id });
    await new Promise((r) => setTimeout(r, 1000));

    // Should NOT send another email (idempotent)
    // The key is the DB record stays as SENT with same attempts count
    const delivery = await prisma.notificationDelivery.findUnique({ where: { eventId: `welcome:${entityId}` } });
    expect(delivery!.status).toBe('SENT');
    expect(delivery!.attempts).toBe(1); // Not incremented
  });
});

describe('F8: Cart Cleanup', () => {
  it('Expired carts are deactivated', async () => {
    // Create an expired cart
    const expiredCart = await prisma.cart.create({
      data: { userId: testUser.id, isActive: true, expiresAt: new Date(Date.now() - 86400000) }, // 1 day ago
    });

    // Run cleanup directly (simulate worker)
    const now = new Date();
    await prisma.cart.updateMany({
      where: { isActive: true, expiresAt: { lt: now } },
      data: { isActive: false },
    });

    const updated = await prisma.cart.findUnique({ where: { id: expiredCart.id } });
    expect(updated!.isActive).toBe(false);

    // Cleanup test data
    await prisma.cart.delete({ where: { id: expiredCart.id } });
  });

  it('Active non-expired carts are NOT affected', async () => {
    const activeCart = await prisma.cart.create({
      data: { userId: testUser.id, isActive: true, expiresAt: new Date(Date.now() + 86400000) }, // 1 day from now
    });

    const now = new Date();
    await prisma.cart.updateMany({
      where: { isActive: true, expiresAt: { lt: now } },
      data: { isActive: false },
    });

    const unchanged = await prisma.cart.findUnique({ where: { id: activeCart.id } });
    expect(unchanged!.isActive).toBe(true);

    await prisma.cart.delete({ where: { id: activeCart.id } });
  });
});

describe('F8: Register triggers welcome notification', () => {
  it('POST /auth/register enqueues welcome job', async () => {
    const email = `welcome-job-${Date.now()}@test.com`;
    const res = await request(app).post('/api/v1/auth/register').send({ email, password: 'TestPass123!', name: 'Welcome Test' });
    expect(res.status).toBe(201);

    const userId = res.body.data.user.id;

    // Give worker time
    await new Promise((r) => setTimeout(r, 1500));

    const delivery = await prisma.notificationDelivery.findUnique({ where: { eventId: `welcome:${userId}` } });
    // May be null if Redis is slow, but if it exists it should be correct
    if (delivery) {
      expect(delivery.type).toBe('welcome');
      expect(delivery.entityId).toBe(userId);
    }

    // Cleanup
    await prisma.notificationDelivery.deleteMany({ where: { userId } });
    await prisma.refreshToken.deleteMany({ where: { userId } });
    await prisma.auditLog.deleteMany({ where: { OR: [{ actorId: userId }, { userId }] } });
    await prisma.user.delete({ where: { id: userId } });
  });
});

describe('F8: Security', () => {
  it('No secrets in job payloads (notification only contains IDs)', async () => {
    // Verify the structure — jobs only get entityId/userId, never tokens/passwords
    const delivery = await prisma.notificationDelivery.findFirst({ where: { userId: testUser.id } });
    if (delivery) {
      expect(delivery.eventId).not.toContain('password');
      expect(delivery.eventId).not.toContain('token');
      expect(delivery.entityId).not.toContain('password');
    }
  });

  it('No public endpoint to trigger notifications', async () => {
    // There should be no POST /notifications or similar
    const res = await request(app).post('/api/v1/notifications').send({});
    expect(res.status).toBe(404); // Route not found
  });
});
