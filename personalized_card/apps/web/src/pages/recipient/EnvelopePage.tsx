import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { makeCopy } from '../../lib/copy';
import { ThemeScope, usePrefersReducedMotion } from '../../lib/theme';
import { useMusic } from '../../stores/music';
import { motionLevelFor } from '../../components/experience/motion';
import {
  classifyFailure,
  usePublicExperience,
} from '../../components/experience/publicApi';
import { FailureScreen, LoadingScreen } from '../../components/experience/StatusScreen';
import styles from './envelope.module.css';

/**
 * The first thing a recipient sees: one closed envelope, their name on it, and
 * nothing else asking for attention.
 */
export default function EnvelopePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const reducedMotion = usePrefersReducedMotion();
  const query = usePublicExperience(token);
  const [opening, setOpening] = useState(false);
  const timerRef = useRef<number | null>(null);

  // Any pending open animation is abandoned if the page goes away first.
  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const data = query.data;
  const motionLevel = motionLevelFor(data?.theme?.animationLevel, reducedMotion);

  const open = useCallback(() => {
    if (opening || !token) return;
    // The gesture that lets music sound later on.
    useMusic.getState().markStarted();
    setOpening(true);
    const delay = motionLevel === 'none' ? 0 : 900;
    timerRef.current = window.setTimeout(() => {
      navigate(`/e/${token}/open`, { replace: true });
    }, delay);
  }, [opening, token, motionLevel, navigate]);

  if (!token) return <FailureScreen kind="notFound" />;
  if (query.isPending) return <LoadingScreen />;

  if (query.isError || !data) {
    return (
      <FailureScreen
        kind={classifyFailure(query.error)}
        onRetry={() => void query.refetch()}
      />
    );
  }

  if (data.pinRequired) return <Navigate to={`/e/${token}/pin`} replace />;

  // A creator who switched the envelope off wants the letter to open straight
  // into its welcome.
  if (!data.config.features.envelope) return <Navigate to={`/e/${token}/open`} replace />;

  const t = makeCopy(data.config, { recipient: data.recipientName, title: data.title });

  return (
    <ThemeScope theme={data.theme} className={styles.page} fullHeight>
      <main className={styles.stage}>
        <h1 className={styles.title}>{t('envelope.title')}</h1>
        <p className={styles.subtitle}>{t('envelope.subtitle')}</p>

        <motion.button
          type="button"
          className={styles.envelope}
          onClick={open}
          aria-label={t('envelope.button')}
          animate={
            motionLevel === 'full' && !opening
              ? { scale: [1, 1.015, 1] }
              : opening
                ? { scale: 1.04, opacity: 0 }
                : { scale: 1 }
          }
          transition={
            opening
              ? { duration: motionLevel === 'none' ? 0 : 0.75, ease: 'easeInOut' }
              : { duration: 5.5, repeat: Infinity, ease: 'easeInOut' }
          }
        >
          <span className={styles.body} aria-hidden />
          <span className={[styles.flap, opening && styles.flapOpen].filter(Boolean).join(' ')} aria-hidden />
          <span className={styles.seal} aria-hidden>
            {data.recipientName.trim().slice(0, 1).toUpperCase()}
          </span>
          <span className={styles.hint}>{t('envelope.hint')}</span>
        </motion.button>

        <button type="button" className={styles.openButton} onClick={open} disabled={opening}>
          {t('envelope.button')}
        </button>
      </main>
    </ThemeScope>
  );
}
