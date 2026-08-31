import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
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
} from '../helpers';

describe('experiences', () => {
  let owner: TestUser;
  let stranger: TestUser;

  beforeAll(async () => {
    await resetDb();
    owner = await registerUser({ email: 'owner-experience@example.test' });
    stranger = await registerUser({ email: 'stranger-experience@example.test' });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates, lists, reads, updates and deletes an experience for its owner', async () => {
    const created = await createExperience(owner.accessToken, { title: 'For Sam', recipientName: 'Sam' });
    expect(created.title).toBe('For Sam');
    expect(created.status).toBe('DRAFT');
    expect(created.publicToken).toEqual(expect.any(String));
    expect(created.publicToken.length).toBeGreaterThanOrEqual(20);

    const list = await request(app).get('/api/experiences').set(authHeader(owner.accessToken));
    expect(list.status).toBe(200);
    expect(list.body.data.some((e: { id: string }) => e.id === created.id)).toBe(true);

    const got = await request(app).get(`/api/experiences/${created.id}`).set(authHeader(owner.accessToken));
    expect(got.status).toBe(200);
    expect(got.body.data.id).toBe(created.id);

    const updated = await request(app)
      .patch(`/api/experiences/${created.id}`)
      .set(authHeader(owner.accessToken))
      .send({ title: 'For Sam, Updated' });
    expect(updated.status).toBe(200);
    expect(updated.body.data.title).toBe('For Sam, Updated');

    const deleted = await request(app)
      .delete(`/api/experiences/${created.id}`)
      .set(authHeader(owner.accessToken));
    expect(deleted.status).toBe(200);

    const afterDelete = await request(app)
      .get(`/api/experiences/${created.id}`)
      .set(authHeader(owner.accessToken));
    expect(afterDelete.status).toBe(404);
  });

  it("never lets one creator see, edit or delete another creator's experience", async () => {
    const created = await createExperience(owner.accessToken, { title: 'Private', recipientName: 'Sam' });

    const read = await request(app)
      .get(`/api/experiences/${created.id}`)
      .set(authHeader(stranger.accessToken));
    expect(read.status).toBe(403);
    expect(read.body.error.code).toBe('FORBIDDEN');

    const write = await request(app)
      .patch(`/api/experiences/${created.id}`)
      .set(authHeader(stranger.accessToken))
      .send({ title: 'Hijacked' });
    expect(write.status).toBe(403);

    const del = await request(app)
      .delete(`/api/experiences/${created.id}`)
      .set(authHeader(stranger.accessToken));
    expect(del.status).toBe(403);

    // The owner's copy is untouched by any of the above.
    const stillThere = await request(app)
      .get(`/api/experiences/${created.id}`)
      .set(authHeader(owner.accessToken));
    expect(stillThere.status).toBe(200);
    expect(stillThere.body.data.title).toBe('Private');
  });

  it('returns 404, not 403, for an experience id that never existed', async () => {
    const res = await request(app)
      .get('/api/experiences/00000000-0000-0000-0000-000000000000')
      .set(authHeader(owner.accessToken));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('EXPERIENCE_NOT_FOUND');
  });

  it('rejects every experience route without a bearer token', async () => {
    const created = await createExperience(owner.accessToken);
    const paths = [
      ['get', `/api/experiences/${created.id}`],
      ['patch', `/api/experiences/${created.id}`],
      ['delete', `/api/experiences/${created.id}`],
      ['get', '/api/experiences'],
    ] as const;

    for (const [method, path] of paths) {
      // eslint-disable-next-line no-await-in-loop
      const res = await request(app)[method](path);
      expect(res.status).toBe(401);
    }
  });

  it('reports what is missing from the publish check, then publishes once it is all there', async () => {
    const created = await createExperience(owner.accessToken, { title: 'Almost Ready' });

    const firstCheck = await request(app)
      .get(`/api/experiences/${created.id}/publish-check`)
      .set(authHeader(owner.accessToken));
    expect(firstCheck.status).toBe(200);
    expect(firstCheck.body.data.ok).toBe(false);
    expect(firstCheck.body.data.issues.map((i: { code: string }) => i.code)).toEqual(
      expect.arrayContaining(['MISSING_COVER', 'NO_CONTENT']),
    );

    await addMinimalContent(owner.accessToken, created.id);

    const secondCheck = await request(app)
      .get(`/api/experiences/${created.id}/publish-check`)
      .set(authHeader(owner.accessToken));
    // A cover is still missing, but allowWithoutCover waives exactly that one.
    expect(secondCheck.body.data.issues.map((i: { code: string }) => i.code)).toEqual(['MISSING_COVER']);

    const published = await publishExperience(owner.accessToken, created.id, { allowWithoutCover: true });
    expect(published.status).toBe('PUBLISHED');
  });

  it('refuses to publish while real issues remain, and reports them', async () => {
    const created = await createExperience(owner.accessToken, { title: 'Empty Letter' });

    const res = await request(app)
      .post(`/api/experiences/${created.id}/publish`)
      .set(authHeader(owner.accessToken))
      .send({ allowWithoutCover: true });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('NOT_READY');
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'NO_CONTENT' })]),
    );
  });

  it('generates non-sequential public tokens that do not reveal creation order', async () => {
    const first = await createExperience(owner.accessToken);
    const second = await createExperience(owner.accessToken);

    expect(first.publicToken).not.toBe(second.publicToken);
    // nanoid(32) over its default alphabet — long, URL-safe, and not a
    // sequential or otherwise guessable id.
    expect(first.publicToken).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(second.publicToken).toMatch(/^[A-Za-z0-9_-]{32}$/);
  });

  it('lets an owner set and clear a PIN, and duplicate an experience', async () => {
    const created = await createExperience(owner.accessToken, { title: 'PIN Party' });

    const setPin = await request(app)
      .post(`/api/experiences/${created.id}/pin`)
      .set(authHeader(owner.accessToken))
      .send({ pin: '1234' });
    expect(setPin.status).toBe(200);
    expect(setPin.body.data.pinEnabled).toBe(true);

    const clearPin = await request(app)
      .delete(`/api/experiences/${created.id}/pin`)
      .set(authHeader(owner.accessToken));
    expect(clearPin.status).toBe(200);
    expect(clearPin.body.data.pinEnabled).toBe(false);

    const duplicate = await request(app)
      .post(`/api/experiences/${created.id}/duplicate`)
      .set(authHeader(owner.accessToken));
    expect(duplicate.status).toBe(201);
    expect(duplicate.body.data.id).not.toBe(created.id);
    expect(duplicate.body.data.title).toContain('PIN Party');
  });
});
