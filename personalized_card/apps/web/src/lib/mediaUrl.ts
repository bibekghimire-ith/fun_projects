/**
 * Media URLs and the draft media token.
 *
 * Every file is served from one authenticated streaming route. An `<img>`,
 * `<audio>` or `<video>` element cannot send an `Authorization` header, so the
 * creator's own drafts are unlocked with a short-lived, single-experience token
 * carried in the query string instead (`?mt=…`). A published letter needs no
 * token at all — the recipient renderer passes nothing and the same URLs work.
 *
 * The API already hands back fully resolved URLs (`url`, `thumbnailUrl`), and a
 * thumbnail URL already carries `?thumb=1`, so appending has to preserve any
 * query string that is already there.
 */

/** The shape of `GET /api/experiences/:id/media-token`. */
export interface MediaTokenResponse {
  token: string;
  expiresInSeconds: number;
}

/**
 * Returns `url` with the draft media token appended, or `url` untouched when
 * there is no token (a published letter) or nothing to append to.
 *
 * Any existing query string and fragment survive:
 *   `…/stream?thumb=1` → `…/stream?thumb=1&mt=…`
 */
export function withMediaToken(url: string, token?: string | null): string {
  if (!url || !token) return url;

  const hashAt = url.indexOf('#');
  const base = hashAt === -1 ? url : url.slice(0, hashAt);
  const hash = hashAt === -1 ? '' : url.slice(hashAt);

  // Idempotent: re-wrapping an already-signed URL must not stack `mt` params.
  if (/[?&]mt=/.test(base)) return url;

  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}mt=${encodeURIComponent(token)}${hash}`;
}

/**
 * The same thing for a URL that may be absent — the common case when a media
 * record has no thumbnail. Returns `null` rather than an empty `src`.
 */
export function withMediaTokenOrNull(
  url: string | null | undefined,
  token?: string | null,
): string | null {
  return url ? withMediaToken(url, token) : null;
}
