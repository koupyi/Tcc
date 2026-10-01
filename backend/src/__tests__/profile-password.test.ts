import request from 'supertest';
import { app } from '../server';

describe('Profile & Change Password', () => {
  let accessToken: string;
  const testUser = {
    name: 'Test Profile User',
    email: `profile_test_${Date.now()}@test.com`,
    password: 'TestPass1',
  };

  beforeAll(async () => {
    // Register a new user
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(testUser)
      .expect(201);

    accessToken = res.body.data.accessToken;
  });

  describe('GET /api/v1/auth/me', () => {
    it('returns 401 without token', async () => {
      await request(app).get('/api/v1/auth/me').expect(401);
    });

    it('returns full user profile with auth', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toHaveProperty('id');
      expect(res.body.data.user).toHaveProperty('name', testUser.name);
      expect(res.body.data.user).toHaveProperty('email', testUser.email);
      expect(res.body.data.user).toHaveProperty('role');
      expect(res.body.data.user).toHaveProperty('createdAt');
      // Must NOT expose passwordHash
      expect(res.body.data.user).not.toHaveProperty('passwordHash');
    });
  });

  describe('PATCH /api/v1/auth/me', () => {
    it('returns 401 without token', async () => {
      await request(app)
        .patch('/api/v1/auth/me')
        .send({ name: 'Hacker' })
        .expect(401);
    });

    it('updates name and phone', async () => {
      const res = await request(app)
        .patch('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Updated Name', phone: '11999999999' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.user.name).toBe('Updated Name');
      expect(res.body.data.user.phone).toBe('11999999999');
    });

    it('ignores role field (mass assignment protection)', async () => {
      const res = await request(app)
        .patch('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Still User', role: 'ADMIN' })
        .expect(200);

      expect(res.body.data.user.role).not.toBe('ADMIN');
    });

    it('rejects duplicate email', async () => {
      // Admin exists from seed
      const res = await request(app)
        .patch('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ email: 'admin@keycaps.dev' })
        .expect(409);

      expect(res.body.success).toBe(false);
    });

    it('returns 400 for empty update', async () => {
      await request(app)
        .patch('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(400);
    });
  });

  describe('POST /api/v1/auth/change-password', () => {
    it('returns 401 without token', async () => {
      await request(app)
        .post('/api/v1/auth/change-password')
        .send({ currentPassword: 'x', newPassword: 'y', confirmPassword: 'y' })
        .expect(401);
    });

    it('rejects incorrect current password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'WrongPassword1',
          newPassword: 'NewPass123',
          confirmPassword: 'NewPass123',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('incorreta');
    });

    it('rejects weak new password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: testUser.password,
          newPassword: 'weak',
          confirmPassword: 'weak',
        })
        .expect(422);

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('rejects mismatched confirmation', async () => {
      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: testUser.password,
          newPassword: 'NewValid1',
          confirmPassword: 'Different1',
        })
        .expect(422);

      expect(res.body.success).toBe(false);
    });

    it('changes password successfully', async () => {
      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: testUser.password,
          newPassword: 'NewPass123',
          confirmPassword: 'NewPass123',
        })
        .expect(200);

      expect(res.body.success).toBe(true);

      // Verify new password works for login
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: testUser.email, password: 'NewPass123' })
        .expect(200);

      expect(loginRes.body.success).toBe(true);
    });
  });
});
