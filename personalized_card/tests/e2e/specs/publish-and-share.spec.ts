import { expect, test } from '@playwright/test';
import { registerAccount } from '../fixtures/api';
import { signInAs } from '../fixtures/auth';

const API_BASE = 'http://localhost:4000';

test('publishes a letter from the Share page and can pause it again', async ({ page, request }) => {
  const account = await registerAccount(request);
  await signInAs(page, account);

  await page.goto('/experiences/new');
  await page.getByText('Blank canvas').click();
  await page.getByLabel('Title').fill('Share Page Test Letter');
  await page.getByLabel('Their name').fill('Morgan');
  await page.getByRole('button', { name: 'Create the letter' }).click();
  await page.waitForURL('**/experiences/*/edit');

  const url = page.url();
  const experienceId = url.match(/\/experiences\/([^/]+)\//)?.[1];
  if (!experienceId) throw new Error(`Could not read experience id from ${url}`);

  // Give it one chapter and one block via the API directly — this spec is
  // about the Share page, not re-proving the builder (see builder.spec.ts).
  const auth = { Authorization: `Bearer ${account.accessToken}` };
  const section = await request.post(`${API_BASE}/api/experiences/${experienceId}/sections`, {
    headers: auth,
    data: { title: 'Chapter One' },
  });
  const sectionId = (await section.json()).data.id;
  await request.post(`${API_BASE}/api/sections/${sectionId}/blocks`, {
    headers: auth,
    data: { type: 'TEXT', content: { text: 'Hello, Morgan.' } },
  });

  await page.goto(`/experiences/${experienceId}/share`);
  await expect(page.getByRole('heading', { name: 'Sending it' })).toBeVisible();
  await expect(page.getByText('Draft', { exact: true })).toBeVisible();

  // Only the missing-cover issue remains, so "Send it" is enabled without one.
  await page.getByRole('button', { name: 'Send it' }).click();
  await expect(page.getByText('It is live. The link works from this moment on.')).toBeVisible();
  await expect(page.getByText('Live', { exact: true })).toBeVisible();

  const linkText = await page.locator('p[class*="url"]').first().textContent();
  expect(linkText).toMatch(/\/e\/[A-Za-z0-9_-]{10,}/);

  await page.getByRole('button', { name: 'Pause it' }).click();
  await expect(
    page.getByText('Paused. The link shows a quiet holding page for now.'),
  ).toBeVisible();
  await expect(page.getByText('Paused', { exact: true })).toBeVisible();
});
