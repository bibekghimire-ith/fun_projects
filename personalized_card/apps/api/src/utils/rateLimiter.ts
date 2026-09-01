/**
 * A tiny in-memory attempt limiter, used for the PIN gate.
 *
 * IMPORTANT: state lives in this process only. With more than one API instance
 * behind a load balancer each instance counts separately, so an attacker gets
 * N times the attempts. Before running multi-instance this should move to Redis
 * (INCR + EXPIRE on the same key gives the identical semantics atomically).
 * The Express rate limiter in front of the route is the coarse net; this is the
 * per-experience, per-visitor one.
 */

export interface AttemptRecord {
  /** Failures counted inside the current window. */
  count: number;
  /** When the current window started, in epoch ms. */
  firstAt: number;
  /** Epoch ms the lock lifts, or null while the key is not locked. */
  lockedUntil: number | null;
}

export interface AttemptLimiterOptions {
  /** Failures allowed before the key locks. */
  maxAttempts: number;
  /** How long a lock lasts, in ms. */
  lockoutMs: number;
  /** How long failures keep accumulating before the count resets, in ms. */
  windowMs?: number;
  /** Injectable clock — tests pass their own so nothing has to sleep. */
  now?: () => number;
  /** Expired entries are swept after this many operations. */
  sweepEvery?: number;
}

export interface LockState {
  locked: boolean;
  /** Seconds until the lock lifts. 0 when not locked. */
  retryAfterSeconds: number;
}

const NOT_LOCKED: LockState = { locked: false, retryAfterSeconds: 0 };

export class AttemptLimiter {
  private readonly entries = new Map<string, AttemptRecord>();
  private readonly maxAttempts: number;
  private readonly lockoutMs: number;
  private readonly windowMs: number;
  private readonly now: () => number;
  private readonly sweepEvery: number;
  private opsSinceSweep = 0;

  constructor(options: AttemptLimiterOptions) {
    this.maxAttempts = options.maxAttempts;
    this.lockoutMs = options.lockoutMs;
    this.windowMs = options.windowMs ?? options.lockoutMs;
    this.now = options.now ?? (() => Date.now());
    this.sweepEvery = options.sweepEvery ?? 200;
  }

  /** Is this key locked right now? Does not count as an attempt. */
  check(key: string): LockState {
    this.maybeSweep();
    const entry = this.entries.get(key);
    if (!entry) return NOT_LOCKED;

    const now = this.now();
    if (entry.lockedUntil !== null) {
      if (now < entry.lockedUntil) {
        return { locked: true, retryAfterSeconds: Math.ceil((entry.lockedUntil - now) / 1000) };
      }
      // The lock has expired — the visitor starts clean.
      this.entries.delete(key);
      return NOT_LOCKED;
    }

    if (now - entry.firstAt >= this.windowMs) {
      this.entries.delete(key);
    }
    return NOT_LOCKED;
  }

  /** Record one failure, and report whether that just locked the key. */
  recordFailure(key: string): LockState {
    this.maybeSweep();
    const now = this.now();
    let current = this.entries.get(key);

    if (current && current.lockedUntil !== null) {
      if (now < current.lockedUntil) {
        return { locked: true, retryAfterSeconds: Math.ceil((current.lockedUntil - now) / 1000) };
      }
      // The lock has expired; this failure starts a fresh window.
      this.entries.delete(key);
      current = undefined;
    }

    const withinWindow = current !== undefined && now - current.firstAt < this.windowMs;

    const entry: AttemptRecord = withinWindow
      ? { count: current!.count + 1, firstAt: current!.firstAt, lockedUntil: null }
      : { count: 1, firstAt: now, lockedUntil: null };

    if (entry.count >= this.maxAttempts) {
      entry.lockedUntil = now + this.lockoutMs;
      this.entries.set(key, entry);
      return { locked: true, retryAfterSeconds: Math.ceil(this.lockoutMs / 1000) };
    }

    this.entries.set(key, entry);
    return NOT_LOCKED;
  }

  /** A correct PIN wipes the slate for that key. */
  reset(key: string): void {
    this.entries.delete(key);
  }

  /** Drop entries that are neither locked nor inside their window. */
  sweep(): void {
    const now = this.now();
    for (const [key, entry] of this.entries) {
      const lockLive = entry.lockedUntil !== null && now < entry.lockedUntil;
      const windowLive = now - entry.firstAt < this.windowMs;
      if (!lockLive && !windowLive) this.entries.delete(key);
    }
    this.opsSinceSweep = 0;
  }

  /** Visible for tests and for logging how big the map has grown. */
  get size(): number {
    return this.entries.size;
  }

  private maybeSweep(): void {
    this.opsSinceSweep += 1;
    if (this.opsSinceSweep >= this.sweepEvery) this.sweep();
  }
}
