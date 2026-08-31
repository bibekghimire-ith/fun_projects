import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, authHeader, prisma, registerUser, resetDb, type TestUser } from '../helpers';

describe('templates and presets', () => {
  let owner: TestUser;

  beforeAll(async () => {
    await resetDb();
    owner = await registerUser({ email: 'owner-template@example.test' });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('lists templates and presets without any authentication', async () => {
    const templates = await request(app).get('/api/templates');
    expect(templates.status).toBe(200);
    expect(templates.body.data.length).toBeGreaterThan(0);
    expect(templates.body.data.map((t: { slug: string }) => t.slug)).toEqual(
      expect.arrayContaining(['birthday-classic', 'anniversary-timeline', 'blank-canvas']),
    );

    const one = await request(app).get('/api/templates/birthday-classic');
    expect(one.status).toBe(200);
    expect(one.body.data.slug).toBe('birthday-classic');
    expect(one.body.data.sections.length).toBeGreaterThan(0);

    const presets = await request(app).get('/api/templates/presets');
    expect(presets.status).toBe(200);
    expect(presets.body.data.length).toBeGreaterThan(0);

    const preset = await request(app).get('/api/templates/presets/chapter-opener');
    expect(preset.status).toBe(200);
    expect(preset.body.data.slug).toBe('chapter-opener');
  });

  it('404s for an unknown template slug', async () => {
    const res = await request(app).get('/api/templates/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('TEMPLATE_NOT_FOUND');
  });

  it('creates a whole experience from a template in one call', async () => {
    // The template names a built-in theme by slug; without it seeded, the
    // service should still succeed and simply leave the experience themeless.
    const res = await request(app)
      .post('/api/experiences')
      .set(authHeader(owner.accessToken))
      .send({
        title: 'Ignored — the template supplies its own',
        recipientName: 'Priya',
        eventType: 'ANNIVERSARY',
        templateSlug: 'anniversary-timeline',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.templateSlug).toBe('anniversary-timeline');
    expect(res.body.data.sections.length).toBeGreaterThan(0);
    expect(res.body.data.sections[0].blocks.length).toBeGreaterThan(0);
    expect(res.body.data.memories.length).toBeGreaterThan(0);
    expect(res.body.data.config).toBeTruthy();
    expect(res.body.data.config.navigationMode).toBe('CHAPTERS');
  });

  it('rejects experience creation with an unknown template slug before creating anything', async () => {
    const before = await prisma.experience.count({ where: { userId: owner.userId } });

    const res = await request(app)
      .post('/api/experiences')
      .set(authHeader(owner.accessToken))
      .send({
        title: 'Should never exist',
        recipientName: 'Nobody',
        eventType: 'CUSTOM',
        templateSlug: 'not-a-real-template',
      });

    expect(res.status).toBe(404);

    const after = await prisma.experience.count({ where: { userId: owner.userId } });
    expect(after).toBe(before);
  });

  it('applies a template to an existing experience, in REPLACE and APPEND modes', async () => {
    const created = await request(app)
      .post('/api/experiences')
      .set(authHeader(owner.accessToken))
      .send({ title: 'Blank Start', recipientName: 'Sam', eventType: 'BIRTHDAY' });
    const experienceId = created.body.data.id;

    await request(app)
      .post(`/api/experiences/${experienceId}/sections`)
      .set(authHeader(owner.accessToken))
      .send({ title: 'Hand-written section' });

    const replaced = await request(app)
      .post(`/api/experiences/${experienceId}/apply-template`)
      .set(authHeader(owner.accessToken))
      .send({ slug: 'birthday-classic', mode: 'REPLACE', includeTheme: false, includeConfig: false, includeExtras: false });

    expect(replaced.status).toBe(200);
    expect(replaced.body.data.sections.some((s: { title: string }) => s.title === 'Hand-written section')).toBe(
      false,
    );
    const replacedSectionCount = replaced.body.data.sections.length;

    const appended = await request(app)
      .post(`/api/experiences/${experienceId}/apply-template`)
      .set(authHeader(owner.accessToken))
      .send({ slug: 'birthday-classic', mode: 'APPEND', includeTheme: false, includeConfig: false, includeExtras: false });

    expect(appended.status).toBe(200);
    expect(appended.body.data.sections.length).toBe(replacedSectionCount * 2);
  });

  it("refuses to stamp a template onto another creator's experience", async () => {
    const stranger = await registerUser({ email: 'stranger-template@example.test' });
    const created = await request(app)
      .post('/api/experiences')
      .set(authHeader(owner.accessToken))
      .send({ title: 'Owner Only', recipientName: 'Sam', eventType: 'BIRTHDAY' });

    const res = await request(app)
      .post(`/api/experiences/${created.body.data.id}/apply-template`)
      .set(authHeader(stranger.accessToken))
      .send({ slug: 'birthday-classic' });

    expect(res.status).toBe(403);
  });
});
