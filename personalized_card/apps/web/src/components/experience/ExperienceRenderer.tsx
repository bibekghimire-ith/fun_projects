import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import type { ExperienceSection, PublicExperience } from '@letter/types';
import { cx } from '../../ui';
import { useMusic } from '../../stores/music';
import { BlockRenderer } from './BlockRenderer';
import { ClosingScreen } from './ClosingScreen';
import { ExperienceProvider, useExperience } from './context';
import { useSwipe } from './hooks';
import { MusicPlayer } from './MusicPlayer';
import { revealHidden, revealShown, revealTransition } from './motion';
import { WelcomeScreen } from './WelcomeScreen';
import styles from './renderer.module.css';

export interface ExperienceRendererProps {
  experience: PublicExperience;
  /** The public token, or null when the creator is previewing a draft. */
  token: string | null;
  /**
   * A short-lived, experience-scoped token that unlocks draft media for plain
   * <img>/<audio>/<video> tags. Only ever set by the creator's own preview —
   * the real recipient route has no reason to pass one.
   */
  mediaToken?: string | null;
  preview?: boolean;
}

/** The progress bar's only dynamic value, passed as a custom property. */
type ProgressStyle = CSSProperties & Record<'--progress', number>;

type Step =
  | { kind: 'welcome'; key: string }
  | { kind: 'section'; key: string; section: ExperienceSection }
  | { kind: 'closing'; key: string };

/**
 * The whole letter. The recipient route and the creator's preview both render
 * this same component — there is no second implementation to drift.
 */
export default function ExperienceRenderer({
  experience,
  token,
  mediaToken = null,
  preview = false,
}: ExperienceRendererProps) {
  return (
    <ExperienceProvider
      experience={experience}
      token={token}
      mediaToken={mediaToken}
      preview={preview}
    >
      <ExperienceBody />
    </ExperienceProvider>
  );
}

