import { useCallback, useRef, useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { api } from '../../api';
import { cx } from '../../ui';
import { useExperience } from './context';
import { revealHidden, revealShown, revealTransition } from './motion';
import { PlainText } from './RichText';
import { SafeImage } from './SafeImage';
import styles from './finalSurprise.module.css';

export interface FinalSurpriseProps {
  showIntro?: boolean;
}

type Stage = 'intro' | 'question' | 'sending' | 'done' | 'error';

/**
 * The last thing in the letter: a held breath, then the question, then whatever
 * they want to say back.
 */
export function FinalSurprise({ showIntro = true }: FinalSurpriseProps) {
  const { experience, t, token, preview, motionLevel } = useExperience();
  const surprise = experience.finalSurprise;

  const [stage, setStage] = useState<Stage>(showIntro ? 'intro' : 'question');
  const [typed, setTyped] = useState('');
  // Guards the case where two taps land before the first request resolves.
  const sending = useRef(false);

  const submit = useCallback(
    async (answer: string) => {
      const trimmed = answer.trim().slice(0, 1000);
      if (!trimmed || sending.current || stage === 'done') return;
      sending.current = true;

      if (!token || preview) {
        // Nothing is recorded from a preview.
        setStage('done');
        sending.current = false;
        return;
      }

      setStage('sending');
      try {
        await api.post(`/api/public/e/${token}/respond`, { answer: trimmed });
        setStage('done');
      } catch {
        setStage('error');
      } finally {
        sending.current = false;
      }
    },
    [stage, token, preview],
  );

  const onTextSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void submit(typed);
    },
    [submit, typed],
  );

  if (!surprise) return null;

  const options = Array.isArray(surprise.options) ? surprise.options.filter(Boolean) : [];
  const busy = stage === 'sending';

  return (
    <section className={styles.surprise}>
      {stage === 'intro' && (
        <div className={styles.intro}>
          <p className={styles.introText}>{t('surprise.intro')}</p>
          <button type="button" className={styles.reveal} onClick={() => setStage('question')}>
            {surprise.buttonText || t('surprise.reveal')}
          </button>
        </div>
      )}

      {stage !== 'intro' && (
        <motion.div
          className={styles.panel}
          initial={revealHidden(motionLevel)}
          animate={revealShown(motionLevel)}
          transition={revealTransition(motionLevel)}
        >
          {surprise.media && (
            <SafeImage className={styles.photo} src={surprise.media.url} alt={surprise.question} />
          )}

          {stage === 'done' ? (
            <div className={styles.thanks}>
              <PlainText
                text={surprise.successMessage || t('surprise.thanks')}
                className={styles.thanksText}
              />
              {surprise.ctaText && surprise.ctaUrl && (
                <a
                  className={styles.cta}
                  href={surprise.ctaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {surprise.ctaText}
                </a>
              )}
            </div>
          ) : (
            <>
              <h2 className={styles.question}>{surprise.question}</h2>

              {stage === 'error' && (
                <p className={styles.error} role="alert">
                  {t('error.generic')}
                </p>
              )}

              {surprise.responseType === 'YES_NO' && (
                <div className={styles.answers}>
                  <button
                    type="button"
                    className={cx(styles.answer, styles.primary)}
                    onClick={() => void submit(t('surprise.yes'))}
                    disabled={busy}
                  >
                    {t('surprise.yes')}
                  </button>
                  <button
                    type="button"
                    className={styles.answer}
                    onClick={() => void submit(t('surprise.no'))}
                    disabled={busy}
                  >
                    {t('surprise.no')}
                  </button>
                </div>
              )}

              {surprise.responseType === 'SINGLE_BUTTON' && (
                <div className={styles.answers}>
                  <button
                    type="button"
                    className={cx(styles.answer, styles.primary)}
                    onClick={() => void submit(surprise.buttonText || t('surprise.submit'))}
                    disabled={busy}
                  >
                    {surprise.buttonText || t('surprise.submit')}
                  </button>
                </div>
              )}

              {surprise.responseType === 'MULTIPLE_CHOICE' && options.length > 0 && (
                <div className={cx(styles.answers, styles.stacked)}>
                  {options.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={styles.answer}
                      onClick={() => void submit(option)}
                      disabled={busy}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}

              {surprise.responseType === 'TEXT_INPUT' && (
                <form className={styles.form} onSubmit={onTextSubmit}>
                  <label className={styles.srOnly} htmlFor="final-answer">
                    {surprise.question}
                  </label>
                  <textarea
                    id="final-answer"
                    className={styles.textarea}
                    value={typed}
                    onChange={(event) => setTyped(event.target.value)}
                    placeholder={t('surprise.placeholder')}
                    maxLength={1000}
                    rows={4}
                  />
                  <button
                    type="submit"
                    className={cx(styles.answer, styles.primary)}
                    disabled={busy || typed.trim().length === 0}
                  >
                    {stage === 'error' ? t('error.retry') : t('surprise.submit')}
                  </button>
                </form>
              )}
            </>
          )}
        </motion.div>
      )}
    </section>
  );
}

export default FinalSurprise;
