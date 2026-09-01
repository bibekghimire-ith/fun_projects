import { expect, test } from '@playwright/test';
import { registerAccount } from '../fixtures/api';
import { signInAs } from '../fixtures/auth';

/** Creates a blank experience via the UI and lands in its builder. */
async function createBlankExperience(page: import('@playwright/test').Page, title: string) {
  await page.goto('/experiences/new');
  await page.getByText('Blank canvas').click();
  await page.getByLabel('Title').fill(title);
  await page.getByLabel('Their name').fill('Sam');
  await page.getByRole('button', { name: 'Create the letter' }).click();
  await page.waitForURL('**/experiences/*/edit');
}

test('adds a chapter, adds a text block, writes in it, and it survives a reload', async ({
  page,
  request,
}) => {
  const account = await registerAccount(request);
  await signInAs(page, account);
  await createBlankExperience(page, 'Builder Test Letter');

  await page.getByRole('button', { name: /Add a chapter|Add the first chapter/ }).click();
  await expect(page.locator('[aria-label$="title"]')).toHaveCount(1);

  await page.getByRole('button', { name: 'Add a block' }).first().click();
  await expect(page.getByRole('heading', { name: 'What goes here?' })).toBeVisible();
  await page.getByRole('button', { name: 'Text', exact: true }).click();

  const editor = page.locator('[aria-label="The words of this block"]');
  await editor.click();
  await editor.fill('This is what the letter actually says.');
  // TipTap commits on blur — move focus elsewhere to trigger the autosave.
  await page.keyboard.press('Tab');

  await page.reload();
  await expect(page.locator('[aria-label="The words of this block"]')).toContainText(
    'This is what the letter actually says.',
  );
});

test('renames a chapter and deletes it', async ({ page, request }) => {
  const account = await registerAccount(request);
  await signInAs(page, account);
  await createBlankExperience(page, 'Delete Chapter Test');

  await page.getByRole('button', { name: /Add a chapter|Add the first chapter/ }).click();
  const titleInput = page.locator('[aria-label$="title"]').first();
  await titleInput.fill('An Important Chapter');
  await page.keyboard.press('Tab');

  await page.reload();
  await expect(page.locator('[aria-label$="title"]').first()).toHaveValue('An Important Chapter');

  await page.getByRole('button', { name: /^Delete the chapter/ }).click();
  await expect(page.locator('[aria-label$="title"]')).toHaveCount(0);
});
