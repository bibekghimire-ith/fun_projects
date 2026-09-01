import { expect, test } from '@playwright/test';
import { registerAccount, seedPublishableExperience } from '../fixtures/api';

test('opening the envelope reveals the personal greeting and the letter itself', async ({
  page,
  request,
}) => {
  const account = await registerAccount(request);
  const { publicToken } = await seedPublishableExperience(request, account, {
    title: 'For Sam',
    recipientName: 'Sam',
  });

  await page.goto(`/e/${publicToken}`);
  await expect(page.getByRole('heading', { name: 'A letter for you.' })).toBeVisible();

  // The accessible name "Open it" is shared by an animated envelope button and
  // a plain fallback button underneath it — either opens the letter.
  await page.getByRole('button', { name: 'Open it' }).last().click();

  await page.waitForURL(new RegExp(`/e/${publicToken}/open$`));
  await expect(page.getByText('Hi Sam.')).toBeVisible();
  await expect(page.getByText('Hello there — this is the letter.')).toBeVisible();
});

test('a letter that does not exist shows a not-found screen, not a crash', async ({ page }) => {
  await page.goto('/e/this-token-was-never-issued');
  await expect(page.getByText("This letter doesn't exist, or the link has changed.")).toBeVisible();
});
