import { describe, expect, it } from 'vitest';
import { DEFAULT_COPY, resolveCopy, type ResolvedConfig } from '@letter/types';
import { makeCopy } from './copy';

function configWith(copy: ResolvedConfig['copy']): Pick<ResolvedConfig, 'copy'> {
  return { copy };
}

describe('makeCopy', () => {
  it('falls back to DEFAULT_COPY for a key with no override', () => {
    const t = makeCopy(configWith(resolveCopy({})));
    expect(t('welcome.subtitle')).toBe(DEFAULT_COPY['welcome.subtitle']);
  });

  it("uses the experience's own override when one is set", () => {
    const t = makeCopy(configWith(resolveCopy({ 'welcome.greeting': 'Hey {recipient}!' })));
    expect(t('welcome.greeting', { recipient: 'Sam' })).toBe('Hey Sam!');
  });

  it('fills in the standing tokens (recipient, title, eventDate) on every call', () => {
    const t = makeCopy(
      configWith(resolveCopy({ 'welcome.greeting': 'Hi {recipient}, from your {title} on {eventDate}.' })),
      { recipient: 'Sam', title: 'Anniversary', eventDate: 'June 1' },
    );
    expect(t('welcome.greeting')).toBe('Hi Sam, from your Anniversary on June 1.');
  });

  it('lets a per-call token win over the standing one for that call only', () => {
    const t = makeCopy(configWith(resolveCopy({})), { recipient: 'Sam' });
    expect(t('welcome.greeting', { recipient: 'Alex' })).not.toContain('Sam');
    // The standing token is untouched for the next call.
    expect(t('welcome.greeting')).toContain('Sam');
  });

  it('leaves an unmatched token in place rather than blanking it out', () => {
    const t = makeCopy(configWith(resolveCopy({ 'welcome.greeting': 'Hi {recipient}!' })));
    expect(t('welcome.greeting')).toBe('Hi {recipient}!');
  });

  it('falls back to DEFAULT_COPY entirely when config is missing', () => {
    const t = makeCopy(undefined);
    expect(t('nav.next')).toBe(DEFAULT_COPY['nav.next']);
  });
});
