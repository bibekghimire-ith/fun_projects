# End-to-end tests

These specs drive the real app in a real browser — the Vite dev server for
`apps/web` and the Express API from `apps/api`, both started automatically by
`playwright.config.ts`. They are slower and heavier than the unit and
integration suites, and they are **not** part of `pnpm test`; run them
explicitly with `pnpm test:e2e` from the repo root.

## Prerequisites

1. **A disposable Postgres database.** These tests create real accounts,
   experiences, sections and blocks through the running API, against
   whatever database `apps/api/.env`'s `DATABASE_URL` points at. Use a
   database you don't mind filling up with test data — nothing here resets
   it, unlike the API's own integration tests.

   ```bash
   createdb letter_e2e
   ```

2. **`apps/api/.env` configured**, same as for running the app normally —
   copy `.env.example` at the repo root, point `DATABASE_URL` at the
   database above, and run the migrations:

   ```bash
   cp .env.example apps/api/.env
   pnpm db:migrate
   ```

3. **Raise `PIN_VERIFY_RATE_LIMIT_MAX` for the run.** `pin.spec.ts`
   deliberately submits several wrong PINs in a row to exercise the
   per-experience lockout (`PIN_MAX_ATTEMPTS`, default 5). A second, coarser
   limiter (`PIN_VERIFY_RATE_LIMIT_MAX`, also default 5) caps `/verify` calls
   per IP across *every* experience — and because all these specs run against
   one long-lived dev server from one machine, that coarser limiter can trip
   across tests before the per-experience lockout is even exercised. Add this
   to `apps/api/.env` before running the suite, the same way `apps/api`'s own
   `vitest.config.ts` raises it for integration tests:

   ```
   PIN_VERIFY_RATE_LIMIT_MAX=1000
   ```

4. **Install Playwright's browser**, if this is the first run on this
   machine:

   ```bash
   pnpm --filter tests-e2e exec playwright install chromium
   ```

## Running

```bash
pnpm test:e2e
```

`playwright.config.ts` starts both dev servers itself (`reuseExistingServer`
is on outside of CI, so it will happily attach to servers you already have
running from `pnpm dev`). Add `--headed` or `--ui` for local debugging:

```bash
pnpm --filter tests-e2e test:headed
pnpm --filter tests-e2e test:ui
```

A failed run leaves a trace, screenshot and video under
`tests/e2e/test-results/`; `pnpm --filter tests-e2e report` opens the HTML
report for the last run.

## What's covered

Every spec registers its own account (or seeds its own experience) through
the real API rather than sharing fixtures across files, so they can run in
any order against the same database without colliding.

- **`auth.spec.ts`** — registering through the real form, a wrong-then-right
  password, and the redirect a signed-out visitor gets from a protected page.
- **`create-from-template.spec.ts`** — starting a letter from a packaged
  template (previewing it first) versus starting one completely blank.
- **`builder.spec.ts`** — adding a chapter and a text block, writing in it,
  and reloading to confirm the autosave stuck; renaming and deleting a
  chapter.
- **`customize.spec.ts`** — turning a feature off, overriding a piece of
  wording, and resetting an override back to its default — each checked
  across a reload.
- **`publish-and-share.spec.ts`** — publishing a letter from the Share page,
  reading back the live link, and pausing it again.
- **`recipient.spec.ts`** — opening the envelope on a real published letter
  and seeing the personal greeting and the letter's own words; the
  not-found screen for a token that was never issued.
- **`pin.spec.ts`** — a wrong code rejected and the right one unlocking the
  letter; enough wrong codes locking the gate, including for the correct
  code while locked.
- **`accessibility.spec.ts`** — `@axe-core/playwright` against the login
  page, the dashboard, and the recipient welcome screen, filtered to
  serious/critical violations only (moderate/minor rules are noisy and not
  what this suite is trying to catch).

## A note on selectors

These specs favour accessible roles and labels (`getByRole`, `getByLabel`,
`getByText`) over CSS classes, matching real copy and `aria-label`s read
from the corresponding component source rather than guessed — see the block
picker's exact labels in `packages/types/src/index.ts`'s `BLOCK_META`, and
the recipient-facing microcopy in the same file's `DEFAULT_COPY`, if a
future copy change means a spec needs updating too.
