import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api, ApiRequestError, setPinToken } from '../../api';
import { makeCopy } from '../../lib/copy';
import { ThemeScope } from '../../lib/theme';
import {
  classifyFailure,
  publicExperienceKey,
  retryAfterSeconds,
  usePublicExperience,
} from '../../components/experience/publicApi';
import { FailureScreen, LoadingScreen } from '../../components/experience/StatusScreen';
import styles from './pin.module.css';

const LENGTH = 4;

/**
 * A four-digit gate. One real input sits invisibly over four drawn cells, so a
 * keyboard, a phone keypad, a password manager's paste and a screen reader all
 * meet the same ordinary text field.
 */
export default function PinPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const query = usePublicExperience(token);

  const [digits, setDigits] = useState('');
  const [wrong, setWrong] = useState(false);
  const [lockedFor, setLockedFor] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const submittingRef = useRef(false);

  // While locked out, count the wait down rather than leaving them guessing.
  useEffect(() => {
    if (lockedFor === null) return;
    if (lockedFor <= 0) {
      setLocked(false);
      setLockedFor(null);
      return;
    }
    const timer = window.setTimeout(() => setLockedFor((value) => (value ?? 1) - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [lockedFor]);

  const submit = useCallback(
    async (pin: string) => {
      if (!token || submittingRef.current || locked) return;
      if (pin.length !== LENGTH) return;
      submittingRef.current = true;
      setBusy(true);
      setWrong(false);

      try {
        const result = await api.post<{ verified: boolean; pinToken: string }>(
          `/api/public/e/${token}/verify`,
          { pin },
        );
        setPinToken(result.pinToken);
        // The gate answer is stale the moment it is unlocked.
        await queryClient.invalidateQueries({ queryKey: publicExperienceKey(token) });
        navigate(`/e/${token}/open`, { replace: true });
      } catch (error) {
        const status = error instanceof ApiRequestError ? error.status : 0;
        if (status === 429) {
          setLocked(true);
          setLockedFor(retryAfterSeconds(error));
        } else {
          // 401 and 404 look identical from here: this screen never confirms
          // whether a letter exists behind the link.
          setWrong(true);
        }
        setDigits('');
        inputRef.current?.focus();
      } finally {
        submittingRef.current = false;
        setBusy(false);
      }
    },
    [token, locked, queryClient, navigate],
  );

  const onChange = useCallback(
    (value: string) => {
      const cleaned = value.replace(/\D/g, '').slice(0, LENGTH);
      setDigits(cleaned);
      if (wrong) setWrong(false);
      if (cleaned.length === LENGTH) void submit(cleaned);
    },
    [submit, wrong],
  );

  const onSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void submit(digits);
    },
    [submit, digits],
  );

  if (!token) return <FailureScreen kind="notFound" />;
  if (query.isPending) return <LoadingScreen />;

  if (query.isError || !query.data) {
    return (
      <FailureScreen kind={classifyFailure(query.error)} onRetry={() => void query.refetch()} />
    );
  }

  // Already verified in this tab — there is nothing to ask for.
  if (!query.data.pinRequired) return <Navigate to={`/e/${token}/open`} replace />;

  const gate = query.data;
  const t = makeCopy(gate.config, { recipient: gate.recipientName, title: gate.title });
  const cells = Array.from({ length: LENGTH }, (_, index) => digits[index] ?? '');

  return (
    <ThemeScope theme={gate.theme} className={styles.page} fullHeight>
      <main className={styles.stage}>
        <form className={styles.form} onSubmit={onSubmit}>
          <h1 className={styles.title} id="pin-title">
            {t('pin.title')}
          </h1>
          <p className={styles.subtitle} id="pin-subtitle">
            {t('pin.subtitle')}
          </p>

          <div className={styles.field}>
            <input
              ref={inputRef}
              className={styles.input}
              id="pin-input"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={LENGTH}
              value={digits}
              onChange={(event) => onChange(event.target.value)}
              aria-labelledby="pin-title"
              aria-describedby={`pin-subtitle${wrong || locked ? ' pin-status' : ''}`}
              aria-invalid={wrong || undefined}
              disabled={busy || locked}
              autoFocus
            />
            <span className={styles.cells} aria-hidden>
              {cells.map((digit, index) => (
                <span
                  key={index}
                  className={[
                    styles.cell,
                    digit && styles.filled,
                    index === digits.length && !locked && styles.active,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {digit ? '•' : ''}
                </span>
              ))}
            </span>
          </div>

          <p className={styles.status} id="pin-status" role="alert">
            {locked
              ? `${t('pin.locked')}${lockedFor !== null ? ` (${formatWait(lockedFor)})` : ''}`
              : wrong
                ? t('pin.error')
                : ''}
          </p>

          <button
            type="submit"
            className={styles.unlock}
            disabled={busy || locked || digits.length !== LENGTH}
          >
            {t('pin.button')}
          </button>
        </form>
      </main>
    </ThemeScope>
  );
}

/** m:ss — digits and a colon, so there is no invented word to translate. */
function formatWait(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}
