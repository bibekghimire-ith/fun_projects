import { useCallback, useMemo, useState } from 'react';
import { Lock, Mail, X } from 'lucide-react';
import type { Media, PublicOpenWhenMessage } from '@letter/types';
import { cx } from '../../ui';
import { api, ApiRequestError } from '../../api';
import { formatDate } from '../../lib/format';
import { useExperience } from './context';
import { useDialog } from './hooks';
import { PlainText } from './RichText';
import { SafeImage } from './SafeImage';
import { ThemePortal } from './ThemePortal';
import styles from './openWhen.module.css';

export interface OpenWhenGridProps {
  /** Empty or missing = every message on the experience. */
  messageIds?: string[];
  /** The creator's own heading, if they wrote one. */
  title?: string;
}

/** What the unlock endpoint hands back — the stored record, in full. */
interface OpenWhenDetail {
  id: string;
  label: string;
  content: string;
  media: Media | null;
  openedAt?: string | null;
}

type DialogState =
  | { stage: 'warning'; message: PublicOpenWhenMessage }
  | { stage: 'loading'; message: PublicOpenWhenMessage }
  | { stage: 'error'; message: PublicOpenWhenMessage }
  | { stage: 'locked'; message: PublicOpenWhenMessage }
  | { stage: 'open'; message: PublicOpenWhenMessage; detail: OpenWhenDetail };

export function OpenWhenGrid({ messageIds, title }: OpenWhenGridProps) {
  const { experience, config, t, token, preview } = useExperience();
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [spent, setSpent] = useState<string[]>([]);

  const messages = useMemo(() => {
    const all = experience.openWhenMessages;
    if (!messageIds || messageIds.length === 0) return all;
    const wanted = new Set(messageIds);
    return all.filter((message) => wanted.has(message.id));
  }, [experience.openWhenMessages, messageIds]);

  const reveal = useCallback(
    async (message: PublicOpenWhenMessage) => {
      // In the creator's preview there is nothing to call — the draft content
      // is already in hand.
      if (!token) {
        setDialog({
          stage: 'open',
          message,
          detail: {
            id: message.id,
            label: message.label,
            content: message.content ?? '',
            media: message.media ?? null,
          },
        });
        return;
      }

      setDialog({ stage: 'loading', message });
      try {
        const detail = await api.get<OpenWhenDetail>(
          `/api/public/e/${token}/open-when/${message.id}`,
        );
        setDialog({ stage: 'open', message, detail });
        if (message.isOneTime) setSpent((current) => [...current, message.id]);
      } catch (error) {
        const status = error instanceof ApiRequestError ? error.status : 0;
        if (status === 423) {
          setDialog({ stage: 'locked', message });
        } else if (message.content) {
          // The payload already carried this one; show it rather than fail.
          setDialog({
            stage: 'open',
            message,
            detail: {
              id: message.id,
              label: message.label,
              content: message.content,
              media: message.media ?? null,
            },
          });
        } else {
          setDialog({ stage: 'error', message });
        }
      }
    },
    [token],
  );

  const onCardClick = useCallback(
    (message: PublicOpenWhenMessage) => {
      if (!message.isUnlocked) return;
      if (message.isOneTime && !spent.includes(message.id)) {
        setDialog({ stage: 'warning', message });
        return;
      }
      void reveal(message);
    },
    [reveal, spent],
  );

  const close = useCallback(() => setDialog(null), []);

  if (messages.length === 0) return null;

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <h2 className={styles.title}>{title || t('openWhen.title')}</h2>
        <p className={styles.subtitle}>{t('openWhen.subtitle')}</p>
      </header>

      <ul className={styles.grid}>
        {messages.map((message) => {
          const isSpent = spent.includes(message.id);
          const locked = !message.isUnlocked;
          const unlocksOn =
            message.unlockType === 'DATE_LOCKED' && message.unlockDate
              ? formatDate(message.unlockDate, config.dateFormat, config.locale)
              : null;

          return (
            <li key={message.id} className={styles.cell}>
              <button
                type="button"
                className={cx(styles.card, locked && styles.locked, isSpent && styles.spent)}
                onClick={() => onCardClick(message)}
                disabled={locked}
                aria-describedby={locked ? `${message.id}-state` : undefined}
              >
                <span className={styles.seal} aria-hidden>
                  {message.emoji ? (
                    <span className={styles.emoji}>{message.emoji}</span>
                  ) : locked ? (
                    <Lock size={18} />
                  ) : (
                    <Mail size={18} />
                  )}
                </span>
                <span className={styles.label}>{message.label}</span>
                {locked && (
                  <span className={styles.state} id={`${message.id}-state`}>
                    {t('openWhen.locked')}
                    {unlocksOn && <span className={styles.date}>{unlocksOn}</span>}
                  </span>
                )}
                {!locked && isSpent && <span className={styles.state}>{t('openWhen.opened')}</span>}
                {!locked && !isSpent && message.isOneTime && (
                  <span className={styles.state}>{t('openWhen.oneTime')}</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {dialog && (
        <OpenWhenDialog
          state={dialog}
          onClose={close}
          onConfirm={() => void reveal(dialog.message)}
          preview={preview}
        />
      )}
    </div>
  );
}

function OpenWhenDialog({
  state,
  onClose,
  onConfirm,
  preview,
}: {
  state: DialogState;
  onClose: () => void;
  onConfirm: () => void;
  preview: boolean;
}) {
  const { t } = useExperience();
  const ref = useDialog(true, onClose);
  const headingId = `open-when-${state.message.id}`;

  return (
    <ThemePortal>
      <div className={styles.backdrop}>
        <div
          className={styles.dialog}
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-labelledby={headingId}
          tabIndex={-1}
        >
          <div className={styles.dialogHeader}>
            <h2 className={styles.dialogTitle} id={headingId}>
              {state.message.emoji && (
                <span className={styles.emoji} aria-hidden>
                  {state.message.emoji}
                </span>
              )}
              {state.message.label}
            </h2>
            <button type="button" className={styles.close} onClick={onClose}>
              <X size={18} aria-hidden />
              <span className={styles.srOnly}>{t('openWhen.close')}</span>
            </button>
          </div>

          <div className={styles.dialogBody}>
            {state.stage === 'warning' && (
              <>
                <p className={styles.warning}>{t('openWhen.oneTime')}</p>
                <button type="button" className={styles.primary} onClick={onConfirm}>
                  {t('surprise.reveal')}
                </button>
              </>
            )}

            {state.stage === 'loading' && <span className={styles.breath} aria-hidden />}

            {state.stage === 'locked' && <p className={styles.warning}>{t('openWhen.locked')}</p>}

            {state.stage === 'error' && (
              <>
                <p className={styles.warning}>{t('error.generic')}</p>
                <button type="button" className={styles.primary} onClick={onConfirm}>
                  {t('error.retry')}
                </button>
              </>
            )}

            {state.stage === 'open' && (
              <>
                {state.detail.media && (
                  <SafeImage
                    className={styles.photo}
                    src={state.detail.media.url}
                    alt={state.message.label}
                  />
                )}
                <PlainText text={state.detail.content} />
                {preview && state.message.isOneTime && (
                  <p className={styles.warning}>{t('openWhen.oneTime')}</p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </ThemePortal>
  );
}

export default OpenWhenGrid;
