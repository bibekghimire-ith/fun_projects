import {
  COPY_KEYS,
  FEATURE_KEYS,
  resolveCopy,
  resolveFeatures,
  type CopyKey,
  type FeatureKey,
  type NavigationMode,
  type ResolvedConfig,
} from '@letter/types';

/**
 * Pure merge rules for an experience's config. Kept out of the service so the
 * behaviour that actually matters — unknown keys ignored, empty string resets a
 * copy override to the default — can be tested without a database.
 */

/** Narrow an untyped Json column to a string map without reaching for `any`. */
function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Merge a sparse set of copy overrides into what is already stored.
 *
 * Keys outside COPY_KEYS are dropped. An empty (or whitespace-only) value is
 * the creator's "put it back to the default" gesture, so the key is removed
 * rather than stored blank.
 */
export function mergeCopyOverrides(
  stored: unknown,
  incoming: Record<string, string> | undefined,
): Partial<Record<CopyKey, string>> {
  const current = asRecord(stored);
  const out: Partial<Record<CopyKey, string>> = {};

  // Keep only the stored keys we still recognise.
  for (const key of COPY_KEYS) {
    const value = current[key];
    if (typeof value === 'string' && value.trim().length > 0) out[key] = value;
  }

  if (!incoming) return out;

  for (const key of COPY_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(incoming, key)) continue;
    const value = incoming[key];
    if (typeof value !== 'string' || value.trim().length === 0) {
      delete out[key];
    } else {
      out[key] = value;
    }
  }

  return out;
}

/** The same, for feature toggles. Only real booleans on known keys survive. */
export function mergeFeatureOverrides(
  stored: unknown,
  incoming: Record<string, boolean> | undefined,
): Partial<Record<FeatureKey, boolean>> {
  const current = asRecord(stored);
  const out: Partial<Record<FeatureKey, boolean>> = {};

  for (const key of FEATURE_KEYS) {
    const value = current[key];
    if (typeof value === 'boolean') out[key] = value;
  }

  if (!incoming) return out;

  for (const key of FEATURE_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(incoming, key)) continue;
    const value = incoming[key];
    if (typeof value === 'boolean') out[key] = value;
  }

  return out;
}

/** The stored row, as far as resolving is concerned. */
export interface ConfigRowLike {
  navigationMode: NavigationMode;
  showProgressBar: boolean;
  enableConfetti: boolean;
  musicAutoplay: boolean;
  musicVolume: number;
  locale: string;
  dateFormat: string;
  copy: unknown;
  features: unknown;
}

/** Defaults used when an experience has no config row yet. */
export const CONFIG_DEFAULTS: Omit<ConfigRowLike, 'copy' | 'features'> = {
  navigationMode: 'SCROLL',
  showProgressBar: true,
  enableConfetti: true,
  musicAutoplay: true,
  musicVolume: 60,
  locale: 'en',
  dateFormat: 'MMMM d, yyyy',
};

/**
 * Turn a stored config row (or nothing at all) into the fully-resolved shape
 * the recipient client consumes, with every default already merged in.
 */
export function toResolvedConfig(row: ConfigRowLike | null | undefined): ResolvedConfig {
  const base = row ?? { ...CONFIG_DEFAULTS, copy: {}, features: {} };
  return {
    navigationMode: base.navigationMode,
    showProgressBar: base.showProgressBar,
    enableConfetti: base.enableConfetti,
    musicAutoplay: base.musicAutoplay,
    musicVolume: base.musicVolume,
    locale: base.locale,
    dateFormat: base.dateFormat,
    copy: resolveCopy(asRecord(base.copy)),
    features: resolveFeatures(asRecord(base.features)),
  };
}