function ExperienceBody() {
  const { experience, config, t, motionLevel } = useExperience();
  const features = config.features;

  const steps = useMemo<Step[]>(() => {
    const out: Step[] = [];
    if (features.welcome) out.push({ kind: 'welcome', key: 'welcome' });
    for (const section of experience.sections) {
      if (section.enabled === false) continue;
      out.push({ kind: 'section', key: section.id, section });
    }
    if (features.closing) out.push({ kind: 'closing', key: 'closing' });
    // Never nothing: an empty letter still opens on its welcome.
    if (out.length === 0) out.push({ kind: 'welcome', key: 'welcome' });
    return out;
  }, [experience.sections, features.welcome, features.closing]);

  /**
   * `chapters` gates the one-at-a-time reading mode, not the writing itself —
   * switching it off falls back to the single scrolling page rather than
   * hiding a creator's chapters.
   */
  const chapterMode = config.navigationMode === 'CHAPTERS' && features.chapters;

  const [index, setIndex] = useState(0);
  const [activeScrollStep, setActiveScrollStep] = useState(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const movedRef = useRef(false);

  const total = steps.length;
  const current = Math.min(index, total - 1);
  const progressIndex = chapterMode ? current : activeScrollStep;

  const goTo = useCallback(
    (target: number) => {
      const clamped = Math.min(Math.max(target, 0), total - 1);
      if (clamped === current) return;
      movedRef.current = true;
      setIndex(clamped);
    },
    [current, total],
  );

  const next = useCallback(() => goTo(current + 1), [goTo, current]);
  const previous = useCallback(() => goTo(current - 1), [goTo, current]);
  const swipe = useSwipe(next, previous);

  /** The welcome's "begin" — scrolls onward, or turns the page. */
  const begin = useCallback(() => {
    useMusic.getState().markStarted();
    if (chapterMode) {
      next();
      return;
    }
    const container = stageRef.current;
    const target = container?.querySelectorAll<HTMLElement>('[data-step]')[1];
    target?.scrollIntoView({ behavior: motionLevel === 'none' ? 'auto' : 'smooth', block: 'start' });
  }, [chapterMode, next, motionLevel]);

  const replay = useCallback(() => {
    if (chapterMode) {
      goTo(0);
      return;
    }
    topRef.current?.scrollIntoView({
      behavior: motionLevel === 'none' ? 'auto' : 'smooth',
      block: 'start',
    });
  }, [chapterMode, goTo, motionLevel]);

  // Arrow keys turn the page, unless the recipient is typing.
  useEffect(() => {
    if (!chapterMode) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (target?.isContentEditable) return;
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        next();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        previous();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [chapterMode, next, previous]);

  // Land focus at the top of the new chapter, but only after a real move — not
  // on first paint, which would steal focus from nothing.
  useEffect(() => {
    if (!chapterMode || !movedRef.current) return;
    movedRef.current = false;
    stageRef.current?.focus();
    stageRef.current?.scrollTo?.({ top: 0 });
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [chapterMode, current]);

  const onScrollStepVisible = useCallback((stepIndex: number) => {
    setActiveScrollStep(stepIndex);
  }, []);

  const renderStep = (step: Step): ReactNode => {
    if (step.kind === 'welcome') return <WelcomeScreen onBegin={begin} />;
    if (step.kind === 'closing') return <ClosingScreen onReplay={replay} />;
    return <SectionView section={step.section} />;
  };

  const stepTitle = (step: Step): string =>
    step.kind === 'section' ? step.section.title : experience.title;

  return (
    <div className={styles.experience} ref={topRef}>
      <MusicPlayer />

      {config.showProgressBar && (
        <div className={styles.progress}>
          <div
            className={styles.progressTrack}
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={total}
            aria-valuenow={progressIndex + 1}
            aria-valuetext={t('nav.progress', {
              current: String(progressIndex + 1),
              total: String(total),
            })}
          >
            <span
              className={styles.progressFill}
              style={{ '--progress': (progressIndex + 1) / total } as ProgressStyle}
            />
          </div>
        </div>
      )}

      {chapterMode ? (
        <>
          <div
            className={styles.stage}
            ref={stageRef}
            tabIndex={-1}
            onTouchStart={swipe.onTouchStart}
            onTouchEnd={swipe.onTouchEnd}
          >
            <motion.div
              key={steps[current].key}
              className={styles.chapter}
              initial={revealHidden(motionLevel)}
              animate={revealShown(motionLevel)}
              transition={revealTransition(motionLevel)}
            >
              {renderStep(steps[current])}
            </motion.div>
          </div>

          {/* Announced calmly, once per chapter. */}
          <p className={styles.srOnly} role="status" aria-live="polite">
            {t('nav.progress', { current: String(current + 1), total: String(total) })}
            {' — '}
            {stepTitle(steps[current])}
          </p>

          <nav className={styles.nav}>
            <button
              type="button"
              className={styles.navButton}
              onClick={previous}
              disabled={current === 0}
            >
              <ChevronLeft size={18} aria-hidden />
              <span>{t('nav.previous')}</span>
            </button>

            {current < total - 1 && (
              <button
                type="button"
                className={cx(styles.navButton, styles.skip)}
                onClick={() => goTo(total - 1)}
              >
                {t('nav.skip')}
              </button>
            )}

            <button
              type="button"
              className={cx(styles.navButton, styles.navPrimary)}
              onClick={next}
              disabled={current === total - 1}
            >
              <span>{t('nav.next')}</span>
              <ChevronRight size={18} aria-hidden />
            </button>
          </nav>
        </>
      ) : (
        <div className={styles.scroll} ref={stageRef}>
          {steps.map((step, stepIndex) => (
            <ScrollStep
              key={step.key}
              index={stepIndex}
              onVisible={onScrollStepVisible}
              showHint={
                stepIndex === 0 && steps.length > 1 && features.scrollHint && step.kind === 'welcome'
              }
            >
              {renderStep(step)}
            </ScrollStep>
          ))}
        </div>
      )}
    </div>
  );
}

/** One section's blocks, in order. */
function SectionView({ section }: { section: ExperienceSection }) {
  const blocks = section.blocks.filter((block) => block.enabled !== false);
  if (blocks.length === 0) return null;
  return (
    <section className={styles.section} aria-label={section.title}>
      {blocks.map((block) => (
        <BlockRenderer key={block.id} block={block} />
      ))}
    </section>
  );
}

interface ScrollStepProps {
  index: number;
  children: ReactNode;
  onVisible: (index: number) => void;
  showHint: boolean;
}

/**
 * A step on the long page: it rises into place the first time it is seen, and
 * tells the progress bar where the reader is.
 */
function ScrollStep({ index, children, onVisible, showHint }: ScrollStepProps) {
  const { motionLevel } = useExperience();
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(motionLevel === 'none');

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    if (typeof IntersectionObserver === 'undefined') {
      setSeen(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          setSeen(true);
          onVisible(index);
        }
      },
      { threshold: 0, rootMargin: '0px 0px -35% 0px' },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [index, onVisible]);

  return (
    <motion.div
      ref={ref}
      className={styles.scrollStep}
      data-step={index}
      initial={revealHidden(motionLevel)}
      animate={seen ? revealShown(motionLevel) : revealHidden(motionLevel)}
      transition={revealTransition(motionLevel)}
    >
      {children}
      {showHint && (
        <span className={styles.hint} aria-hidden>
          <ChevronDown size={20} />
        </span>
      )}
    </motion.div>
  );
}
