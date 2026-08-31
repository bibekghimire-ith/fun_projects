import type { BlockContentMap, BlockType, ContentBlock } from '@letter/types';
import { cx } from '../../ui';
import { useCountdown } from './hooks';
import { useExperience } from './context';
import { RichText } from './RichText';
import { SafeImage } from './SafeImage';
import { Gallery } from './Gallery';
import { Timeline } from './Timeline';
import { OpenWhenGrid } from './OpenWhenGrid';
import { FutureLetterCard } from './FutureLetterCard';
import { FinalSurprise } from './FinalSurprise';
import { AudioPlayer } from './AudioPlayer';
import { VoiceLetter } from './VoiceLetter';
import styles from './blocks.module.css';

/**
 * A block's `content` is stored as free-form JSON, so it is read back through
 * the shape BlockContentMap declares for that block type. Everything inside is
 * still treated as possibly-missing — an old block should never crash a letter.
 */
function contentOf<K extends BlockType>(block: ContentBlock): BlockContentMap[K] {
  return block.content as unknown as BlockContentMap[K];
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function ids(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
}

export interface BlockRendererProps {
  block: ContentBlock;
}

export function BlockRenderer({ block }: BlockRendererProps) {
  const { config } = useExperience();
  const features = config.features;

  switch (block.type) {
    case 'TEXT': {
      const content = contentOf<'TEXT'>(block);
      return (
        <div className={styles.block}>
          <RichText doc={content.doc} text={content.text} align={content.align} />
        </div>
      );
    }

    case 'HEADING': {
      const content = contentOf<'HEADING'>(block);
      const label = text(content.text);
      if (!label) return null;
      const Tag = content.level === 3 ? 'h4' : content.level === 2 ? 'h3' : 'h2';
      return (
        <div
          className={cx(
            styles.block,
            content.align === 'center' && styles.center,
            content.align === 'right' && styles.right,
          )}
        >
          {content.eyebrow && <p className={styles.eyebrow}>{content.eyebrow}</p>}
          <Tag className={cx(styles.heading, content.level === 1 && styles.headingLarge)}>
            {label}
          </Tag>
        </div>
      );
    }

    case 'QUOTE': {
      const content = contentOf<'QUOTE'>(block);
      const quote = text(content.text);
      if (!quote) return null;
      return (
        <figure className={cx(styles.block, styles.quoteFigure)}>
          <blockquote className={styles.quote}>{quote}</blockquote>
          {content.attribution && (
            <figcaption className={styles.attribution}>{content.attribution}</figcaption>
          )}
        </figure>
      );
    }

    case 'IMAGE': {
      const content = contentOf<'IMAGE'>(block);
      if (!block.media) return null;
      const caption = text(content.caption);
      // An explicit alt wins; a caption is the next best description; a purely
      // decorative photo gets an empty alt rather than a filename.
      const alt = text(content.alt) || caption || '';
      return (
        <figure className={cx(styles.block, styles.figure)}>
          <SafeImage
            className={cx(
              styles.image,
              content.fit === 'contain' && styles.contain,
              content.rounded !== false && styles.rounded,
            )}
            src={block.media.url}
            alt={alt}
            width={block.media.width}
            height={block.media.height}
          />
          {caption && <figcaption className={styles.caption}>{caption}</figcaption>}
        </figure>
      );
    }

    case 'GALLERY': {
      if (!features.gallery) return null;
      const content = contentOf<'GALLERY'>(block);
      const mediaIds = ids(content.mediaIds);
      if (mediaIds.length === 0) return null;
      return (
        <div className={styles.block}>
          <Gallery mediaIds={mediaIds} caption={content.caption} layout={content.layout} />
        </div>
      );
    }

    case 'VIDEO': {
      const content = contentOf<'VIDEO'>(block);
      if (!block.media) return null;
      const caption = text(content.caption);
      return (
        <figure className={cx(styles.block, styles.figure)}>
          <video
            className={cx(styles.video, styles.rounded)}
            src={block.media.url}
            poster={block.media.thumbnailUrl ?? undefined}
            controls
            playsInline
            preload="metadata"
            loop={content.loop === true}
            // A clip may only start on its own if it is silent.
            autoPlay={content.autoplay === true}
            muted={content.autoplay === true}
          />
          {caption && <figcaption className={styles.caption}>{caption}</figcaption>}
        </figure>
      );
    }

    case 'AUDIO': {
      const content = contentOf<'AUDIO'>(block);
      if (!block.media) return null;
      if (content.isVoiceLetter && features.voiceLetter) {
        return (
          <div className={styles.block}>
            <VoiceLetter
              src={block.media.url}
              title={content.title}
              description={content.description}
              duration={block.media.duration}
            />
          </div>
        );
      }
      return (
        <div className={styles.block}>
          <AudioPlayer
            src={block.media.url}
            title={content.title}
            description={content.description}
            duration={block.media.duration}
          />
        </div>
      );
    }

    case 'TIMELINE': {
      if (!features.timeline) return null;
      const content = contentOf<'TIMELINE'>(block);
      return (
        <div className={cx(styles.block, styles.wide)}>
          <Timeline
            memoryIds={ids(content.memoryIds)}
            layout={content.layout}
            title={content.title}
          />
        </div>
      );
    }

    case 'COUNTDOWN': {
      const content = contentOf<'COUNTDOWN'>(block);
      return <CountdownBlock content={content} />;
    }

    case 'OPEN_WHEN': {
      if (!features.openWhen) return null;
      const content = contentOf<'OPEN_WHEN'>(block);
      return (
        <div className={cx(styles.block, styles.wide)}>
          <OpenWhenGrid messageIds={ids(content.messageIds)} title={content.title} />
        </div>
      );
    }

    case 'FUTURE_LETTER': {
      if (!features.futureLetter) return null;
      const content = contentOf<'FUTURE_LETTER'>(block);
      return (
        <div className={styles.block}>
          <FutureLetterCard showCountdown={content.showCountdown !== false} />
        </div>
      );
    }

    case 'FINAL_QUESTION': {
      if (!features.finalSurprise) return null;
      const content = contentOf<'FINAL_QUESTION'>(block);
      return (
        <div className={styles.block}>
          <FinalSurprise showIntro={content.showIntro !== false} />
        </div>
      );
    }

    case 'BUTTON': {
      const content = contentOf<'BUTTON'>(block);
      const label = text(content.text);
      const url = text(content.url);
      if (!label || !url || !isSafeUrl(url)) return null;
      return (
        <div className={cx(styles.block, styles.center)}>
          <a
            className={cx(
              styles.button,
              content.style === 'secondary' && styles.secondary,
              content.style === 'ghost' && styles.ghost,
            )}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {label}
          </a>
        </div>
      );
    }

    case 'DIVIDER': {
      const content = contentOf<'DIVIDER'>(block);
      if (content.style === 'space') return <div className={styles.gap} aria-hidden />;
      if (content.style === 'dots' || content.style === 'hearts') {
        return (
          <div className={cx(styles.block, styles.center)} aria-hidden>
            <span className={styles.dots}>
              <span />
              <span />
              <span />
            </span>
          </div>
        );
      }
      return <hr className={styles.divider} />;
    }

    default:
      // A block type this build does not know about is simply not shown.
      return null;
  }
}

function CountdownBlock({ content }: { content: BlockContentMap['COUNTDOWN'] }) {
  const { config } = useExperience();
  const target = text(content.targetDate);
  const countdown = useCountdown(target || null);

  if (!target || !countdown) return null;

  const label = text(content.label);
  const completed = text(content.completedText);

  return (
    <div className={cx(styles.block, styles.center)}>
      {countdown.done ? (
        completed && <p className={styles.countdownDone}>{completed}</p>
      ) : (
        <>
          {label && <p className={styles.countdownLabel}>{label}</p>}
          <ul className={styles.countdownUnits} aria-hidden>
            <li>{formatUnit(countdown.days, 'day', config.locale)}</li>
            <li>{formatUnit(countdown.hours, 'hour', config.locale)}</li>
            <li>{formatUnit(countdown.minutes, 'minute', config.locale)}</li>
            <li>{formatUnit(countdown.seconds, 'second', config.locale)}</li>
          </ul>
        </>
      )}
    </div>
  );
}

function formatUnit(
  value: number,
  unit: 'day' | 'hour' | 'minute' | 'second',
  locale: string,
): string {
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

function isSafeUrl(url: string): boolean {
  return /^(https?:|mailto:|tel:)/i.test(url.trim()) || url.startsWith('/');
}

export default BlockRenderer;
