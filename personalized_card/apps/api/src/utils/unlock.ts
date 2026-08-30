export function isFutureLetterUnlocked(unlockDate: Date, now = new Date()): boolean {
  return now.getTime() >= unlockDate.getTime();
}

export function isOpenWhenUnlocked(
  msg: {
    unlockType: string;
    unlockDate: Date | null;
    openedAt: Date | null;
  },
  now = new Date(),
): boolean {
  if (msg.unlockType === 'IMMEDIATE') return true;
  if (msg.unlockType === 'DATE_LOCKED') {
    return msg.unlockDate ? now.getTime() >= msg.unlockDate.getTime() : false;
  }
  if (msg.unlockType === 'MANUAL') {
    return msg.openedAt !== null;
  }
  return false;
}
