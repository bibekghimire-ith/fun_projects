import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Monitor, Smartphone } from 'lucide-react';
import {
  resolveCopy,
  resolveFeatures,
  type ContentBlock,
  type ExperienceSection,
  type Media,
  type PublicExperience,
  type PublicOpenWhenMessage,
  type ResolvedConfig,
  type UnlockType,
} from '@letter/types';
import { ThemeScope } from '../../lib/theme';
import { cx } from '../../ui';
import {
  useConfig,
  useExperience,
  useMedia,
  useMediaToken,
  type ExperienceDetail,
} from '../../hooks/useExperience';
import ExperienceRenderer from '../../components/experience/ExperienceRenderer';
import {
  FailureScreen,
  LoadingScreen,
} from '../../components/experience/StatusScreen';
import styles from './preview.module.css';

/* ── The server's unlock rules, mirrored ──────────────────────────────────────
   A draft is never published, so nothing can ask the public API what is open
   yet. These are the same two rules as apps/api/src/utils/unlock.ts — if that
   file changes, this has to change with it.                                  */

function isOpenWhenUnlocked(message: {
  unlockType: UnlockType;
  unlockDate: string | null;
  openedAt: string | null;
}): boolean {
  if (message.unlockType === 'IMMEDIATE') return true;
  if (message.unlockType === 'DATE_LOCKED') {
    return message.unlockDate ? Date.now() >= new Date(message.unlockDate).getTime() : false;
  }
  if (message.unlockType === 'MANUAL') return message.openedAt !== null;
  return false;
}

