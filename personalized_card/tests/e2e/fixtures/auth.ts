import type { Page } from '@playwright/test';
import type { TestAccount } from './api';

const TOKEN_KEY = 'letter_access_token';

/**
 * Drops an already-issued access token into the browser's localStorage and
 * lets the app's own AuthProvider validate it against /api/me on load — the
 * same thing a real returning visitor's browser does. Specs that are about
 * the builder, customization or sharing use this instead of re-driving the
 * login form every time; auth.spec.ts is where the form itself is tested.
 */
export async function signInAs(page: Page, account: TestAccount): Promise<void> {
  await page.goto('/login');
  await page.evaluate((token) => window.localStorage.setItem('letter_access_token', token), account.accessToken);
  await page.goto('/dashboard');
  await page.waitForURL('**/dashboard');
}

export { TOKEN_KEY };
