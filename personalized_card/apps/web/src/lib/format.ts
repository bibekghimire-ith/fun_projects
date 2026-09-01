/**
 * Tiny date formatter. The app lets a creator choose a date format string, and
 * pulling in a full i18n library for that would be heavier than the feature.
 * Supported tokens: yyyy yy MMMM MMM MM M dd d EEEE EEE HH mm.
 */
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function formatDate(
  value: string | Date | null | undefined,
  pattern = 'MMMM d, yyyy',
  locale?: string,
): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const months = localizedMonths(locale) ?? MONTHS;
  const days = localizedDays(locale) ?? DAYS;

  const replacements: Record<string, string> = {
    yyyy: String(date.getFullYear()),
    yy: String(date.getFullYear()).slice(-2),
    MMMM: months[date.getMonth()],
    MMM: months[date.getMonth()].slice(0, 3),
    MM: String(date.getMonth() + 1).padStart(2, '0'),
    M: String(date.getMonth() + 1),
    dd: String(date.getDate()).padStart(2, '0'),
    d: String(date.getDate()),
    EEEE: days[date.getDay()],
    EEE: days[date.getDay()].slice(0, 3),
    HH: String(date.getHours()).padStart(2, '0'),
    mm: String(date.getMinutes()).padStart(2, '0'),
  };

  // Longest tokens first so "MMMM" is not eaten by "MM".
  return pattern.replace(/yyyy|yy|MMMM|MMM|MM|M|dd|d|EEEE|EEE|HH|mm/g, (token) => replacements[token] ?? token);
}

function localizedMonths(locale?: string): string[] | null {
  if (!locale || locale === 'en') return null;
  try {
    const formatter = new Intl.DateTimeFormat(locale, { month: 'long' });
    return Array.from({ length: 12 }, (_, index) => formatter.format(new Date(2020, index, 1)));
  } catch {
    return null;
  }
}

function localizedDays(locale?: string): string[] | null {
  if (!locale || locale === 'en') return null;
  try {
    const formatter = new Intl.DateTimeFormat(locale, { weekday: 'long' });
    // 2024-01-07 was a Sunday.
    return Array.from({ length: 7 }, (_, index) => formatter.format(new Date(2024, 0, 7 + index)));
  } catch {
    return null;
  }
}

export interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
  done: boolean;
}

export function countdownTo(target: string | Date, now: Date = new Date()): Countdown {
  const end = target instanceof Date ? target : new Date(target);
  const total = Math.max(0, end.getTime() - now.getTime());
  return {
    days: Math.floor(total / 86_400_000),
    hours: Math.floor((total % 86_400_000) / 3_600_000),
    minutes: Math.floor((total % 3_600_000) / 60_000),
    seconds: Math.floor((total % 60_000) / 1000),
    total,
    done: total <= 0,
  };
}

/** "in 3 months" / "4 days ago" — used on dashboard cards and timelines. */
export function relativeTime(value: string | Date, now: Date = new Date()): string {
  const date = value instanceof Date ? value : new Date(value);
  const diff = date.getTime() - now.getTime();
  const abs = Math.abs(diff);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31_536_000_000],
    ['month', 2_592_000_000],
    ['week', 604_800_000],
    ['day', 86_400_000],
    ['hour', 3_600_000],
    ['minute', 60_000],
  ];
  for (const [unit, ms] of units) {
    if (abs >= ms) {
      const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
      return formatter.format(Math.round(diff / ms), unit);
    }
  }
  return 'just now';
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds < 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}
