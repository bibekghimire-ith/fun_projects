import { useQuery } from '@tanstack/react-query';
import type { PublicExperience, ResolvedConfig, Theme } from '@letter/types';
import { api, ApiRequestError } from '../../api';

/**
 * `GET /api/public/e/:token` answers one of two ways: the PIN gate (just enough
 * to render the lock screen in the right voice), or the whole letter.
 */
export interface PinGate {
  pinRequired: true;
  title: string;
  recipientName: string;
  theme: Theme | null;
  config: ResolvedConfig;
  publicToken: string;
}

export type PublicExperienceResponse = PinGate | (PublicExperience & { pinRequired: false });

export const publicExperienceKey = (token: string | undefined) => ['public-experience', token];

export function usePublicExperience(token: string | undefined) {
  return useQuery({
    queryKey: publicExperienceKey(token),
    enabled: Boolean(token),
    queryFn: () => api.get<PublicExperienceResponse>(`/api/public/e/${token}`),
  });
}

export type ExperienceFailure = 'notFound' | 'unavailable' | 'generic';

/**
 * A letter that isn't there and a letter that has been paused are different
 * things to say, and neither of them is a status code.
 */
export function classifyFailure(error: unknown): ExperienceFailure {
  if (!(error instanceof ApiRequestError)) return 'generic';
  if (error.status === 404) return 'notFound';
  if (error.status === 403 || error.status === 410) return 'unavailable';
  return 'generic';
}

/** The seconds the PIN endpoint asks us to wait, when it says so. */
export function retryAfterSeconds(error: unknown): number | null {
  if (!(error instanceof ApiRequestError)) return null;
  const details = error.details;
  if (details && typeof details === 'object' && 'retryAfterSeconds' in details) {
    const value = (details as { retryAfterSeconds: unknown }).retryAfterSeconds;
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.ceil(value);
  }
  return null;
}
