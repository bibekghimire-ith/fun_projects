import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  app,
  authHeader,
  createBuiltInTheme,
  prisma,
  registerUser,
  resetDb,
  type TestUser,
} from '../helpers';

const VALID_THEME = {
  name: 'My Custom Theme',
  primaryColor: '#123456',
  secondaryColor: '#abcdef',
  backgroundColor: '#ffffff',
  surfaceColor: '#f5f5f5',
  textColor: '#000000',
};

describe('themes', () => {
  let owner: TestUser;
  let stranger: TestUser;
  let builtIn: { id: string; slug: string };

  beforeAll(async () => {
    await resetDb();
    owner = await registerUser({ email: 'owner-theme@example.test' });
    stranger = await registerUser({ email: 'stranger-theme@example.test' });
    builtIn = await createBuiltInTheme({ name: 'Midnight', slug: 'midnight-theme-test' });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('lists built-in themes without auth, and adds the caller\'s own when signed in', async () => {
    const anon = await request(app).get('/api/themes');
    expect(anon.status).toBe(200);
    expect(anon.body.data.some((t: { id: string }) => t.id === builtIn.id)).toBe(true);

    const created = await request(app)
      .post('/api/themes')
      .set(authHeader(owner.accessToken))
      .send(VALID_THEME);
    expect(created.status).toBe(201);
    expect(created.body.data.isBuiltIn).toBe(false);

    const anonAfter = await request(app).get('/api/themes');
    expect(anonAfter.body.data.some((t: { id: string }) => t.id === created.body.data.id)).toBe(false);

    const signedIn = await request(app).get('/api/themes').set(authHeader(owner.accessToken));
    expect(signedIn.body.data.some((t: { id: string }) => t.id === created.body.data.id)).toBe(true);

    const strangerView = await request(app).get('/api/themes').set(authHeader(stranger.accessToken));
    expect(strangerView.body.data.some((t: { id: string }) => t.id === created.body.data.id)).toBe(false);
  });

  it('rejects a theme with an unsafe color or custom CSS', async () => {
    const badColor = await request(app)
      .post('/api/themes')
      .set(authHeader(owner.accessToken))
      .send({ ...VALID_THEME, primaryColor: 'not-a-color' });
    expect(badColor.status).toBe(400);

    const badCss = await request(app)
      .post('/api/themes')
      .set(authHeader(owner.accessToken))
      .send({ ...VALID_THEME, customCss: 'body { background: url(javascript:alert(1)); }' });
    expect(badCss.status).toBe(400);
  });

  it('forks a built-in theme into an editable copy', async () => {
    const forked = await request(app)
      .post('/api/themes/fork')
      .set(authHeader(owner.accessToken))
      .send({ themeId: builtIn.id, name: 'My Midnight' });

    expect(forked.status).toBe(201);
    expect(forked.body.data.isBuiltIn).toBe(false);
    expect(forked.body.data.primaryColor).toBe('#111111');
    expect(forked.body.data.id).not.toBe(builtIn.id);
  });

  it('never lets a built-in theme be edited or deleted, by anyone', async () => {
    const update = await request(app)
      .patch(`/api/themes/${builtIn.id}`)
      .set(authHeader(owner.accessToken))
      .send({ name: 'Renamed' });
    expect(update.status).toBe(403);
    expect(update.body.error.code).toBe('THEME_IMMUTABLE');

    const del = await request(app)
      .delete(`/api/themes/${builtIn.id}`)
      .set(authHeader(owner.accessToken));
    expect(del.status).toBe(403);
  });

  it("keeps one creator's custom theme private from edits by anyone else", async () => {
    const created = await request(app)
      .post('/api/themes')
      .set(authHeader(owner.accessToken))
      .send(VALID_THEME);

    const hijack = await request(app)
      .patch(`/api/themes/${created.body.data.id}`)
      .set(authHeader(stranger.accessToken))
      .send({ name: 'Not Yours' });
    expect(hijack.status).toBe(403);
    expect(hijack.body.error.code).toBe('FORBIDDEN');

    const update = await request(app)
      .patch(`/api/themes/${created.body.data.id}`)
      .set(authHeader(owner.accessToken))
      .send({ name: 'Renamed By Owner' });
    expect(update.status).toBe(200);
    expect(update.body.data.name).toBe('Renamed By Owner');

    const deleted = await request(app)
      .delete(`/api/themes/${created.body.data.id}`)
      .set(authHeader(owner.accessToken));
    expect(deleted.status).toBe(200);
  });

  it('falls an experience back to no theme when its theme is deleted', async () => {
    const theme = await request(app)
      .post('/api/themes')
      .set(authHeader(owner.accessToken))
      .send(VALID_THEME);

    const exp = await request(app)
      .post('/api/experiences')
      .set(authHeader(owner.accessToken))
      .send({ title: 'Themed', recipientName: 'Sam', eventType: 'BIRTHDAY' });

    await request(app)
      .post(`/api/experiences/${exp.body.data.id}/theme`)
      .set(authHeader(owner.accessToken))
      .send({ themeId: theme.body.data.id });

    await request(app).delete(`/api/themes/${theme.body.data.id}`).set(authHeader(owner.accessToken));

    const after = await request(app)
      .get(`/api/experiences/${exp.body.data.id}`)
      .set(authHeader(owner.accessToken));
    expect(after.body.data.themeId).toBeNull();
  });
});
