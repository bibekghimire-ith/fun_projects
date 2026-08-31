import { expect, test } from '@playwright/test';
import { registerAccount } from '../fixtures/api';
import { signInAs } from '../fixtures/auth';

test('toggles a feature off and edits a wording override, and both survive a reload', async ({
  page,
  request,
}) => {
  const account = await registerAccount(request);
  await signInAs(page, account);

  await page.goto('/experiences/new');
  await page.getByText('Blank canvas').click();
  await page.getByLabel('Title').fill('Customize Test Letter');
  await page.getByLabel('Their name').fill('Robin');
  await page.getByRole('button', { name: 'Create the letter' }).click();
  await page.waitForURL('**/experiences/*/edit');

  const url = page.url();
  const experienceId = url.match(/\/experiences\/([^/]+)\//)?.[1];
  if (!experienceId) throw new Error(`Could not read experience id from ${url}`);

  await page.goto(`/experiences/${experienceId}/customize`);
  await expect(page.getByRole('heading', { name: 'Wording and what shows' })).toBeVisible();

  // Feature toggle — "Background music player" switches the music module off.
  const musicSwitch = page.getByRole('switch', { name: /Background music player/ });
  await expect(musicSwitch).toBeChecked();
  await musicSwitch.click();
  await expect(musicSwitch).not.toBeChecked();

  // Wording override — the "Welcome" group's "greeting" field.
  const greetingInput = page.getByLabel('greeting', { exact: true });
  await greetingInput.fill('Hey there, {recipient}!');
  await page.getByRole('button', { name: 'Save the wording' }).click();
  await expect(page.getByText('Your words are saved.')).toBeVisible();

  await page.reload();

  await expect(page.getByRole('switch', { name: /Background music player/ })).not.toBeChecked();
  await expect(page.getByLabel('greeting', { exact: true })).toHaveValue('Hey there, {recipient}!');
});

test('resetting a wording override clears it back to the default placeholder', async ({
  page,
  request,
}) => {
  const account = await registerAccount(request);
  await signInAs(page, account);

  await page.goto('/experiences/new');
  await page.getByText('Blank canvas').click();
  await page.getByLabel('Title').fill('Reset Wording Test');
  await page.getByLabel('Their name').fill('Jules');
  await page.getByRole('button', { name: 'Create the letter' }).click();
  await page.waitForURL('**/experiences/*/edit');

  const url = page.url();
  const experienceId = url.match(/\/experiences\/([^/]+)\//)?.[1];
  if (!experienceId) throw new Error(`Could not read experience id from ${url}`);

  await page.goto(`/experiences/${experienceId}/customize`);

  const greetingInput = page.getByLabel('greeting', { exact: true });
  await greetingInput.fill('A custom hello.');
  await page.getByRole('button', { name: 'Save the wording' }).click();
  await expect(page.getByText('Your words are saved.')).toBeVisible();
  await expect(greetingInput).toHaveValue('A custom hello.');

  await page.getByRole('button', { name: 'Reset welcome.greeting to the default wording' }).click();
  await expect(page.getByText('Back to the default wording.')).toBeVisible();
  await expect(greetingInput).toHaveValue('');
});
