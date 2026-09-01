import { randomUUID } from 'crypto';
import type { Express } from 'express';
import request from 'supertest';
import { createApp } from '../app';
import { prisma } from '../config/prisma';

/**
 * One Express app instance, shared by every integration test file. Nothing
 * about createApp() is stateful in a way that matters across requests — the
 * things that ARE process-wide (the PIN lockout map, express-rate-limit
 * counters) are exactly what the security specs mean to exercise.
 */
export const app: Express = createApp();

export { prisma };

/** A value that will never collide with another test, this run or the last. */
export function unique(label = 'x'): string {
  return `${label}-${randomUUID()}`;
}

export function uniqueEmail(label = 'user'): string {
  return `${label}-${randomUUID()}@example.test`;
}

/**
 * Deletes every row this test suite could have created, in an order that
 * respects foreign keys without leaning on cascades that might change later.
 * Runs between test files, never between individual `it`s — see
 * vitest.config.ts's fileParallelism note for why that is safe here.
 */
export async function resetDb(): Promise<void> {
  await prisma.auditLog.deleteMany();
  await prisma.response.deleteMany();
  await prisma.experienceAccess.deleteMany();
  await prisma.contentBlock.deleteMany();
  await prisma.experienceSection.deleteMany();
  await prisma.openWhenMessage.deleteMany();
  await prisma.futureLetter.deleteMany();
  await prisma.finalSurprise.deleteMany();
  await prisma.memory.deleteMany();
  await prisma.experienceConfig.deleteMany();
  await prisma.media.deleteMany();
  await prisma.experience.deleteMany();
  await prisma.theme.deleteMany();
  await prisma.user.deleteMany();
}

export interface TestUser {
  userId: string;
  email: string;
  accessToken: string;
}

/** Registers a brand-new creator account and returns everything a test needs. */
export async function registerUser(overrides: { email?: string; name?: string } = {}): Promise<TestUser> {
  const email = overrides.email ?? uniqueEmail();
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'Password123!', name: overrides.name ?? 'Test Creator' });

  if (res.status !== 201) {
    throw new Error(`registerUser failed: ${res.status} ${JSON.stringify(res.body)}`);
  }

  return { userId: res.body.data.user.id, email, accessToken: res.body.data.accessToken };
}

export function authHeader(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

export interface MinimalExperienceOverrides {
  title?: string;
  recipientName?: string;
  eventType?: 'BIRTHDAY' | 'ANNIVERSARY' | 'VALENTINES' | 'CUSTOM';
  templateSlug?: string;
}

/** A bare, valid experience a test can then build on. */
export async function createExperience(token: string, overrides: MinimalExperienceOverrides = {}) {
  const res = await request(app)
    .post('/api/experiences')
    .set(authHeader(token))
    .send({
      title: overrides.title ?? 'A Little Something',
      recipientName: overrides.recipientName ?? 'Sam',
      eventType: overrides.eventType ?? 'BIRTHDAY',
      ...(overrides.templateSlug ? { templateSlug: overrides.templateSlug } : {}),
    });

  if (res.status !== 201) {
    throw new Error(`createExperience failed: ${res.status} ${JSON.stringify(res.body)}`);
  }

  return res.body.data as { id: string; publicToken: string; [key: string]: unknown };
}

/** Adds one enabled section with one enabled TEXT block — enough to pass the "has content" publish check. */
export async function addMinimalContent(token: string, experienceId: string): Promise<void> {
  const section = await request(app)
    .post(`/api/experiences/${experienceId}/sections`)
    .set(authHeader(token))
    .send({ title: 'Chapter One' });

  if (section.status !== 201) {
    throw new Error(`addMinimalContent (section) failed: ${section.status} ${JSON.stringify(section.body)}`);
  }

  const block = await request(app)
    .post(`/api/sections/${section.body.data.id}/blocks`)
    .set(authHeader(token))
    .send({ type: 'TEXT', content: { text: 'Hello there.' } });

  if (block.status !== 201) {
    throw new Error(`addMinimalContent (block) failed: ${block.status} ${JSON.stringify(block.body)}`);
  }
}

/** Publishes an experience, skipping the cover-image requirement by default. */
export async function publishExperience(
  token: string,
  experienceId: string,
  options: { allowWithoutCover?: boolean } = { allowWithoutCover: true },
) {
  const res = await request(app)
    .post(`/api/experiences/${experienceId}/publish`)
    .set(authHeader(token))
    .send(options);

  if (res.status !== 200) {
    throw new Error(`publishExperience failed: ${res.status} ${JSON.stringify(res.body)}`);
  }

  return res.body.data as { id: string; publicToken: string; status: string };
}

/** A built-in theme fixture — the app itself only gets these from prisma/seed.ts. */
export async function createBuiltInTheme(overrides: { name?: string; slug?: string } = {}) {
  return prisma.theme.create({
    data: {
      name: overrides.name ?? 'Test Built-in',
      slug: overrides.slug ?? unique('built-in'),
      isBuiltIn: true,
      primaryColor: '#111111',
      secondaryColor: '#222222',
      backgroundColor: '#ffffff',
      surfaceColor: '#f5f5f5',
      textColor: '#000000',
    },
  });
}

/** A one-pixel PNG — small enough to embed, real enough for sharp to process. */
export const ONE_PX_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);
