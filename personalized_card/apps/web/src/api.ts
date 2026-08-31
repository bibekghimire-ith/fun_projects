import type { ApiError } from '@letter/types';

const TOKEN_KEY = 'letter_access_token';
const PIN_TOKEN_KEY = 'letter_pin_token';

/**
 * Empty by default: in dev Vite proxies /api to the API server, and in
 * production nginx does the same. Set VITE_API_BASE_URL when the API lives on
 * another origin (e.g. api.example.com).
 */
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable — the session simply won't persist */
  }
}

/** The recipient's PIN token is per-tab: it should not outlive the session. */
export function getPinToken(): string | null {
  try {
    return sessionStorage.getItem(PIN_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setPinToken(token: string | null) {
  try {
    if (token) sessionStorage.setItem(PIN_TOKEN_KEY, token);
    else sessionStorage.removeItem(PIN_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

// The access token lives 15 minutes; the refresh token sits in an httpOnly
// cookie for 7 days. Without this, a session would silently die every 15
// minutes with no way back short of logging in again — a real problem for
// something like writing a letter, which can take longer than that. A single
// in-flight refresh is shared across any requests that hit a 401 at once,
// so a page that fires several queries together doesn't fire several
// refreshes.
const NO_REFRESH_PATHS = ['/api/auth/refresh', '/api/auth/login', '/api/auth/register', '/api/auth/logout'];
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });
        if (!res.ok) return null;
        const json = (await res.json().catch(() => null)) as
          | { success: true; data: { accessToken: string } }
          | { success: false }
          | null;
        if (!json || json.success === false) return null;
        setToken(json.data.accessToken);
        return json.data.accessToken;
      } catch {
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

async function request<T>(path: string, init: RequestInit = {}, isRetry = false): Promise<T> {
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const pin = getPinToken();
  if (pin) headers.set('X-Pin-Token', pin);

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers, credentials: 'include' });
  } catch {
    throw new ApiRequestError('Could not reach the server.', 'NETWORK_ERROR', 0);
  }

  // An expired access token gets one silent refresh-and-retry, as long as
  // this wasn't already a retry and the call wasn't one of the auth routes
  // that would make that a loop (or a call with no session to refresh).
  if (
    res.status === 401 &&
    !isRetry &&
    token &&
    !NO_REFRESH_PATHS.some((p) => path.startsWith(p))
  ) {
    const refreshed = await refreshAccessToken();
    if (refreshed) return request<T>(path, init, true);
    setToken(null);
  }

  if (res.status === 204) return null as T;

  const json = (await res.json().catch(() => null)) as
    | { success: true; data: T }
    | ApiError
    | null;

  if (!res.ok || !json || json.success === false) {
    const error = json && json.success === false ? json.error : undefined;
    throw new ApiRequestError(
      error?.message ?? `Request failed (${res.status})`,
      error?.code ?? 'UNKNOWN',
      res.status,
      error?.details,
    );
  }

  return json.data;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body ?? {}),
    }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),

  /**
   * Upload with progress — fetch cannot report it, so this uses XHR.
   * Unlike `request()`, this does not retry on an expired access token: a
   * failed upload simply surfaces the error, same as any other network
   * failure, rather than silently restarting a large in-flight transfer.
   */
  upload: <T>(path: string, form: FormData, onProgress?: (percent: number) => void) =>
    new Promise<T>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE_URL}${path}`);
      xhr.withCredentials = true;
      const token = getToken();
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      };
      xhr.onload = () => {
        let parsed: { success?: boolean; data?: T; error?: { code: string; message: string } } | null =
          null;
        try {
          parsed = JSON.parse(xhr.responseText);
        } catch {
          /* fall through to the generic error below */
        }
        if (xhr.status >= 200 && xhr.status < 300 && parsed?.success) {
          resolve(parsed.data as T);
        } else {
          reject(
            new ApiRequestError(
              parsed?.error?.message ?? `Upload failed (${xhr.status})`,
              parsed?.error?.code ?? 'UPLOAD_FAILED',
              xhr.status,
            ),
          );
        }
      };
      xhr.onerror = () => reject(new ApiRequestError('Upload failed.', 'NETWORK_ERROR', 0));
      xhr.send(form);
    }),
};