function isFutureLetterUnlocked(unlockDate: string): boolean {
  return Date.now() >= new Date(unlockDate).getTime();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** The creator's config row, with every default merged in — as the API does. */
function toResolvedConfig(row: ConfigRow | undefined): ResolvedConfig {
  return {
    navigationMode: row?.navigationMode ?? 'SCROLL',
    showProgressBar: row?.showProgressBar ?? true,
    enableConfetti: row?.enableConfetti ?? true,
    musicAutoplay: row?.musicAutoplay ?? true,
    musicVolume: row?.musicVolume ?? 60,
    locale: row?.locale ?? 'en',
    dateFormat: row?.dateFormat ?? 'MMMM d, yyyy',
    copy: resolveCopy(asRecord(row?.copy)),
    features: resolveFeatures(asRecord(row?.features)),
  };
}

interface ConfigRow {
  navigationMode: ResolvedConfig['navigationMode'];
  showProgressBar: boolean;
  enableConfetti: boolean;
  musicAutoplay: boolean;
  musicVolume: number;
  locale: string;
  dateFormat: string;
  copy: unknown;
  features: unknown;
}

/**
 * Reshapes the creator's own draft into exactly what the public endpoint would
 * send, so the preview exercises the real renderer rather than a stand-in.
 */
function toPublicExperience(
  detail: ExperienceDetail,
  config: ResolvedConfig,
  media: Media[],
): PublicExperience {
  const byId = new Map(media.map((item) => [item.id, item]));
  const lookup = (id: string | null | undefined): Media | null =>
    (id ? byId.get(id) : null) ?? null;

  const features = config.features;

  const sections: ExperienceSection[] = detail.sections
    .filter((section) => section.enabled !== false)
    .map((section) => ({
      ...section,
      blocks: section.blocks
        .filter((block) => block.enabled !== false)
        // Draft rows carry a media id but no streaming URL, so the file is
        // looked up in the experience's own media list.
        .map<ContentBlock>((block) => ({ ...block, media: lookup(block.mediaId) })),
    }));

  const openWhenMessages: PublicOpenWhenMessage[] = features.openWhen
    ? detail.openWhenMessages.map((message) => {
        const unlocked = isOpenWhenUnlocked(message);
        return {
          id: message.id,
          label: message.label,
          emoji: message.emoji,
          unlockType: message.unlockType,
          unlockDate: message.unlockDate,
          isOneTime: message.isOneTime,
          isUnlocked: unlocked,
          ...(unlocked ? { content: message.content, media: lookup(message.mediaId) } : {}),
        };
      })
    : [];

  const letter = detail.futureLetter;
  const letterUnlocked = letter ? isFutureLetterUnlocked(letter.unlockDate) : false;

  return {
    id: detail.id,
    title: detail.title,
    recipientName: detail.recipientName,
    eventType: detail.eventType,
    eventDate: detail.eventDate,
    openingMessage: detail.openingMessage,
    closingMessage: detail.closingMessage,
    theme: detail.theme,
    config,
    // Carried along so a GALLERY block's bare mediaIds resolve to real
    // thumbnailUrl/width/height via buildMediaIndex, same as the public API.
    media,
    coverMedia: lookup(detail.coverMediaId),
    musicMedia: lookup(detail.musicMediaId),
    sections,
    memories: features.timeline
      ? detail.memories.map((memory) => ({ ...memory, media: lookup(memory.mediaId) }))
      : [],
    openWhenMessages,
    futureLetter:
      features.futureLetter && letter
        ? {
            id: letter.id,
            title: letter.title,
            unlockDate: letter.unlockDate,
            isUnlocked: letterUnlocked,
            ...(letterUnlocked
              ? { content: letter.content, media: lookup(letter.mediaId) }
              : {}),
          }
        : null,
    finalSurprise:
      features.finalSurprise && detail.finalSurprise
        ? { ...detail.finalSurprise, media: lookup(detail.finalSurprise.mediaId) }
        : null,
  };
}

export default function PreviewPage() {
  const { id } = useParams<{ id: string }>();
  const experienceQuery = useExperience(id);
  const configQuery = useConfig(id ?? '');
  const mediaQuery = useMedia(id ?? '');
  const mediaTokenQuery = useMediaToken(id);
  const [frame, setFrame] = useState<'phone' | 'full'>('phone');

  const detail = experienceQuery.data;
  const resolved = useMemo(
    () => toResolvedConfig(configQuery.data as ConfigRow | undefined),
    [configQuery.data],
  );

  const experience = useMemo(
    () => (detail ? toPublicExperience(detail, resolved, mediaQuery.data ?? []) : null),
    [detail, resolved, mediaQuery.data],
  );

  // Wait for all four: rendering with default copy first and the creator's
  // own words a moment later would look like a bug — and SafeImage latches
  // its "failed" state, so an image that 403s before the media token has
  // arrived would never retry once it does.
  if (
    experienceQuery.isPending ||
    configQuery.isPending ||
    mediaQuery.isPending ||
    mediaTokenQuery.isPending
  ) {
    return <LoadingScreen />;
  }

  if (experienceQuery.isError || !experience) {
    return (
      <FailureScreen kind="generic" onRetry={() => void experienceQuery.refetch()} />
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.bar}>
        <Link className={styles.back} to={`/experiences/${id}/edit`}>
          <ArrowLeft size={16} aria-hidden />
          <span>Back to the builder</span>
        </Link>

        <p className={styles.note}>
          Preview — this is how it will look. Nothing here is recorded.
        </p>

        <div className={styles.frames} role="group" aria-label="Preview size">
          <button
            type="button"
            className={cx(styles.frameButton, frame === 'phone' && styles.frameActive)}
            onClick={() => setFrame('phone')}
            aria-pressed={frame === 'phone'}
          >
            <Smartphone size={15} aria-hidden />
            <span>Phone</span>
          </button>
          <button
            type="button"
            className={cx(styles.frameButton, frame === 'full' && styles.frameActive)}
            onClick={() => setFrame('full')}
            aria-pressed={frame === 'full'}
          >
            <Monitor size={15} aria-hidden />
            <span>Full width</span>
          </button>
        </div>
      </header>

      <div className={cx(styles.stage, frame === 'phone' && styles.stagePhone)}>
        <div className={cx(styles.device, frame === 'phone' && styles.devicePhone)}>
          <ThemeScope theme={experience.theme} className={styles.canvas}>
            <ExperienceRenderer
              experience={experience}
              token={null}
              mediaToken={mediaTokenQuery.data?.token ?? null}
              preview
            />
          </ThemeScope>
        </div>
      </div>
    </div>
  );
}
