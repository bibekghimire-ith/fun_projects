import { expect, test } from '@playwright/test';
import { unique } from '../fixtures/api';

test.describe('sign-up and sign-in', () => {
  test('registers a new account through the form and lands on the dashboard', async ({ page }) => {
    const email = `${unique('signup')}@example.test`;

    await page.goto('/register');
    await page.getByLabel('Name').fill('New Creator');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('Password123!');
    await page.getByRole('button', { name: 'Register' }).click();

    await page.waitForURL('**/dashboard');
    await expect(page.getByRole('heading', { name: 'Your letters' })).toBeVisible();
  });

  test('shows an error for the wrong password, and signs in correctly with the right one', async ({
    page,
  }) => {
    const email = `${unique('signin')}@example.test`;
    await page.goto('/register');
    await page.getByLabel('Name').fill('Existing Creator');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('Password123!');
    await page.getByRole('button', { name: 'Register' }).click();
    await page.waitForURL('**/dashboard');

    await page.getByRole('button', { name: 'Sign out' }).click();
    await page.waitForURL('**/login');

    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('WrongPassword1');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.locator('text=/failed|invalid/i')).toBeVisible();

    await page.getByLabel('Password').fill('Password123!');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL('**/dashboard');
    await expect(page.getByRole('heading', { name: 'Your letters' })).toBeVisible();
  });

  test('sends a signed-out visitor to /login when they try a protected page', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL('**/login');
  });
});
