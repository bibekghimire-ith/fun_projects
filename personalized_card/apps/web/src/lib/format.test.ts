import { describe, expect, it } from 'vitest';
import { countdownTo, formatBytes, formatDate, formatDuration, relativeTime } from './format';

describe('formatDate', () => {
  it('renders the default pattern', () => {
    // A local-time Date, deliberately not a UTC ISO string: formatDate reads
    // getMonth()/getDate() (local-time accessors), so a "...T00:00:00Z"
    // literal would read as the previous day in any timezone west of UTC and
    // make this test flaky depending on where it runs.
    expect(formatDate(new Date(2026, 2, 5), 'MMMM d, yyyy')).toBe('March 5, 2026');
  });

  it('supports every documented token, longest-first so MMMM is not eaten by MM', () => {
    const date = new Date(2024, 0, 7); // a Sunday
    expect(formatDate(date, 'EEEE, MMMM d, yyyy')).toBe('Sunday, January 7, 2024');
    expect(formatDate(date, 'MM/dd/yy')).toBe('01/07/24');
    expect(formatDate(date, 'EEE MMM d')).toBe('Sun Jan 7');
  });

  it('returns an empty string for nothing, and for a date that does not parse', () => {
    expect(formatDate(null)).toBe('');
    expect(formatDate(undefined)).toBe('');
    expect(formatDate('not a date')).toBe('');
  });

  it('accepts a Date instance directly, not only a string', () => {
    expect(formatDate(new Date(2030, 11, 25), 'MMMM d, yyyy')).toBe('December 25, 2030');
  });
});

describe('countdownTo', () => {
  it('breaks a future date down into days/hours/minutes/seconds', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const target = new Date('2026-01-03T01:02:03.000Z');
    const result = countdownTo(target, now);
    expect(result).toEqual({ days: 2, hours: 1, minutes: 2, seconds: 3, total: result.total, done: false });
    expect(result.done).toBe(false);
  });

  it('never goes negative, and reports done once the date has passed', () => {
    const now = new Date('2026-01-05T00:00:00.000Z');
    const target = new Date('2026-01-01T00:00:00.000Z');
    const result = countdownTo(target, now);
    expect(result.total).toBe(0);
    expect(result.done).toBe(true);
    expect(result.days).toBe(0);
  });
});

describe('relativeTime', () => {
  it('describes the future and the past in whole units', () => {
    const now = new Date('2026-06-01T00:00:00.000Z');
    expect(relativeTime(new Date('2026-06-02T00:00:00.000Z'), now)).toMatch(/tomorrow|in 1 day/);
    expect(relativeTime(new Date('2026-05-31T00:00:00.000Z'), now)).toMatch(/yesterday|1 day ago/);
  });

  it('falls back to "just now" for anything under a minute', () => {
    const now = new Date('2026-06-01T00:00:30.000Z');
    expect(relativeTime(new Date('2026-06-01T00:00:00.000Z'), now)).toBe('just now');
  });
});

describe('formatBytes', () => {
  it('picks the right unit at each size', () => {
    expect(formatBytes(500)).toBe('500 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});

describe('formatDuration', () => {
  it('formats seconds as m:ss', () => {
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(5)).toBe('0:05');
    expect(formatDuration(600)).toBe('10:00');
  });

  it('treats missing or negative durations as zero', () => {
    expect(formatDuration(null)).toBe('0:00');
    expect(formatDuration(undefined)).toBe('0:00');
    expect(formatDuration(-5)).toBe('0:00');
  });
});
