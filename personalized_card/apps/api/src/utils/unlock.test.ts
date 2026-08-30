import { describe, expect, it } from 'vitest';
import { isFutureLetterUnlocked, isOpenWhenUnlocked } from '../utils/unlock';

describe('unlock helpers', () => {
  it('unlocks future letters only after the date', () => {
    const past = new Date('2020-01-01');
    const future = new Date('2099-01-01');
    expect(isFutureLetterUnlocked(past, new Date('2021-01-01'))).toBe(true);
    expect(isFutureLetterUnlocked(future, new Date('2021-01-01'))).toBe(false);
  });

  it('handles open-when unlock types', () => {
    expect(
      isOpenWhenUnlocked({ unlockType: 'IMMEDIATE', unlockDate: null, openedAt: null }),
    ).toBe(true);
    expect(
      isOpenWhenUnlocked({
        unlockType: 'DATE_LOCKED',
        unlockDate: new Date('2099-01-01'),
        openedAt: null,
      }),
    ).toBe(false);
    expect(
      isOpenWhenUnlocked({ unlockType: 'MANUAL', unlockDate: null, openedAt: null }),
    ).toBe(false);
    expect(
      isOpenWhenUnlocked({ unlockType: 'MANUAL', unlockDate: null, openedAt: new Date() }),
    ).toBe(true);
  });
});
