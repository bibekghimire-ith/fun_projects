import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  app,
  authHeader,
  createExperience,
  prisma,
  registerUser,
  resetDb,
  type TestUser,
} from '../helpers';

describe('experience config (microcopy + feature toggles)', () => {
  let owner: TestUser;
  let stranger: TestUser;
  let experienceId: string;

  beforeAll(async () => {
    await resetDb();
    owner = await registerUser({ email: 'owner-config@example.test' });
    stranger = await registerUser({ email: 'stranger-config@example.test' });
    experienceId = (await createExperience(owner.accessToken)).id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates a default config row the first time it is asked for', async () => {
    const res = await request(app)
      .get(`/api/experiences/${experienceId}/config`)
      .set(authHeader(owner.accessToken));

    expect(res.status).toBe(200);
    expect(res.body.data.navigationMode).toBe('SCROLL');
    expect(res.body.data.musicVolume).toBe(60);
    expect(res.body.data.copy).toEqual({});
    expect(res.body.data.features).toEqual({});
  });

  it('merges copy and feature overrides instead of replacing the whole map', async () => {
    const first = await request(app)
      .put(`/api/experiences/${experienceId}/config`)
      .set(authHeader(owner.accessToken))
      .send({
        copy: { 'welcome.greeting': 'Hey {recipient}!' },
        features: { music: false },
      });
    expect(first.status).toBe(200);
    expect(first.body.data.copy).toEqual({ 'welcome.greeting': 'Hey {recipient}!' });
    expect(first.body.data.features).toEqual({ music: false });

    const second = await request(app)
      .put(`/api/experiences/${experienceId}/config`)
      .set(authHeader(owner.accessToken))
      .send({
        copy: { 'closing.title': 'The end, for now.' },
        navigationMode: 'CHAPTERS',
      });
    expect(second.status).toBe(200);
    // Both copy keys survive — the second call added one, it didn't replace the map.
    expect(second.body.data.copy).toEqual({
      'welcome.greeting': 'Hey {recipient}!',
      'closing.title': 'The end, for now.',
    });
    expect(second.body.data.features).toEqual({ music: false });
    expect(second.body.data.navigationMode).toBe('CHAPTERS');
  });

  it('treats an empty-string copy value as "reset this key to the default"', async () => {
    const res = await request(app)
      .put(`/api/experiences/${experienceId}/config`)
      .set(authHeader(owner.accessToken))
      .send({ copy: { 'welcome.greeting': '' } });

    expect(res.status).toBe(200);
    expect(res.body.data.copy).not.toHaveProperty('welcome.greeting');
    expect(res.body.data.copy).toHaveProperty('closing.title');
  });

  it('drops unknown copy and feature keys rather than storing them', async () => {
    const res = await request(app)
      .put(`/api/experiences/${experienceId}/config`)
      .set(authHeader(owner.accessToken))
      .send({
        copy: { 'not.a.real.key': 'ignored' },
        features: { notARealFeature: true },
      });

    expect(res.status).toBe(200);
    expect(res.body.data.copy).not.toHaveProperty('not.a.real.key');
    expect(res.body.data.features).not.toHaveProperty('notARealFeature');
  });

  it("refuses to read or write another creator's config", async () => {
    const read = await request(app)
      .get(`/api/experiences/${experienceId}/config`)
      .set(authHeader(stranger.accessToken));
    expect(read.status).toBe(403);

    const write = await request(app)
      .put(`/api/experiences/${experienceId}/config`)
      .set(authHeader(stranger.accessToken))
      .send({ musicVolume: 0 });
    expect(write.status).toBe(403);
  });
});
