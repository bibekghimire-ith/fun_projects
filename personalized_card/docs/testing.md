# Testing

Three layers, from fastest/narrowest to slowest/broadest. All three are run
in CI (`.github/workflows/ci.yml`); only the first two gate a merge.

| Layer | Where | Command | Needs Postgres? |
|---|---|---|---|
| API unit + integration | `apps/api` | `pnpm --filter api test` | Yes |
| Web unit | `apps/web` | `pnpm --filter web test` | No |
| End-to-end | `tests/e2e` | `pnpm test:e2e` | Yes |

`pnpm test` from the repo root runs the first two. The third is separate —
see [`tests/e2e/README.md`](../tests/e2e/README.md) for its own setup and a
description of what each spec covers.

## API tests (`apps/api`)

`apps/api/src/test/` holds the suite:

- `integration/*.test.ts` — one file per area (auth, experiences, the
  builder, templates, themes, config, media, the public/recipient API),
  each driving the real Express app in-process with `supertest` against a
  real Postgres database. No mocking of Prisma or the database — these are
  full request-to-response tests.
- `security.test.ts` — JWT tampering, expiry, deleted-user tokens, PIN-token
  misuse across experiences, and a couple of response-header checks
  (helmet's `nosniff`, no `x-powered-by`).
- `helpers.ts` — the shared harness: `resetDb()` (deletes every table in
  FK-safe order between test files), `registerUser`/`createExperience`/
  `addMinimalContent`/`publishExperience` convenience wrappers, and a small
  1×1 PNG fixture for upload tests.

### Prerequisites

A real (disposable) Postgres database, reachable via `DATABASE_URL`. The
suite does not create or migrate the database itself — run migrations first:

```bash
createdb letter_test
DATABASE_URL=postgresql://letter:letter@localhost:5432/letter_test pnpm --filter api exec prisma migrate deploy
```

`apps/api/vitest.config.ts` sets every other required env var (JWT secrets,
cookie secret, media storage path, base URLs) to fixed test values, and
deliberately leaves `DATABASE_URL` unset — pass it yourself so a test run can
never silently default to, and wipe, a real database:

```bash
DATABASE_URL=postgresql://letter:letter@localhost:5432/letter_test pnpm --filter api test
```

### Why some things are configured the way they are

- **`fileParallelism: false`** — every integration test file shares one real
  database and calls `resetDb()` between files. Running files concurrently
  would let one file's reset wipe another file's in-flight data.
- **Rate-limit tests live in their own files.** Vitest gives each test
  *file* a fresh module graph, but not each individual `it()` — a
  process-wide singleton like an `express-rate-limit` limiter or the
  in-memory PIN attempt tracker keeps its count across every test within one
  file. `integration/rateLimit.test.ts` is isolated for exactly this reason;
  putting it inside `auth.test.ts` would make the whole file's test order
  fragile (whichever tests happen to run first would eat into the limiter's
  budget).
- **`PIN_VERIFY_RATE_LIMIT_MAX` is raised to 1000 in the test env.** This is
  the coarser, per-IP limiter in front of the PIN gate (see
  `apps/api/src/config/env.ts`). `public.test.ts` needs to exercise the
  fine-grained, per-experience `PIN_MAX_ATTEMPTS` lockout (set to 3 in the
  test env, for a fast test) without the coarser limiter tripping first from
  the same file's other PIN-related tests.

## Web tests (`apps/web`)

Pure-function unit tests — no DOM, no React Testing Library — covering
`src/lib/format.ts`, `src/lib/copy.ts`, and `scopeCss()` from
`src/lib/theme.tsx`. These don't need a browser or a server:

```bash
pnpm --filter web test
```

`formatDate`'s tests use local-time `Date` constructors (`new Date(2026, 2,
5)`) rather than UTC ISO strings, because `formatDate` itself reads local
accessors (`getMonth()`, `getDate()`) — a UTC-midnight input would render as
the previous day in any timezone west of UTC.

## End-to-end tests (`tests/e2e`)

See [`tests/e2e/README.md`](../tests/e2e/README.md) — it covers the
disposable database, the `apps/api/.env` setup, the `PIN_VERIFY_RATE_LIMIT_MAX`
override needed for `pin.spec.ts`, and what each spec file exercises.

## Static checks

`pnpm lint` and `pnpm typecheck` run across the whole monorepo and are part
of the same CI job as the API/web tests — a broken import or a type error
fails the build before any test runs.
