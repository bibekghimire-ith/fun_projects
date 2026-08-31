import { DEFAULT_COPY, interpolate, type CopyKey, type ResolvedConfig } from '@letter/types';

export interface CopyTokens {
  recipient?: string | null;
  sender?: string | null;
  title?: string | null;
  eventDate?: string | null;
  [key: string]: string | null | undefined;
}

export type CopyFn = (key: CopyKey, extraTokens?: CopyTokens) => string;

/**
 * Returns a `t()` for the recipient experience. Copy comes from the resolved
 * config (defaults already merged server-side); tokens like {recipient} are
 * filled in here so the creator can write "Hi {recipient}." once.
 */
export function makeCopy(
  config: Pick<ResolvedConfig, 'copy'> | null | undefined,
  tokens: CopyTokens = {},
): CopyFn {
  const table = config?.copy ?? DEFAULT_COPY;
  return (key, extraTokens) =>
    interpolate(table[key] ?? DEFAULT_COPY[key] ?? '', { ...tokens, ...extraTokens });
}
