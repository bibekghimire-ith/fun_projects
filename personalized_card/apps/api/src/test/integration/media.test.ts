import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  app,
  authHeader,
  createExperience,
  ONE_PX_PNG,
  prisma,
  publishExperience,
  registerUser,
  resetDb,
  type TestUser,
} from '../helpers';

describe('media', () => {
  let owner: TestUser;
  let stranger: TestUser;
  let experienceId: string;

  beforeAll(async () => {
    await resetDb();
    owner = await registerUser({ email: 'owner-media@example.test' });
    stranger = await registerUser({ email: 'stranger-media@example.test' });
    experienceId = (await createExperience(owner.accessToken)).id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('uploads an image, generates a thumbnail, and lists it back', async () => {
    const upload = await request(app)
      .post(`/api/experiences/${experienceId}/media/upload`)
      .set(authHeader(owner.accessToken))
      .attach('file', ONE_PX_PNG, { filename: 'pixel.png', contentType: 'image/png' });

    expect(upload.status).toBe(201);
    expect(upload.body.data.type).toBe('IMAGE');
    expect(upload.body.data.url).toEqual(expect.any(String));
    expect(upload.body.data.thumbnailUrl).toEqual(expect.any(String));

    const list = await request(app)
      .get(`/api/experiences/${experienceId}/media`)
      .set(authHeader(owner.accessToken));
    expect(list.status).toBe(200);
    expect(list.body.data.some((m: { id: string }) => m.id === upload.body.data.id)).toBe(true);
  });

  it('rejects a file type nothing in the app knows how to render', async () => {
    const res = await request(app)
      .post(`/api/experiences/${experienceId}/media/upload`)
      .set(authHeader(owner.accessToken))
      .attach('file', Buffer.from('#!/bin/sh\necho hi'), {
        filename: 'script.sh',
        contentType: 'application/x-sh',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_MIME');
  });

  it("refuses an upload to another creator's experience", async () => {
    const res = await request(app)
      .post(`/api/experiences/${experienceId}/media/upload`)
      .set(authHeader(stranger.accessToken))
      .attach('file', ONE_PX_PNG, { filename: 'pixel.png', contentType: 'image/png' });

    expect(res.status).toBe(403);
  });

  it("streams a draft's media to its owner, but not to a stranger or an anonymous request", async () => {
    const upload = await request(app)
      .post(`/api/experiences/${experienceId}/media/upload`)
      .set(authHeader(owner.accessToken))
      .attach('file', ONE_PX_PNG, { filename: 'pixel.png', contentType: 'image/png' });
    const mediaId = upload.body.data.id;

    const owned = await request(app)
      .get(`/api/media/${mediaId}/stream`)
      .set(authHeader(owner.accessToken));
    expect(owned.status).toBe(200);

    const anon = await request(app).get(`/api/media/${mediaId}/stream`);
    expect(anon.status).toBe(403);

    const asStranger = await request(app)
      .get(`/api/media/${mediaId}/stream`)
      .set(authHeader(stranger.accessToken));
    expect(asStranger.status).toBe(403);
  });

  it('hands the owner a scoped media token that unlocks the stream without a bearer header', async () => {
    const upload = await request(app)
      .post(`/api/experiences/${experienceId}/media/upload`)
      .set(authHeader(owner.accessToken))
      .attach('file', ONE_PX_PNG, { filename: 'pixel.png', contentType: 'image/png' });
    const mediaId = upload.body.data.id;

    const tokenRes = await request(app)
      .get(`/api/experiences/${experienceId}/media-token`)
      .set(authHeader(owner.accessToken));
    expect(tokenRes.status).toBe(200);
    const { token } = tokenRes.body.data;
    expect(token).toEqual(expect.any(String));

    const withToken = await request(app).get(`/api/media/${mediaId}/stream?mt=${token}`);
    expect(withToken.status).toBe(200);

    // A stranger cannot mint their own media token for someone else's experience.
    const strangerToken = await request(app)
      .get(`/api/experiences/${experienceId}/media-token`)
      .set(authHeader(stranger.accessToken));
    expect(strangerToken.status).toBe(403);
  });

  it('cannot be replayed against a different experience', async () => {
    const other = await createExperience(owner.accessToken, { title: 'A Different Letter' });
    const upload = await request(app)
      .post(`/api/experiences/${experienceId}/media/upload`)
      .set(authHeader(owner.accessToken))
      .attach('file', ONE_PX_PNG, { filename: 'pixel.png', contentType: 'image/png' });

    const tokenForThisExperience = await request(app)
      .get(`/api/experiences/${experienceId}/media-token`)
      .set(authHeader(owner.accessToken));

    // The token names `experienceId`; it says nothing about `other.id`, whose
    // media it must not unlock, even though the same owner made both.
    const otherUpload = await request(app)
      .post(`/api/experiences/${other.id}/media/upload`)
      .set(authHeader(owner.accessToken))
      .attach('file', ONE_PX_PNG, { filename: 'pixel.png', contentType: 'image/png' });

    const misused = await request(app).get(
      `/api/media/${otherUpload.body.data.id}/stream?mt=${tokenForThisExperience.body.data.token}`,
    );
    expect(misused.status).toBe(403);

    // Sanity check: the upload against the first experience really did work with its own token.
    const correct = await request(app).get(
      `/api/media/${upload.body.data.id}/stream?mt=${tokenForThisExperience.body.data.token}`,
    );
    expect(correct.status).toBe(200);
  });

  it('streams openly once the experience is published, even with no token at all', async () => {
    const experience = await createExperience(owner.accessToken, { title: 'About To Publish' });
    const upload = await request(app)
      .post(`/api/experiences/${experience.id}/media/upload`)
      .set(authHeader(owner.accessToken))
      .attach('file', ONE_PX_PNG, { filename: 'cover.png', contentType: 'image/png' });

    await request(app)
      .patch(`/api/experiences/${experience.id}`)
      .set(authHeader(owner.accessToken))
      .send({ coverMediaId: upload.body.data.id });

    const section = await request(app)
      .post(`/api/experiences/${experience.id}/sections`)
      .set(authHeader(owner.accessToken))
      .send({ title: 'Chapter' });
    await request(app)
      .post(`/api/sections/${section.body.data.id}/blocks`)
      .set(authHeader(owner.accessToken))
      .send({ type: 'TEXT', content: { text: 'Hi.' } });

    await publishExperience(owner.accessToken, experience.id, { allowWithoutCover: false });

    const anon = await request(app).get(`/api/media/${upload.body.data.id}/stream`);
    expect(anon.status).toBe(200);
  });

  it('deletes media, and a stranger cannot', async () => {
    const upload = await request(app)
      .post(`/api/experiences/${experienceId}/media/upload`)
      .set(authHeader(owner.accessToken))
      .attach('file', ONE_PX_PNG, { filename: 'pixel.png', contentType: 'image/png' });

    const strangerDelete = await request(app)
      .delete(`/api/media/${upload.body.data.id}`)
      .set(authHeader(stranger.accessToken));
    expect(strangerDelete.status).toBe(403);

    const ownerDelete = await request(app)
      .delete(`/api/media/${upload.body.data.id}`)
      .set(authHeader(owner.accessToken));
    expect(ownerDelete.status).toBe(200);

    const afterDelete = await request(app)
      .get(`/api/media/${upload.body.data.id}/stream`)
      .set(authHeader(owner.accessToken));
    expect(afterDelete.status).toBe(404);
  });
});
