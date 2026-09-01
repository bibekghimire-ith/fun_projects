import type { PublishCheck } from '@letter/types';

/**
 * Everything the publish check needs, and nothing else — a plain object so the
 * rules can be unit-tested without a database behind them.
 */
export interface PublishCheckInput {
  id: string;
  title: string | null;
  recipientName: string | null;
  coverMediaId: string | null;
  pinEnabled: boolean;
  pinHash: string | null;
  sections: { enabled: boolean; blocks: { enabled: boolean }[] }[];
  futureLetter: { unlockDate: Date | string } | null;
}

/** Issue codes, so callers (and the cover waiver) can match on something stable. */
export const PUBLISH_ISSUE = {
  MISSING_TITLE: 'MISSING_TITLE',
  MISSING_RECIPIENT: 'MISSING_RECIPIENT',
  MISSING_COVER: 'MISSING_COVER',
  NO_CONTENT: 'NO_CONTENT',
  FUTURE_LETTER_IN_PAST: 'FUTURE_LETTER_IN_PAST',
  PIN_NOT_SET: 'PIN_NOT_SET',
} as const;

function isBlank(value: string | null | undefined): boolean {
  return !value || value.trim().length === 0;
}

/**
 * Decide whether an experience is ready for someone to open.
 *
 * The messages are written the way the product speaks to a creator: plainly,
 * warmly, and always naming the next thing to do rather than the failure.
 */
export function evaluatePublishCheck(
  experience: PublishCheckInput,
  now: Date = new Date(),
): PublishCheck {
  const issues: PublishCheck['issues'] = [];
  const at = (suffix: string) => `/experiences/${experience.id}/${suffix}`;

  if (isBlank(experience.title)) {
    issues.push({
      code: PUBLISH_ISSUE.MISSING_TITLE,
      message: 'This letter still needs a title. A few words is plenty.',
      fixPath: at('settings'),
    });
  }

  if (isBlank(experience.recipientName)) {
    issues.push({
      code: PUBLISH_ISSUE.MISSING_RECIPIENT,
      message: "Add the name of the person you're sending this to, so it can greet them properly.",
      fixPath: at('settings'),
    });
  }

  if (!experience.coverMediaId) {
    issues.push({
      code: PUBLISH_ISSUE.MISSING_COVER,
      message: 'Choose a cover image — it is the first thing they will see.',
      fixPath: at('media'),
    });
  }

  const hasContent = experience.sections.some(
    (section) => section.enabled && section.blocks.some((block) => block.enabled),
  );
  if (!hasContent) {
    issues.push({
      code: PUBLISH_ISSUE.NO_CONTENT,
      message: 'There is nothing to read yet. Add a chapter with at least one block in it.',
      fixPath: at('edit'),
    });
  }

  if (experience.futureLetter) {
    const unlockDate = new Date(experience.futureLetter.unlockDate);
    if (Number.isNaN(unlockDate.getTime()) || unlockDate.getTime() <= now.getTime()) {
      issues.push({
        code: PUBLISH_ISSUE.FUTURE_LETTER_IN_PAST,
        message:
          'Your future letter unlocks in the past, so it would open straight away. Pick a date still to come.',
        fixPath: at('future-letter'),
      });
    }
  }

  if (experience.pinEnabled && !experience.pinHash) {
    issues.push({
      code: PUBLISH_ISSUE.PIN_NOT_SET,
      message: 'You asked for a PIN but have not set one yet. Choose four digits, or turn the PIN off.',
      fixPath: at('share'),
    });
  }

  return { ok: issues.length === 0, issues };
}
