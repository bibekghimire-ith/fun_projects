import type { TemplateMemory, TemplateOpenWhen } from '@letter/types';

/**
 * Pure date/content helpers used when a template is stamped onto an experience.
 *
 * They live apart from TemplateService so they can be unit-tested without a
 * database: everything here takes an explicit `now` and returns plain values.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;

/** How far ahead a countdown points when the experience has no event date. */
export const COUNTDOWN_FALLBACK_DAYS = 7;

/** Templates describe timeline moments as "N days ago" so they always look plausible. */
export function dateFromDaysAgo(daysAgo: number, now: Date = new Date()): Date {
  return new Date(now.getTime() - daysAgo * DAY_MS);
}

/** The mirror of the above, for anything that unlocks in the future. */
export function dateFromDaysAhead(days: number, now: Date = new Date()): Date {
  return new Date(now.getTime() + days * DAY_MS);
}

/**
 * An "open when" note only carries an unlock date when it is date-locked.
 * IMMEDIATE and MANUAL notes must keep a null date or they read as locked.
 */
export function openWhenUnlockDate(
  note: Pick<TemplateOpenWhen, 'unlockType' | 'unlockInDays'>,
  now: Date = new Date(),
): Date | null {
  if (note.unlockType !== 'DATE_LOCKED') return null;
  if (typeof note.unlockInDays !== 'number') return null;
  return dateFromDaysAhead(note.unlockInDays, now);
}

/** The real date a seeded timeline moment should land on. */
export function memoryDate(memory: Pick<TemplateMemory, 'daysAgo'>, now: Date = new Date()): Date {
  return dateFromDaysAgo(memory.daysAgo, now);
}

/**
 * Countdown blocks in a template cannot hard-code a date, so they say
 * `{ "targetDateFrom": "eventDate" }` instead. Resolve that against the
 * experience (falling back to a week from now when there is no event date)
 * and drop the marker key — it must never reach the database.
 */
export function resolveCountdownContent(
  content: Record<string, unknown>,
  eventDate: Date | null,
  now: Date = new Date(),
): Record<string, unknown> {
  const { targetDateFrom, ...rest } = content as { targetDateFrom?: unknown } & Record<
    string,
    unknown
  >;

  if (targetDateFrom !== 'eventDate') {
    // Either there was no marker, or it names a source we don't know about.
    // Either way the marker key is dropped and any literal targetDate stands.
    return rest;
  }

  const target = eventDate ?? dateFromDaysAhead(COUNTDOWN_FALLBACK_DAYS, now);
  return { ...rest, targetDate: target.toISOString() };
}
