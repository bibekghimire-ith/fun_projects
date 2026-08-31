import { defineConfig, devices } from '@playwright/test';

const WEB_PORT = 5173;
const API_PORT = 4000;
const baseURL = `http://localhost:${WEB_PORT}`;

/**
 * End-to-end specs drive the real app through a real browser: the Vite dev
 * server for the UI, and the Express API behind it, both started here. They
 * need a real, disposable Postgres database — see README.md for setup. These
 * are NOT part of `pnpm test`; run them explicitly with `pnpm test:e2e`.
 */
export default defineConfig({
  testDir: './specs',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  outputDir: 'test-results',
  timeout: 30_000,
  expect: { timeout: 8_000 },

  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: [
    {
      command: 'pnpm --filter api dev',
      url: `http://localhost:${API_PORT}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      cwd: '../..',
    },
    {
      command: 'pnpm --filter web dev',
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      cwd: '../..',
    },
  ],
});
