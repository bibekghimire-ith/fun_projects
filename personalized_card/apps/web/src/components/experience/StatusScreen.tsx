import type { ReactNode } from 'react';
import type { ResolvedConfig, Theme } from '@letter/types';
import { ThemeScope } from '../../lib/theme';
import { makeCopy } from '../../lib/copy';
import type { ExperienceFailure } from './publicApi';
import styles from './status.module.css';

/**
 * The waiting state. Deliberately wordless — a letter opening should feel like
 * a pause, not like software working — so there is no invented copy here.
 */
export function LoadingScreen({ theme }: { theme?: Theme | null }) {
  return (
    <ThemeScope theme={theme ?? null} className={styles.screen} fullHeight>
      <div className={styles.centre}>
        <span className={styles.breath} aria-hidden />
      </div>
    </ThemeScope>
  );
}

interface FailureScreenProps {
  kind: ExperienceFailure;
  theme?: Theme | null;
  config?: Pick<ResolvedConfig, 'copy'> | null;
  onRetry?: () => void;
  children?: ReactNode;
}

/** 404, 403 and everything else, said plainly and without a status code. */
export function FailureScreen({ kind, theme, config, onRetry, children }: FailureScreenProps) {
  const t = makeCopy(config ?? null);
  const message =
    kind === 'notFound'
      ? t('error.notFound')
      : kind === 'unavailable'
        ? t('error.unavailable')
        : t('error.generic');

  return (
    <ThemeScope theme={theme ?? null} className={styles.screen} fullHeight>
      <div className={styles.centre}>
        <p className={styles.message}>{message}</p>
        {onRetry && kind === 'generic' && (
          <button type="button" className={styles.retry} onClick={onRetry}>
            {t('error.retry')}
          </button>
        )}
        {children}
      </div>
    </ThemeScope>
  );
}
