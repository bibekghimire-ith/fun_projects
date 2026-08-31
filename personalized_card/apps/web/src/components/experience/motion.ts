import type { AnimationLevel } from '@letter/types';
import type { TargetAndTransition, Transition } from 'framer-motion';

/**
 * How much movement this viewer should see.
 *
 *  - `none` — no motion at all (theme set to NONE, or the OS asks for stillness)
 *  - `fade` — opacity only
 *  - `full` — opacity plus a small rise, the intended treatment
 */
export type MotionLevel = 'none' | 'fade' | 'full';

export function motionLevelFor(
  level: AnimationLevel | null | undefined,
  reducedMotion: boolean,
): MotionLevel {
  if (reducedMotion || level === 'NONE') return 'none';
  if (level === 'MINIMAL') return 'fade';
  return 'full';
}

/** The resting state before something has arrived. */
export function revealHidden(level: MotionLevel): TargetAndTransition {
  if (level === 'none') return { opacity: 1 };
  if (level === 'fade') return { opacity: 0 };
  return { opacity: 0, y: 24 };
}

/** The state once it has. */
export function revealShown(level: MotionLevel): TargetAndTransition {
  if (level === 'full') return { opacity: 1, y: 0 };
  return { opacity: 1 };
}

export function revealTransition(level: MotionLevel, delay = 0): Transition {
  if (level === 'none') return { duration: 0, delay: 0 };
  return { duration: level === 'fade' ? 0.35 : 0.7, ease: 'easeOut', delay };
}
