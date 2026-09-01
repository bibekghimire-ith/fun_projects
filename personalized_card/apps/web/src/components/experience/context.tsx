import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { Media, PublicExperience, ResolvedConfig } from '@letter/types';
import { makeCopy, type CopyFn } from '../../lib/copy';
import { formatDate } from '../../lib/format';
import { usePrefersReducedMotion } from '../../lib/theme';
import { buildMediaIndex } from './media';
import { motionLevelFor, type MotionLevel } from './motion';

export interface ExperienceContextValue {
  experience: PublicExperience;
  config: ResolvedConfig;
  /** Every recipient-facing string comes from here. */
  t: CopyFn;
  /** The public token, or null when the creator is previewing their own draft. */
  token: string | null;
  /**
   * A short-lived, experience-scoped token that unlocks draft media for plain
   * <img>/<audio>/<video> tags (they cannot send an Authorization header).
   * Always null on the real recipient route — a published letter's media
   * streams openly and needs no token at all.
   */
  mediaToken: string | null;
  preview: boolean;
  motionLevel: MotionLevel;
  mediaIndex: Map<string, Media>;
}

const ExperienceContext = createContext<ExperienceContextValue | null>(null);

interface ProviderProps {
  experience: PublicExperience;
  token: string | null;
  mediaToken?: string | null;
  preview: boolean;
  children: ReactNode;
}

export function ExperienceProvider({
  experience,
  token,
  mediaToken = null,
  preview,
  children,
}: ProviderProps) {
  const reducedMotion = usePrefersReducedMotion();

  const value = useMemo<ExperienceContextValue>(() => {
    const config = experience.config;
    return {
      experience,
      config,
      t: makeCopy(config, {
        recipient: experience.recipientName,
        title: experience.title,
        eventDate: formatDate(experience.eventDate, config.dateFormat, config.locale),
      }),
      token,
      mediaToken,
      preview,
      motionLevel: motionLevelFor(experience.theme?.animationLevel, reducedMotion),
      mediaIndex: buildMediaIndex(experience),
    };
  }, [experience, token, mediaToken, preview, reducedMotion]);

  return <ExperienceContext.Provider value={value}>{children}</ExperienceContext.Provider>;
}

export function useExperience(): ExperienceContextValue {
  const value = useContext(ExperienceContext);
  if (!value) {
    throw new Error('useExperience must be used inside an ExperienceProvider');
  }
  return value;
}
