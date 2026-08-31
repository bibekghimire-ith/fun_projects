import { describe, expect, it } from 'vitest';
import { DEFAULT_COPY, DEFAULT_FEATURES, resolveCopy, resolveFeatures } from '@letter/types';
import {
  CONFIG_DEFAULTS,
  mergeCopyOverrides,
  mergeFeatureOverrides,
  toResolvedConfig,
} from '../config.helpers';

describe('resolveCopy', () => {
  it('falls back to every default when there are no overrides', () => {
    expect(resolveCopy(null)).toEqual(DEFAULT_COPY);
    expect(resolveCopy(undefined)).toEqual(DEFAULT_COPY);
    expect(resolveCopy({})).toEqual(DEFAULT_COPY);
  });

  it('merges a known override over the default', () => {
    const resolved = resolveCopy({ 'envelope.title': "It's your birthday." });
    expect(resolved['envelope.title']).toBe("It's your birthday.");
    expect(resolved['envelope.button']).toBe(DEFAULT_COPY['envelope.button']);
  });

  it('ignores keys that are not real copy keys', () => {
    const resolved = resolveCopy({ 'not.a.key': 'nope' } as Record<string, string>);
    expect(resolved).toEqual(DEFAULT_COPY);
    expect(resolved).not.toHaveProperty('not.a.key');
  });

  it('ignores blank and non-string values', () => {
    const resolved = resolveCopy({
      'envelope.title': '   ',
      'envelope.button': 42,
    } as unknown as Record<string, string>);
    expect(resolved['envelope.title']).toBe(DEFAULT_COPY['envelope.title']);
    expect(resolved['envelope.button']).toBe(DEFAULT_COPY['envelope.button']);
  });
});

describe('resolveFeatures', () => {
  it('defaults every module to on', () => {
    expect(resolveFeatures(null)).toEqual(DEFAULT_FEATURES);
  });

  it('lets a creator switch a module off', () => {
    expect(resolveFeatures({ openWhen: false }).openWhen).toBe(false);
    expect(resolveFeatures({ openWhen: false }).timeline).toBe(true);
  });

  it('ignores unknown keys and non-boolean values', () => {
    const resolved = resolveFeatures({
      notAFeature: false,
      timeline: 'no',
    } as unknown as Record<string, boolean>);
    expect(resolved).toEqual(DEFAULT_FEATURES);
  });
});

describe('mergeCopyOverrides', () => {
  it('keeps stored overrides that are not mentioned', () => {
    const merged = mergeCopyOverrides({ 'envelope.title': 'Stored' }, { 'nav.next': 'Onwards' });
    expect(merged['envelope.title']).toBe('Stored');
    expect(merged['nav.next']).toBe('Onwards');
  });

  it('treats an empty string as a reset to the default', () => {
    const merged = mergeCopyOverrides(
      { 'envelope.title': 'Stored', 'nav.next': 'Onwards' },
      { 'envelope.title': '' },
    );
    expect(merged).not.toHaveProperty('envelope.title');
    expect(merged['nav.next']).toBe('Onwards');

    // And the resolved view goes back to the shipped wording.
    expect(resolveCopy(merged)['envelope.title']).toBe(DEFAULT_COPY['envelope.title']);
  });

  it('treats a whitespace-only string the same way', () => {
    const merged = mergeCopyOverrides({ 'envelope.title': 'Stored' }, { 'envelope.title': '   ' });
    expect(merged).not.toHaveProperty('envelope.title');
  });

  it('drops unknown keys from both the stored map and the incoming one', () => {
    const merged = mergeCopyOverrides(
      { 'made.up': 'x', 'nav.next': 'Stored' },
      { 'also.made.up': 'y' },
    );
    expect(merged).toEqual({ 'nav.next': 'Stored' });
  });

  it('copes with a stored value that is not an object at all', () => {
    expect(mergeCopyOverrides(null, { 'nav.next': 'Onwards' })).toEqual({ 'nav.next': 'Onwards' });
    expect(mergeCopyOverrides('nonsense', undefined)).toEqual({});
    expect(mergeCopyOverrides(['nope'], undefined)).toEqual({});
  });
});

describe('mergeFeatureOverrides', () => {
  it('merges booleans and keeps untouched ones', () => {
    const merged = mergeFeatureOverrides({ timeline: false }, { openWhen: false });
    expect(merged).toEqual({ timeline: false, openWhen: false });
  });

  it('lets a module be switched back on', () => {
    expect(mergeFeatureOverrides({ timeline: false }, { timeline: true }).timeline).toBe(true);
  });

  it('ignores unknown keys and non-boolean values', () => {
    const merged = mergeFeatureOverrides(
      { madeUp: true },
      { alsoMadeUp: false, timeline: 'no' } as unknown as Record<string, boolean>,
    );
    expect(merged).toEqual({});
  });
});

describe('toResolvedConfig', () => {
  it('uses the shipped defaults when there is no row yet', () => {
    const resolved = toResolvedConfig(null);
    expect(resolved.navigationMode).toBe(CONFIG_DEFAULTS.navigationMode);
    expect(resolved.musicVolume).toBe(CONFIG_DEFAULTS.musicVolume);
    expect(resolved.copy).toEqual(DEFAULT_COPY);
    expect(resolved.features).toEqual(DEFAULT_FEATURES);
  });

  it('merges a stored row over the defaults', () => {
    const resolved = toResolvedConfig({
      navigationMode: 'CHAPTERS',
      showProgressBar: false,
      enableConfetti: false,
      musicAutoplay: false,
      musicVolume: 10,
      locale: 'fr',
      dateFormat: 'd MMMM yyyy',
      copy: { 'envelope.title': 'Bonjour' },
      features: { openWhen: false },
    });

    expect(resolved.navigationMode).toBe('CHAPTERS');
    expect(resolved.musicVolume).toBe(10);
    expect(resolved.copy['envelope.title']).toBe('Bonjour');
    expect(resolved.copy['nav.next']).toBe(DEFAULT_COPY['nav.next']);
    expect(resolved.features.openWhen).toBe(false);
    expect(resolved.features.timeline).toBe(true);
  });
});
