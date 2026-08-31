import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { registerAccount, seedPublishableExperience } from '../fixtures/api';

/**
 * Flags only serious/critical violations — axe's "minor"/"moderate" rules
 * include things like landmark-region best-practices that would make this
 * suite fail on cosmetic grounds unrelated to whether someone can actually
 * use the letter.
 */
async function seriousViolations(page: import('@playwright/test').Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  return results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
}

test('the login page has no serious accessibility violations', async ({ page }) => {
  await page.goto('/login');
  expect(await seriousViolations(page)).toEqual([]);
});

test('the dashboard has no serious accessibility violations', async ({ page, request }) => {
  const account = await registerAccount(request);
  await page.goto('/login');
  await page.evaluate(
    (token) => window.localStorage.setItem('letter_access_token', token),
    account.accessToken,
  );
  await page.goto('/dashboard');
  await page.waitForURL('**/dashboard');
  expect(await seriousViolations(page)).toEqual([]);
});

test('the recipient welcome screen has no serious accessibility violations', async ({
  page,
  request,
}) => {
  const account = await registerAccount(request);
  const { publicToken } = await seedPublishableExperience(request, account, {
    title: 'Accessible Letter',
    recipientName: 'Sam',
  });

  await page.goto(`/e/${publicToken}`);
  await page.waitForURL(new RegExp(`/e/${publicToken}$`));
  expect(await seriousViolations(page)).toEqual([]);
});
