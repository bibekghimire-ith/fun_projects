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

describe('the builder: sections and blocks', () => {
  let owner: TestUser;
  let stranger: TestUser;
  let experienceId: string;

  beforeAll(async () => {
    await resetDb();
    owner = await registerUser({ email: 'owner-builder@example.test' });
    stranger = await registerUser({ email: 'stranger-builder@example.test' });
    experienceId = (await createExperience(owner.accessToken, { title: 'The Builder Test' })).id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates, updates, reorders and deletes sections', async () => {
    const s1 = await request(app)
      .post(`/api/experiences/${experienceId}/sections`)
      .set(authHeader(owner.accessToken))
      .send({ title: 'First' });
    expect(s1.status).toBe(201);

    const s2 = await request(app)
      .post(`/api/experiences/${experienceId}/sections`)
      .set(authHeader(owner.accessToken))
      .send({ title: 'Second' });
    expect(s2.status).toBe(201);
    expect(s2.body.data.order).toBe(1);

    const list = await request(app)
      .get(`/api/experiences/${experienceId}/sections`)
      .set(authHeader(owner.accessToken));
    expect(list.body.data.map((s: { title: string }) => s.title)).toEqual(['First', 'Second']);

    const reordered = await request(app)
      .post(`/api/experiences/${experienceId}/sections/reorder`)
      .set(authHeader(owner.accessToken))
      .send({ ids: [s2.body.data.id, s1.body.data.id] });
    expect(reordered.status).toBe(200);

    const afterReorder = await request(app)
      .get(`/api/experiences/${experienceId}/sections`)
      .set(authHeader(owner.accessToken));
    expect(afterReorder.body.data.map((s: { title: string }) => s.title)).toEqual(['Second', 'First']);

    const disabled = await request(app)
      .patch(`/api/sections/${s1.body.data.id}`)
      .set(authHeader(owner.accessToken))
      .send({ enabled: false });
    expect(disabled.status).toBe(200);
    expect(disabled.body.data.enabled).toBe(false);

    const deleted = await request(app)
      .delete(`/api/sections/${s2.body.data.id}`)
      .set(authHeader(owner.accessToken));
    expect(deleted.status).toBe(200);

    const missing = await request(app)
      .patch(`/api/sections/${s2.body.data.id}`)
      .set(authHeader(owner.accessToken))
      .send({ title: 'Ghost' });
    expect(missing.status).toBe(404);
  });

  it("refuses section access to anyone but the experience's owner", async () => {
    const section = await request(app)
      .post(`/api/experiences/${experienceId}/sections`)
      .set(authHeader(owner.accessToken))
      .send({ title: 'Owner Only' });

    const res = await request(app)
      .patch(`/api/sections/${section.body.data.id}`)
      .set(authHeader(stranger.accessToken))
      .send({ title: 'Hijacked' });
    expect(res.status).toBe(403);

    const list = await request(app)
      .get(`/api/experiences/${experienceId}/sections`)
      .set(authHeader(stranger.accessToken));
    expect(list.status).toBe(403);
  });

  it('creates, validates, updates, reorders and deletes blocks', async () => {
    const section = await request(app)
      .post(`/api/experiences/${experienceId}/sections`)
      .set(authHeader(owner.accessToken))
      .send({ title: 'Block Playground' });
    const sectionId = section.body.data.id;

    const badBlock = await request(app)
      .post(`/api/sections/${sectionId}/blocks`)
      .set(authHeader(owner.accessToken))
      .send({ type: 'HEADING', content: { level: 99 } });
    expect(badBlock.status).toBe(400);
    expect(badBlock.body.error.code).toBe('VALIDATION_ERROR');

    const b1 = await request(app)
      .post(`/api/sections/${sectionId}/blocks`)
      .set(authHeader(owner.accessToken))
      .send({ type: 'TEXT', content: { text: 'First block' } });
    expect(b1.status).toBe(201);
    expect(b1.body.data.order).toBe(0);

    const b2 = await request(app)
      .post(`/api/sections/${sectionId}/blocks`)
      .set(authHeader(owner.accessToken))
      .send({ type: 'QUOTE', content: { text: 'Something memorable' } });
    expect(b2.status).toBe(201);

    const updated = await request(app)
      .patch(`/api/blocks/${b1.body.data.id}`)
      .set(authHeader(owner.accessToken))
      .send({ content: { text: 'Edited block' } });
    expect(updated.status).toBe(200);
    expect(updated.body.data.content.text).toBe('Edited block');

    const reordered = await request(app)
      .post(`/api/sections/${sectionId}/blocks/reorder`)
      .set(authHeader(owner.accessToken))
      .send({ ids: [b2.body.data.id, b1.body.data.id] });
    expect(reordered.status).toBe(200);

    const list = await request(app)
      .get(`/api/sections/${sectionId}/blocks`)
      .set(authHeader(owner.accessToken));
    expect(list.body.data.map((b: { id: string }) => b.id)).toEqual([b2.body.data.id, b1.body.data.id]);

    const deleted = await request(app)
      .delete(`/api/blocks/${b1.body.data.id}`)
      .set(authHeader(owner.accessToken));
    expect(deleted.status).toBe(200);

    const remaining = await request(app)
      .get(`/api/sections/${sectionId}/blocks`)
      .set(authHeader(owner.accessToken));
    expect(remaining.body.data.map((b: { id: string }) => b.id)).toEqual([b2.body.data.id]);
  });

  it('appends a block preset to the end of a section', async () => {
    const section = await request(app)
      .post(`/api/experiences/${experienceId}/sections`)
      .set(authHeader(owner.accessToken))
      .send({ title: 'Preset Playground' });

    const applied = await request(app)
      .post(`/api/sections/${section.body.data.id}/apply-preset`)
      .set(authHeader(owner.accessToken))
      .send({ slug: 'chapter-opener' });

    expect(applied.status).toBe(201);
    expect(applied.body.data).toHaveLength(2);
    expect(applied.body.data.map((b: { type: string }) => b.type)).toEqual(['HEADING', 'TEXT']);
  });

  it('404s for an unknown preset slug', async () => {
    const section = await request(app)
      .post(`/api/experiences/${experienceId}/sections`)
      .set(authHeader(owner.accessToken))
      .send({ title: 'No Preset Here' });

    const res = await request(app)
      .post(`/api/sections/${section.body.data.id}/apply-preset`)
      .set(authHeader(owner.accessToken))
      .send({ slug: 'not-a-real-preset' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PRESET_NOT_FOUND');
  });
});
