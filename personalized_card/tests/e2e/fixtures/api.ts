import type { APIRequestContext } from '@playwright/test';

const API_BASE = 'http://localhost:4000';

export interface TestAccount {
  email: string;
  password: string;
  name: string;
  accessToken: string;
  userId: string;
}

/** A value that won't collide with another spec, this run or the last. */
export function unique(label: string): string {
  return `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Registers a fresh account straight against the API. Specs that are really
 * about the builder, sharing or the recipient experience don't need to also
 * exercise the sign-up form every time — auth.spec.ts is where that lives.
 */
export async function registerAccount(request: APIRequestContext): Promise<TestAccount> {
  const email = `${unique('e2e')}@example.test`;
  const password = 'Password123!';
  const name = 'E2E Creator';

  const res = await request.post(`${API_BASE}/api/auth/register`, {
    data: { email, password, name },
  });
  if (!res.ok()) {
    throw new Error(`registerAccount failed: ${res.status()} ${await res.text()}`);
  }
  const body = await res.json();
  return { email, password, name, accessToken: body.data.accessToken, userId: body.data.user.id };
}

export interface SeededExperience {
  id: string;
  publicToken: string;
}

/**
 * Builds a minimal, publishable experience via the API — one chapter, one
 * text block — so specs that need a real letter (the recipient view, the PIN
 * gate) don't have to reconstruct the builder flow themselves.
 */
export async function seedPublishableExperience(
  request: APIRequestContext,
  account: TestAccount,
  overrides: { title?: string; recipientName?: string; pin?: string } = {},
): Promise<SeededExperience> {
  const auth = { Authorization: `Bearer ${account.accessToken}` };

  const created = await request.post(`${API_BASE}/api/experiences`, {
    headers: auth,
    data: {
      title: overrides.title ?? 'A Little Something',
      recipientName: overrides.recipientName ?? 'Sam',
      eventType: 'BIRTHDAY',
    },
  });
  const experience = (await created.json()).data;

  const section = await request.post(`${API_BASE}/api/experiences/${experience.id}/sections`, {
    headers: auth,
    data: { title: 'Chapter One' },
  });
  const sectionId = (await section.json()).data.id;

  await request.post(`${API_BASE}/api/sections/${sectionId}/blocks`, {
    headers: auth,
    data: { type: 'TEXT', content: { text: 'Hello there — this is the letter.' } },
  });

  if (overrides.pin) {
    await request.post(`${API_BASE}/api/experiences/${experience.id}/pin`, {
      headers: auth,
      data: { pin: overrides.pin },
    });
  }

  const published = await request.post(`${API_BASE}/api/experiences/${experience.id}/publish`, {
    headers: auth,
    data: { allowWithoutCover: true },
  });
  const publishedBody = (await published.json()).data;

  return { id: publishedBody.id, publicToken: publishedBody.publicToken };
}
