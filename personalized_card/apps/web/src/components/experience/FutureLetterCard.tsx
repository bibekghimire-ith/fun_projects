import { useCallback, useState } from 'react';
import { Lock } from 'lucide-react';
import type { Media } from '@letter/types';
import { api, ApiRequestError } from '../../api';
import { formatDate } from '../../lib/format';
import { useExperience } from './context';
import { useCountdown } from './hooks';
import { PlainText } from './RichText';
import { SafeImage } from './SafeImage';
import styles from './futureLetter.module.css';

export interface FutureLetterCardProps {
  showCountdown?: boolean;
}

interface FutureLetterDetail {
  id: string;
  title: string;
  content: string;
  media: Media | null;
}

type State =
  | { stage: 'idle' }
  | { stage: 'loading' }
  | { stage: 'locked' }
  | { stage: 'error' }
  | { stage: 'open'; detail: FutureLetterDetail };

/**
 * The server owns the clock. A browser sitting on tomorrow's date still gets a
 * 423 from the API, and that is what decides — never the countdown on screen.
 */
export function FutureLetterCard({ showCountdown = true }: FutureLetterCardProps) {
  const { experience, config, t, token } = useExperience();
  const letter = experience.futureLetter;
  const [state, setState] = useState<State>({ stage: 'idle' });

  const countdown = useCountdown(
    letter && !letter.isUnlocked ? letter.unlockDate : null,
    showCountdown,
  );

  const open = useCallback(async () => {
    if (!letter) return;

    if (!token) {
      // Preview: the draft is already in hand, so there is nothing to fetch.
      setState({
        stage: 'open',
        detail: {
          id: letter.id,
          title: letter.title,
          content: letter.content ?? '',
          media: letter.media ?? null,
        },
      });
      return;
    }

    setState({ stage: 'loading' });
    try {
      const detail = await api.get<FutureLetterDetail>(`/api/public/e/${token}/future-letter`);
      setState({ stage: 'open', detail });
    } catch (error) {
      const status = error instanceof ApiRequestError ? error.status : 0;
      setState({ stage: status === 423 ? 'locked' : 'error' });
    }
  }, [letter, token]);

  if (!letter) return null;

  const unlocksOn = formatDate(letter.unlockDate, config.dateFormat, config.locale);
  const showLocked = !letter.isUnlocked || state.stage === 'locked';
  const canTry = letter.isUnlocked || countdown?.done === true;
  const ticking = countdown !== null && !countdown.done && showCountdown && !letter.isUnlocked;

  return (
    <section className={styles.card}>
      <header className={styles.header}>
        <span className={styles.icon} aria-hidden>
          <Lock size={18} />
        </span>
        <h2 className={styles.title}>{letter.title || t('futureLetter.title')}</h2>
      </header>

      {state.stage === 'open' ? (
        <div className={styles.body}>
          {state.detail.media && (
            <SafeImage
              className={styles.photo}
              src={state.detail.media.url}
              alt={state.detail.title || ''}
            />
          )}
          <PlainText text={state.detail.content} />
        </div>
      ) : (
        <div className={styles.body}>
          {showLocked && <p className={styles.locked}>{t('futureLetter.locked')}</p>}
          {state.stage === 'error' && <p className={styles.locked}>{t('error.generic')}</p>}

          {ticking && countdown && (
            <div className={styles.countdown}>
              <p className={styles.countdownLabel}>{t('futureLetter.countdown')}</p>
              {/* Hidden from assistive tech: a value that changes every second is
                  noise. The unlock date below says the same thing, calmly. */}
              <ul className={styles.units} aria-hidden>
                <li className={styles.unit}>{unitLabel(countdown.days, 'day', config.locale)}</li>
                <li className={styles.unit}>{unitLabel(countdown.hours, 'hour', config.locale)}</li>
                <li className={styles.unit}>
                  {unitLabel(countdown.minutes, 'minute', config.locale)}
                </li>
                <li className={styles.unit}>
                  {unitLabel(countdown.seconds, 'second', config.locale)}
                </li>
              </ul>
            </div>
          )}

          {!letter.isUnlocked && unlocksOn && <p className={styles.date}>{unlocksOn}</p>}

          {canTry && (
            <button
              type="button"
              className={styles.open}
              onClick={() => void open()}
              disabled={state.stage === 'loading'}
            >
              {state.stage === 'error' ? t('error.retry') : t('futureLetter.open')}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * "3 days" in the experience's own locale. Unit names come from Intl rather
 * than from hard-coded English, and fall back to the bare number if the
 * browser cannot format them.
 */
function unitLabel(value: number, unit: 'day' | 'hour' | 'minute' | 'second', locale: string): string {
  try {
    return new Intl.NumberFormat(locale || undefined, {
      style: 'unit',
      unit,
      unitDisplay: 'short',
    }).format(value);
  } catch {
    return String(value);
  }
}

export default FutureLetterCard;
