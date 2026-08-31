import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Longer default: the integration suites talk to a real Postgres and, for
    // the media tests, actually decode an image with sharp.
    testTimeout: 15_000,
    hookTimeout: 20_000,
    // The integration suites share one real Postgres database and reset its
    // tables between test files (see src/test/helpers.ts's resetDb). Running
    // test files concurrently against that same database would let one file's
    // reset wipe rows another file is still using. The pure unit specs don't
    // need this, but there is no cheap way to split the two — so every file
    // in this project runs one at a time.
    fileParallelism: false,
    /**
     * These are test-only values, never used outside a local/CI test run —
     * there is nothing here to keep secret. They exist so `pnpm test` works
     * the moment DATABASE_URL is set, without asking anyone to hand-author a
     * 32-character secret first. DATABASE_URL itself is deliberately left
     * unset here: it must point at a real, disposable Postgres database (see
     * docs/testing.md), and defaulting it risks quietly wiping the wrong one.
     */
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'test-jwt-secret-do-not-use-in-production-00',
      REFRESH_TOKEN_SECRET: 'test-refresh-secret-do-not-use-in-prod-00',
      COOKIE_SECRET: 'test-cookie-secret-do-not-use-in-production',
      MEDIA_STORAGE_PROVIDER: 'local',
      MEDIA_LOCAL_PATH: './.test-uploads',
      APP_BASE_URL: 'http://localhost:4000',
      WEB_BASE_URL: 'http://localhost:5173',
      CORS_ORIGIN: 'http://localhost:5173',
      // Fast lockouts so PIN/rate-limit specs don't need real 15-minute waits.
      PIN_MAX_ATTEMPTS: '3',
      PIN_LOCKOUT_MINUTES: '1',
      // The coarse per-IP net in front of PIN_MAX_ATTEMPTS. Left high in
      // tests: public.test.ts deliberately drives several /verify calls
      // through one shared IP to test the fine-grained lockout above, and
      // that is what should trip first, not this blunter limiter.
      PIN_VERIFY_RATE_LIMIT_MAX: '1000',
    },
  },
});
