import { expect, test } from '@playwright/test';
import { registerAccount, seedPublishableExperience } from '../fixtures/api';

/**
 * PIN_MAX_ATTEMPTS defaults to 5 in production, and the coarser per-IP
 * PIN_VERIFY_RATE_LIMIT_MAX also defaults to 5 — both nets sit in front of the
 * same /verify route. Running this whole file against a dev server that still
 * has the out-of-the-box defaults risks the outer, per-IP limiter tripping
 * across tests rather than the per-experience lockout this file is actually
 * testing. See tests/e2e/README.md — it asks for PIN_VERIFY_RATE_LIMIT_MAX to
 * be raised in apps/api/.env for local e2e runs, the same way vitest's own
 * config raises it for the API's integration tests.
 */

test('a wrong code is rejected, and the right one unlocks the letter', async ({
  page,
  request,
}) => {
  const account = await registerAccount(request);
  const { publicToken } = await seedPublishableExperience(request, account, {
    title: 'A Locked Letter',
    recipientName: 'Sam',
    pin: '4471',
  });

  await page.goto(`/e/${publicToken}`);
  await page.waitForURL(new RegExp(`/e/${publicToken}/pin$`));
  await expect(page.getByText("This one's private.")).toBeVisible();

  const input = page.locator('#pin-input');
  await input.fill('0000');
  await expect(page.getByText("That's not it. Try again.")).toBeVisible();

  await input.fill('4471');
  await page.waitForURL(new RegExp(`/e/${publicToken}/open$`));
  await expect(page.getByText('Hi Sam.')).toBeVisible();
});

test('enough wrong codes locks the gate and it stays locked even for the right code', async ({
  page,
  request,
}) => {
  const account = await registerAccount(request);
  const { publicToken } = await seedPublishableExperience(request, account, {
    title: 'A Letter That Locks',
    recipientName: 'Robin',
    pin: '9902',
  });

  await page.goto(`/e/${publicToken}`);
  await page.waitForURL(new RegExp(`/e/${publicToken}/pin$`));
  const input = page.locator('#pin-input');
  const status = page.locator('#pin-status');

  let locked = false;
  for (let attempt = 0; attempt < 10 && !locked; attempt += 1) {
    await input.fill('0000');
    // The status line starts empty and is filled in once the /verify
    // response comes back — wait for it rather than racing the request.
    await expect(status).not.toHaveText('', { timeout: 5000 });
    const text = (await status.textContent()) ?? '';
    locked = /Too many attempts/.test(text);
    if (!locked) expect(text).toContain("That's not it");
  }

  await expect(status).toContainText('Too many attempts');
  await expect(input).toBeDisabled();

  // Even the correct PIN is refused while the lockout is in effect.
  await expect(page.getByRole('button', { name: 'Unlock' })).toBeDisabled();
});
