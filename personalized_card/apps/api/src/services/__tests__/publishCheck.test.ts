import { describe, expect, it } from 'vitest';
import { PUBLISH_ISSUE, evaluatePublishCheck, type PublishCheckInput } from '../publishCheck';

const NOW = new Date('2025-06-01T12:00:00.000Z');

function ready(overrides: Partial<PublishCheckInput> = {}): PublishCheckInput {
  return {
    id: 'exp-1',
    title: 'Happy birthday',
    recipientName: 'Sam',
    coverMediaId: 'media-1',
    pinEnabled: false,
    pinHash: null,
    sections: [{ enabled: true, blocks: [{ enabled: true }] }],
    futureLetter: null,
    ...overrides,
  };
}

const codes = (input: PublishCheckInput) =>
  evaluatePublishCheck(input, NOW).issues.map((issue) => issue.code);

describe('evaluatePublishCheck', () => {
  it('passes a complete experience', () => {
    const check = evaluatePublishCheck(ready(), NOW);
    expect(check.ok).toBe(true);
    expect(check.issues).toEqual([]);
  });

  it('flags a missing title', () => {
    expect(codes(ready({ title: null }))).toContain(PUBLISH_ISSUE.MISSING_TITLE);
    expect(codes(ready({ title: '   ' }))).toContain(PUBLISH_ISSUE.MISSING_TITLE);
  });

  it('flags a missing recipient name', () => {
    expect(codes(ready({ recipientName: '' }))).toContain(PUBLISH_ISSUE.MISSING_RECIPIENT);
  });

  it('flags a missing cover image', () => {
    expect(codes(ready({ coverMediaId: null }))).toContain(PUBLISH_ISSUE.MISSING_COVER);
  });

  it('flags an experience with no sections at all', () => {
    expect(codes(ready({ sections: [] }))).toContain(PUBLISH_ISSUE.NO_CONTENT);
  });

  it('flags an experience whose only section is switched off', () => {
    expect(codes(ready({ sections: [{ enabled: false, blocks: [{ enabled: true }] }] }))).toContain(
      PUBLISH_ISSUE.NO_CONTENT,
    );
  });

  it('flags a section with no enabled blocks in it', () => {
    expect(
      codes(ready({ sections: [{ enabled: true, blocks: [{ enabled: false }] }] })),
    ).toContain(PUBLISH_ISSUE.NO_CONTENT);
    expect(codes(ready({ sections: [{ enabled: true, blocks: [] }] }))).toContain(
      PUBLISH_ISSUE.NO_CONTENT,
    );
  });

  it('accepts content as long as one enabled section has one enabled block', () => {
    const check = evaluatePublishCheck(
      ready({
        sections: [
          { enabled: false, blocks: [{ enabled: true }] },
          { enabled: true, blocks: [{ enabled: false }, { enabled: true }] },
        ],
      }),
      NOW,
    );
    expect(check.issues.map((i) => i.code)).not.toContain(PUBLISH_ISSUE.NO_CONTENT);
  });

  it('flags a future letter that unlocks in the past', () => {
    expect(
      codes(ready({ futureLetter: { unlockDate: new Date('2024-01-01T00:00:00.000Z') } })),
    ).toContain(PUBLISH_ISSUE.FUTURE_LETTER_IN_PAST);
  });

  it('flags a future letter that unlocks exactly now', () => {
    expect(codes(ready({ futureLetter: { unlockDate: NOW } }))).toContain(
      PUBLISH_ISSUE.FUTURE_LETTER_IN_PAST,
    );
  });

  it('accepts a future letter that unlocks later, given as a string', () => {
    const check = evaluatePublishCheck(
      ready({ futureLetter: { unlockDate: '2026-01-01T00:00:00.000Z' } }),
      NOW,
    );
    expect(check.ok).toBe(true);
  });

  it('flags an unparseable unlock date', () => {
    expect(codes(ready({ futureLetter: { unlockDate: 'not a date' } }))).toContain(
      PUBLISH_ISSUE.FUTURE_LETTER_IN_PAST,
    );
  });

  it('flags a PIN that was asked for but never set', () => {
    expect(codes(ready({ pinEnabled: true, pinHash: null }))).toContain(PUBLISH_ISSUE.PIN_NOT_SET);
  });

  it('accepts a PIN that is actually set', () => {
    const check = evaluatePublishCheck(ready({ pinEnabled: true, pinHash: '$argon2id$…' }), NOW);
    expect(check.ok).toBe(true);
  });

  it('reports every problem at once rather than one at a time', () => {
    const check = evaluatePublishCheck(
      {
        id: 'exp-2',
        title: '',
        recipientName: '',
        coverMediaId: null,
        pinEnabled: true,
        pinHash: null,
        sections: [],
        futureLetter: { unlockDate: new Date('2020-01-01') },
      },
      NOW,
    );
    expect(check.ok).toBe(false);
    expect(check.issues).toHaveLength(6);
  });

  it('points each issue at somewhere the creator can fix it', () => {
    const check = evaluatePublishCheck(ready({ coverMediaId: null }), NOW);
    expect(check.issues[0].fixPath).toBe('/experiences/exp-1/media');
    expect(check.issues[0].message.length).toBeGreaterThan(0);
  });
});
