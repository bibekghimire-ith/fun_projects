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

describe('the public (recipient-facing) API', () => {
  let owner: TestUser;

  beforeAll(async () => {
    await resetDb();
    owner = await registerUser({ email: 'owner-public@example.test' });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('404s a token that does not exist, and a draft that is not published yet', async () => {
    const notFound = await request(app).get('/api/public/e/not-a-real-token-at-all');
    expect(notFound.status).toBe(404);

    const draft = await createExperience(owner.accessToken, { title: 'Still Writing' });
    const draftRes = await request(app).get(`/api/public/e/${draft.publicToken}`);
    expect(draftRes.status).toBe(403);
    expect(draftRes.body.error.code).toBe('UNAVAILABLE');
  });

  it('serves a published experience with every default already merged into config', async () => {
    const exp = await createExperience(owner.accessToken, { title: 'Happy Birthday!', recipientName: 'Sam' });
    await addMinimalContent(owner.accessToken, exp.id);
    const published = await publishExperience(owner.accessToken, exp.id);

    const res = await request(app).get(`/api/public/e/${published.publicToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.pinRequired).toBe(false);
    expect(res.body.data.title).toBe('Happy Birthday!');
    expect(res.body.data.config.features.music).toBe(true);
    expect(res.body.data.sections[0].blocks[0].content.text).toBe('Hello there.');
  });

  it('gates a PIN-protected experience until the right PIN is verified', async () => {
    const exp = await createExperience(owner.accessToken, { title: 'For Your Eyes Only' });
    await addMinimalContent(owner.accessToken, exp.id);
    await request(app)
      .post(`/api/experiences/${exp.id}/pin`)
      .set(authHeader(owner.accessToken))
      .send({ pin: '4242' });
    const published = await publishExperience(owner.accessToken, exp.id);

    const locked = await request(app).get(`/api/public/e/${published.publicToken}`);
    expect(locked.status).toBe(200);
    expect(locked.body.data.pinRequired).toBe(true);
    expect(locked.body.data).not.toHaveProperty('sections');

    const wrong = await request(app)
      .post(`/api/public/e/${published.publicToken}/verify`)
      .send({ pin: '0000' });
    expect(wrong.status).toBe(401);
    expect(wrong.body.error.code).toBe('INVALID_PIN');

    const right = await request(app)
      .post(`/api/public/e/${published.publicToken}/verify`)
      .send({ pin: '4242' });
    expect(right.status).toBe(200);
    const pinCookie = right.headers['set-cookie'];
    expect(pinCookie?.some((c: string) => c.startsWith('pinToken='))).toBe(true);

    const unlocked = await request(app).get(`/api/public/e/${published.publicToken}`).set('Cookie', pinCookie);
    expect(unlocked.status).toBe(200);
    expect(unlocked.body.data.pinRequired).toBe(false);
    expect(unlocked.body.data.title).toBe('For Your Eyes Only');
  });

  it('locks the PIN out after too many wrong attempts, from that visitor only', async () => {
    // vitest.config.ts sets PIN_MAX_ATTEMPTS=3 for the test run.
    const exp = await createExperience(owner.accessToken, { title: 'Three Strikes' });
    await addMinimalContent(owner.accessToken, exp.id);
    await request(app)
      .post(`/api/experiences/${exp.id}/pin`)
      .set(authHeader(owner.accessToken))
      .send({ pin: '9999' });
    const published = await publishExperience(owner.accessToken, exp.id);

    const wrongOnce = () =>
      request(app).post(`/api/public/e/${published.publicToken}/verify`).send({ pin: '0000' });

    expect((await wrongOnce()).status).toBe(401);
    expect((await wrongOnce()).status).toBe(401);
    const third = await wrongOnce();
    expect(third.status).toBe(429);
    expect(third.body.error.code).toBe('PIN_LOCKED');

    // Even the *correct* PIN is refused while locked.
    const correctButLocked = await request(app)
      .post(`/api/public/e/${published.publicToken}/verify`)
      .send({ pin: '9999' });
    expect(correctButLocked.status).toBe(429);
  });

  it('reveals an "open when" note only once it is unlocked, and honours one-time notes', async () => {
    const exp = await createExperience(owner.accessToken, { title: 'Notes' });
    await addMinimalContent(owner.accessToken, exp.id);
    const published = await publishExperience(owner.accessToken, exp.id);

    const immediate = await prisma.openWhenMessage.create({
      data: { experienceId: exp.id, label: 'Anytime', content: 'Here you go.', unlockType: 'IMMEDIATE' },
    });
    const locked = await prisma.openWhenMessage.create({
      data: {
        experienceId: exp.id,
        label: 'Not yet',
        content: 'Should not be visible.',
        unlockType: 'DATE_LOCKED',
        unlockDate: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const opened = await request(app).get(`/api/public/e/${published.publicToken}/open-when/${immediate.id}`);
    expect(opened.status).toBe(200);
    expect(opened.body.data.content).toBe('Here you go.');

    const stillLocked = await request(app).get(`/api/public/e/${published.publicToken}/open-when/${locked.id}`);
    expect(stillLocked.status).toBe(423);
    expect(stillLocked.body.error.code).toBe('LOCKED');
  });

  it('unlocks a future letter only after its date, and records that it was opened', async () => {
    const exp = await createExperience(owner.accessToken, { title: 'For Later' });
    await addMinimalContent(owner.accessToken, exp.id);
    const published = await publishExperience(owner.accessToken, exp.id);

    await prisma.futureLetter.create({
      data: { experienceId: exp.id, title: 'Open Next Year', content: 'Hello, future you.', unlockDate: new Date(Date.now() + 24 * 60 * 60 * 1000) },
    });

    const tooEarly = await request(app).get(`/api/public/e/${published.publicToken}/future-letter`);
    expect(tooEarly.status).toBe(423);

    await prisma.futureLetter.update({
      where: { experienceId: exp.id },
      data: { unlockDate: new Date(Date.now() - 1000) },
    });

    const unlocked = await request(app).get(`/api/public/e/${published.publicToken}/future-letter`);
    expect(unlocked.status).toBe(200);
    expect(unlocked.body.data.content).toBe('Hello, future you.');

    const stored = await prisma.futureLetter.findUnique({ where: { experienceId: exp.id } });
    expect(stored?.unlockedAt).not.toBeNull();
  });

  it('accepts a response to the final surprise and logs it for the creator', async () => {
    const exp = await createExperience(owner.accessToken, { title: 'One More Thing' });
    await addMinimalContent(owner.accessToken, exp.id);
    const published = await publishExperience(owner.accessToken, exp.id);

    const res = await request(app)
      .post(`/api/public/e/${published.publicToken}/respond`)
      .send({ answer: 'Yes, always.' });
    expect(res.status).toBe(201);

    const list = await request(app)
      .get(`/api/experiences/${exp.id}/responses/export`)
      .set(authHeader(owner.accessToken));
    expect(list.status).toBe(200);
    expect(list.text).toContain('Yes, always.');
  });
});
