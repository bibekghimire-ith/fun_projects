import { describe, expect, it } from 'vitest';
import { AttemptLimiter } from '../../utils/rateLimiter';

/** A clock the test drives by hand, so nothing has to sleep. */
function fakeClock(start = 1_000_000) {
  let current = start;
  return {
    now: () => current,
    advance: (ms: number) => {
      current += ms;
    },
  };
}

const MINUTE = 60 * 1000;

function limiter(overrides: { maxAttempts?: number; lockoutMs?: number; windowMs?: number } = {}) {
  const clock = fakeClock();
  return {
    clock,
    limiter: new AttemptLimiter({
      maxAttempts: overrides.maxAttempts ?? 5,
      lockoutMs: overrides.lockoutMs ?? 15 * MINUTE,
      windowMs: overrides.windowMs,
      now: clock.now,
    }),
  };
}

const KEY = 'exp-1:hash-a';

describe('PIN lockout', () => {
  it('starts unlocked', () => {
    const { limiter: l } = limiter();
    expect(l.check(KEY)).toEqual({ locked: false, retryAfterSeconds: 0 });
  });

  it('stays unlocked below the threshold', () => {
    const { limiter: l } = limiter({ maxAttempts: 5 });
    for (let i = 0; i < 4; i += 1) {
      expect(l.recordFailure(KEY).locked).toBe(false);
    }
    expect(l.check(KEY).locked).toBe(false);
  });

  it('locks on the Nth failure and reports how long to wait', () => {
    const { limiter: l } = limiter({ maxAttempts: 5, lockoutMs: 15 * MINUTE });
    for (let i = 0; i < 4; i += 1) l.recordFailure(KEY);

    const fifth = l.recordFailure(KEY);
    expect(fifth.locked).toBe(true);
    expect(fifth.retryAfterSeconds).toBe(900);
    expect(l.check(KEY).locked).toBe(true);
  });

  it('counts down while the lock is in force', () => {
    const { clock, limiter: l } = limiter({ maxAttempts: 2, lockoutMs: 10 * MINUTE });
    l.recordFailure(KEY);
    l.recordFailure(KEY);

    clock.advance(4 * MINUTE);
    expect(l.check(KEY)).toEqual({ locked: true, retryAfterSeconds: 6 * 60 });
  });

  it('keeps a locked key locked even if more attempts arrive', () => {
    const { clock, limiter: l } = limiter({ maxAttempts: 2, lockoutMs: 10 * MINUTE });
    l.recordFailure(KEY);
    l.recordFailure(KEY);

    clock.advance(MINUTE);
    const extra = l.recordFailure(KEY);
    expect(extra.locked).toBe(true);
    expect(extra.retryAfterSeconds).toBe(9 * 60);
  });

  it('unlocks once the window has passed', () => {
    const { clock, limiter: l } = limiter({ maxAttempts: 2, lockoutMs: 10 * MINUTE });
    l.recordFailure(KEY);
    l.recordFailure(KEY);
    expect(l.check(KEY).locked).toBe(true);

    clock.advance(10 * MINUTE);
    expect(l.check(KEY).locked).toBe(false);
  });

  it('gives the full budget again after a lock expires', () => {
    const { clock, limiter: l } = limiter({ maxAttempts: 2, lockoutMs: 10 * MINUTE });
    l.recordFailure(KEY);
    l.recordFailure(KEY);
    clock.advance(10 * MINUTE + 1);

    expect(l.recordFailure(KEY).locked).toBe(false);
    expect(l.recordFailure(KEY).locked).toBe(true);
  });

  it('forgets stale failures once the counting window lapses', () => {
    const { clock, limiter: l } = limiter({ maxAttempts: 3, lockoutMs: MINUTE, windowMs: MINUTE });
    l.recordFailure(KEY);
    l.recordFailure(KEY);

    clock.advance(MINUTE + 1);
    // The old two have aged out, so this is failure number one again.
    expect(l.recordFailure(KEY).locked).toBe(false);
    expect(l.recordFailure(KEY).locked).toBe(false);
    expect(l.recordFailure(KEY).locked).toBe(true);
  });

  it('resets the count when the right PIN finally arrives', () => {
    const { limiter: l } = limiter({ maxAttempts: 3 });
    l.recordFailure(KEY);
    l.recordFailure(KEY);

    l.reset(KEY);

    expect(l.check(KEY).locked).toBe(false);
    expect(l.recordFailure(KEY).locked).toBe(false);
    expect(l.recordFailure(KEY).locked).toBe(false);
    expect(l.recordFailure(KEY).locked).toBe(true);
  });

  it('locks one experience-and-visitor pair without touching another', () => {
    const { limiter: l } = limiter({ maxAttempts: 2 });
    const other = 'exp-1:hash-b';

    l.recordFailure(KEY);
    l.recordFailure(KEY);

    expect(l.check(KEY).locked).toBe(true);
    expect(l.check(other).locked).toBe(false);
  });

  it('sweeps entries that are neither locked nor live, so the map stays bounded', () => {
    const { clock, limiter: l } = limiter({ maxAttempts: 5, lockoutMs: MINUTE, windowMs: MINUTE });
    l.recordFailure('a');
    l.recordFailure('b');
    l.recordFailure('c');
    expect(l.size).toBe(3);

    clock.advance(MINUTE + 1);
    l.sweep();
    expect(l.size).toBe(0);
  });

  it('does not sweep away a lock that is still in force', () => {
    const { clock, limiter: l } = limiter({ maxAttempts: 1, lockoutMs: 10 * MINUTE });
    l.recordFailure('a');

    clock.advance(MINUTE);
    l.sweep();
    expect(l.size).toBe(1);
    expect(l.check('a').locked).toBe(true);
  });
});
