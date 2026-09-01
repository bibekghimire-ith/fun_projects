import { describe, expect, it } from 'vitest';
import {
  COUNTDOWN_FALLBACK_DAYS,
  DAY_MS,
  dateFromDaysAgo,
  dateFromDaysAhead,
  memoryDate,
  openWhenUnlockDate,
  resolveCountdownContent,
} from '../template.helpers';

const NOW = new Date('2025-06-01T12:00:00.000Z');

describe('template date helpers', () => {
  it('turns daysAgo into a date that far in the past', () => {
    expect(dateFromDaysAgo(10, NOW).toISOString()).toBe('2025-05-22T12:00:00.000Z');
  });

  it('treats daysAgo of 0 as now', () => {
    expect(dateFromDaysAgo(0, NOW).getTime()).toBe(NOW.getTime());
  });

  it('turns unlockInDays into a date that far ahead', () => {
    expect(dateFromDaysAhead(365, NOW).getTime()).toBe(NOW.getTime() + 365 * DAY_MS);
  });

  it('resolves a template memory against the given clock', () => {
    expect(memoryDate({ daysAgo: 1460 }, NOW).getTime()).toBe(NOW.getTime() - 1460 * DAY_MS);
  });
});

describe('open-when unlock dates', () => {
  it('only sets a date for date-locked notes', () => {
    expect(openWhenUnlockDate({ unlockType: 'DATE_LOCKED', unlockInDays: 30 }, NOW)).toEqual(
      new Date(NOW.getTime() + 30 * DAY_MS),
    );
  });

  it('leaves immediate notes with no date', () => {
    expect(openWhenUnlockDate({ unlockType: 'IMMEDIATE', unlockInDays: 30 }, NOW)).toBeNull();
  });

  it('leaves manual notes with no date', () => {
    expect(openWhenUnlockDate({ unlockType: 'MANUAL', unlockInDays: 5 }, NOW)).toBeNull();
  });

  it('defaults to no date when the type is missing', () => {
    expect(openWhenUnlockDate({ unlockInDays: 5 }, NOW)).toBeNull();
  });

  it('returns null for a date-locked note with no day count', () => {
    expect(openWhenUnlockDate({ unlockType: 'DATE_LOCKED' }, NOW)).toBeNull();
  });
});

describe('countdown targetDateFrom resolution', () => {
  it("resolves 'eventDate' to the experience's event date", () => {
    const eventDate = new Date('2025-12-25T00:00:00.000Z');
    const result = resolveCountdownContent(
      { targetDateFrom: 'eventDate', label: 'Until the day' },
      eventDate,
      NOW,
    );
    expect(result).toEqual({ label: 'Until the day', targetDate: eventDate.toISOString() });
  });

  it('falls back to a week out when the experience has no event date', () => {
    const result = resolveCountdownContent({ targetDateFrom: 'eventDate' }, null, NOW);
    expect(result.targetDate).toBe(
      new Date(NOW.getTime() + COUNTDOWN_FALLBACK_DAYS * DAY_MS).toISOString(),
    );
  });

  it('never leaves the targetDateFrom marker in the stored content', () => {
    const resolved = resolveCountdownContent({ targetDateFrom: 'eventDate' }, null, NOW);
    expect(resolved).not.toHaveProperty('targetDateFrom');

    const unknownSource = resolveCountdownContent(
      { targetDateFrom: 'somethingElse', targetDate: '2030-01-01T00:00:00.000Z' },
      null,
      NOW,
    );
    expect(unknownSource).not.toHaveProperty('targetDateFrom');
    expect(unknownSource.targetDate).toBe('2030-01-01T00:00:00.000Z');
  });

  it('leaves a literal targetDate untouched', () => {
    const content = { targetDate: '2027-06-01T00:00:00.000Z', label: 'Until then' };
    expect(resolveCountdownContent(content, new Date('2026-01-01'), NOW)).toEqual(content);
  });

  it('overrides a literal date when the marker asks for the event date', () => {
    const eventDate = new Date('2026-03-03T00:00:00.000Z');
    const result = resolveCountdownContent(
      { targetDateFrom: 'eventDate', targetDate: '2027-06-01T00:00:00.000Z' },
      eventDate,
      NOW,
    );
    expect(result.targetDate).toBe(eventDate.toISOString());
  });
});
