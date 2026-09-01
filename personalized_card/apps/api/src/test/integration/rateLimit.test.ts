import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, uniqueEmail } from '../helpers';

/**
 * The login/register limiter (10 requests / 15 minutes, shared across both
 * routes — see apps/api/src/routes/auth.routes.ts) counts every request from
 * this process regardless of outcome, for the lifetime of the module. That
 * makes it order-sensitive, so it gets a file of its own: vitest gives every
 * test file a fresh module graph, which means a fresh, empty counter here —
 * nothing this file does can be thrown off by what auth.test.ts already sent.
 */
describe('auth rate limiting', () => {
  it('blocks further login/register attempts once the shared limit is hit', async () => {
    const email = uniqueEmail('ratelimited');

    const results: number[] = [];
    for (let i = 0; i < 11; i += 1) {
      // eslint-disable-next-line no-await-in-loop -- deliberately sequential, not concurrent
      const res = await request(app).post('/api/auth/login').send({ email, password: 'WrongPassword1' });
      results.push(res.status);
    }

    // The first 10 fail on their own merits (no such account); the 11th never
    // reaches the login handler at all.
    expect(results.slice(0, 10).every((status) => status === 401)).toBe(true);
    expect(results[10]).toBe(429);
  });
});
