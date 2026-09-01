import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import {
  addMinimalContent,
  app,
  authHeader,
  createExperience,
  prisma,
  publishExperience,
  registerUser,
  resetDb,
  type TestUser,
} from './helpers';

describe('security', () => {
  let owner: TestUser;
  let stranger: TestUser;

  beforeAll(async () => {
    await resetDb();
    owner = await registerUser({ email: 'owner-security@example.test' });
    stranger = await registerUser({ email: 'stranger-security@example.test' });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('rejects a token whose payload was tampered with after signing', async () => {
    const [header, payload, signature] = owner.accessToken.split('.');
    const forgedPayload = Buffer.from(
      JSON.stringify({ userId: stranger.userId, email: stranger.email }),
    ).toString('base64url');
    const forged = `${header}.${forgedPayload}.${signature}`;

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${forged}`);
    expect(res.status).toBe(401);
  });

  it('rejects a token signed with the wrong secret', async () => {
    const forged = jwt.sign({ userId: owner.userId, email: owner.email }, 'some-other-secret-entirely');
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${forged}`);
    expect(res.status).toBe(401);
  });

  it('rejects an expired token', async () => {
    const expired = jwt.sign(
      { userId: owner.userId, email: owner.email },
      config.JWT_SECRET,
      { expiresIn: -10 },
    );
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
  });

  it('rejects a token for a user that no longer exists', async () => {
    const ghost = await registerUser({ email: 'ghost-security@example.test' });
    await prisma.user.delete({ where: { id: ghost.userId } });

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${ghost.accessToken}`);
    expect(res.status).toBe(401);
  });

  it('accepts the PIN token as a header (x-pin-token), not only as a cookie', async () => {
    const exp = await createExperience(owner.accessToken, { title: 'Header Token' });
    await addMinimalContent(owner.accessToken, exp.id);
    await request(app)
      .post(`/api/experiences/${exp.id}/pin`)
      .set(authHeader(owner.accessToken))
      .send({ pin: '1357' });
    const published = await publishExperience(owner.accessToken, exp.id);

    const verify = await request(app)
      .post(`/api/public/e/${published.publicToken}/verify`)
      .send({ pin: '1357' });
    const pinToken = verify.body.data.pinToken;
    expect(pinToken).toEqual(expect.any(String));

    const viaHeader = await request(app)
      .get(`/api/public/e/${published.publicToken}`)
      .set('x-pin-token', pinToken);
    expect(viaHeader.status).toBe(200);
    expect(viaHeader.body.data.pinRequired).toBe(false);
  });

  it('never lets a PIN token for one experience unlock a different one', async () => {
    const a = await createExperience(owner.accessToken, { title: 'Letter A' });
    await addMinimalContent(owner.accessToken, a.id);
    await request(app).post(`/api/experiences/${a.id}/pin`).set(authHeader(owner.accessToken)).send({ pin: '1111' });
    const publishedA = await publishExperience(owner.accessToken, a.id);

    const b = await createExperience(owner.accessToken, { title: 'Letter B' });
    await addMinimalContent(owner.accessToken, b.id);
    await request(app).post(`/api/experiences/${b.id}/pin`).set(authHeader(owner.accessToken)).send({ pin: '2222' });
    const publishedB = await publishExperience(owner.accessToken, b.id);

    const verifyA = await request(app)
      .post(`/api/public/e/${publishedA.publicToken}/verify`)
      .send({ pin: '1111' });

    const crossUse = await request(app)
      .get(`/api/public/e/${publishedB.publicToken}`)
      .set('x-pin-token', verifyA.body.data.pinToken);

    expect(crossUse.status).toBe(200);
    expect(crossUse.body.data.pinRequired).toBe(true);
  });

  it('keeps memories and open-when notes private to their experience\'s owner', async () => {
    const exp = await createExperience(owner.accessToken, { title: 'Private Notes' });

    const memory = await request(app)
      .post(`/api/experiences/${exp.id}/memories`)
      .set(authHeader(owner.accessToken))
      .send({ date: new Date().toISOString(), title: 'A memory' });
    expect(memory.status).toBe(201);

    const note = await request(app)
      .post(`/api/experiences/${exp.id}/open-when`)
      .set(authHeader(owner.accessToken))
      .send({ label: 'you miss me', content: 'Hi.' });
    expect(note.status).toBe(201);

    const strangerMemories = await request(app)
      .get(`/api/experiences/${exp.id}/memories`)
      .set(authHeader(stranger.accessToken));
    expect(strangerMemories.status).toBe(403);

    const strangerEditsMemory = await request(app)
      .patch(`/api/memories/${memory.body.data.id}`)
      .set(authHeader(stranger.accessToken))
      .send({ title: 'Hijacked' });
    expect(strangerEditsMemory.status).toBe(403);

    const strangerEditsNote = await request(app)
      .patch(`/api/open-when/${note.body.data.id}`)
      .set(authHeader(stranger.accessToken))
      .send({ label: 'hijacked' });
    expect(strangerEditsNote.status).toBe(403);
  });

  it('sends the standard hardening headers helmet adds', async () => {
    const res = await request(app).get('/health');
    expect(res.headers).toHaveProperty('x-content-type-options', 'nosniff');
    expect(res.headers).not.toHaveProperty('x-powered-by');
  });
});
