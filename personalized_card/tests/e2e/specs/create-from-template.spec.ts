import { expect, test } from '@playwright/test';
import { registerAccount } from '../fixtures/api';
import { signInAs } from '../fixtures/auth';

test('starts a letter from a packaged template and lands in the builder with its content', async ({
  page,
  request,
}) => {
  const account = await registerAccount(request);
  await signInAs(page, account);

  await page.getByRole('button', { name: 'Start a new one' }).click();
  await page.waitForURL('**/experiences/new');

  // "See what's inside" previews any gallery tile without committing to it.
  await page.getByRole('button', { name: "See what's inside" }).first().click();
  await expect(page.getByRole('heading', { name: 'The chapters' })).toBeVisible();
  await page.getByRole('button', { name: 'Start from this' }).click();

  await page.getByLabel('Their name').fill('Priya');

  await page.getByRole('button', { name: 'Create the letter' }).click();
  await page.waitForURL('**/experiences/*/edit');

  // The template's own chapters should already be there — not a blank page.
  await expect(page.locator('[aria-label$="title"]').first()).toBeVisible();
});

test('starts a completely blank letter with no template at all', async ({ page, request }) => {
  const account = await registerAccount(request);
  await signInAs(page, account);

  await page.goto('/experiences/new');
  await page.getByText('Blank canvas').click();
  await page.getByLabel('Title').fill('A Blank Start');
  await page.getByLabel('Their name').fill('Alex');
  await page.getByRole('button', { name: 'Create the letter' }).click();

  await page.waitForURL('**/experiences/*/edit');
  await expect(page).toHaveURL(/\/experiences\/[^/]+\/edit/);
});
