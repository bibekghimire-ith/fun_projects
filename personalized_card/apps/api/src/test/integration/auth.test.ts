import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, prisma, resetDb, uniqueEmail } from '../helpers';

describe('auth', () => {
  beforeAll(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('registers a new creator and returns an access token plus a refresh cookie', async () => {
    const email = uniqueEmail('register');
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'Password123!', name: 'New Creator' });

    expect(res.status).toBe(201);
    expect(res.body.data.user.email).toBe(email);
    expect(res.body.data.user).not.toHaveProperty('passwordHash');
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.headers['set-cookie']?.some((c: string) => c.startsWith('refreshToken='))).toBe(true);
  });

  it('rejects a second registration on the same email', async () => {
    const email = uniqueEmail('dupe');
    await request(app).post('/api/auth/register').send({ email, password: 'Password123!', name: 'A' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'Password123!', name: 'A Again' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('rejects a weak password before ever touching the database', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: uniqueEmail('weak'), password: 'short', name: 'A' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('logs in with the right password and rejects the wrong one', async () => {
    const email = uniqueEmail('login');
    await request(app).post('/api/auth/register').send({ email, password: 'Password123!', name: 'A' });

    const good = await request(app).post('/api/auth/login').send({ email, password: 'Password123!' });
    expect(good.status).toBe(200);
    expect(good.body.data.accessToken).toEqual(expect.any(String));

    const bad = await request(app).post('/api/auth/login').send({ email, password: 'WrongPassword1' });
    expect(bad.status).toBe(401);
    expect(bad.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('never reveals whether the account or the password was wrong', async () => {
    const unknown = await request(app)
      .post('/api/auth/login')
      .send({ email: uniqueEmail('nobody'), password: 'Password123!' });
    expect(unknown.status).toBe(401);
    expect(unknown.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('serves /api/auth/me for a valid token and rejects a missing or bad one', async () => {
    const email = uniqueEmail('me');
    const register = await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'Password123!', name: 'Me Person' });
    const token = register.body.data.accessToken;

    const ok = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(ok.status).toBe(200);
    expect(ok.body.data.user.email).toBe(email);

    const noAuth = await request(app).get('/api/auth/me');
    expect(noAuth.status).toBe(401);

    const badAuth = await request(app).get('/api/auth/me').set('Authorization', 'Bearer not-a-real-token');
    expect(badAuth.status).toBe(401);
  });

  it('exchanges a refresh cookie for a new access token', async () => {
    const email = uniqueEmail('refresh');
    const register = await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'Password123!', name: 'Refresh Person' });

    const cookie = register.headers['set-cookie'];
    const refreshed = await request(app).post('/api/auth/refresh').set('Cookie', cookie);

    expect(refreshed.status).toBe(200);
    expect(refreshed.body.data.accessToken).toEqual(expect.any(String));
  });

  it('rejects a refresh with no cookie at all', async () => {
    const res = await request(app).post('/api/auth/refresh');
    expect(res.status).toBe(401);
  });

  // The login/register rate limit is exercised in its own file
  // (rateLimit.test.ts) — it shares one process-wide counter across every
  // request in this file, so testing it here would make every test after it
  // order-dependent on exactly how many requests came before.
});
