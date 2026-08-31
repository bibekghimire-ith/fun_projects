import { Fragment, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { MapPin } from 'lucide-react';
import type { Memory } from '@letter/types';
import { cx } from '../../ui';
import { formatDate } from '../../lib/format';
import { useExperience } from './context';
import { useHasBeenSeen } from './hooks';
import { revealHidden, revealShown, revealTransition } from './motion';
import { SafeImage } from './SafeImage';
import styles from './timeline.module.css';

export interface TimelineProps {
  /** Empty or missing = every memory on the experience. */
  memoryIds?: string[];
  layout?: 'vertical' | 'alternating';
  /** The creator's own heading for this timeline, if they wrote one. */
  title?: string;
}

export function Timeline({ memoryIds, layout = 'vertical', title }: TimelineProps) {
  const { experience, config, t } = useExperience();

  const memories = useMemo(() => {
    const all = experience.memories;
    if (!memoryIds || memoryIds.length === 0) return all;
    const wanted = new Set(memoryIds);
    return all.filter((memory) => wanted.has(memory.id));
  }, [experience.memories, memoryIds]);

  if (memories.length === 0) return null;

  let lastYear = '';

  return (
    <div className={styles.timeline}>
      <header className={styles.header}>
        <h2 className={styles.title}>{title || t('timeline.title')}</h2>
        <p className={styles.subtitle}>{t('timeline.subtitle')}</p>
      </header>

      <ol className={cx(styles.list, layout === 'alternating' && styles.alternating)}>
        {memories.map((memory, index) => {
          const year = memory.date ? String(new Date(memory.date).getFullYear()) : '';
          const showYear = year !== '' && year !== lastYear;
          if (showYear) lastYear = year;
          return (
            <Fragment key={memory.id}>
              {showYear && (
                <li className={styles.yearRow}>
                  <span className={styles.year}>{year}</span>
                </li>
              )}
              <TimelineItem
                memory={memory}
                index={index}
                dateLabel={formatDate(memory.date, config.dateFormat, config.locale)}
              />
            </Fragment>
          );
        })}
      </ol>
    </div>
  );
}

function TimelineItem({
  memory,
  index,
  dateLabel,
}: {
  memory: Memory;
  index: number;
  dateLabel: string;
}) {
  const { motionLevel } = useExperience();
  const ref = useRef<HTMLLIElement>(null);
  const seen = useHasBeenSeen(ref, motionLevel !== 'none');

  return (
    <motion.li
      ref={ref}
      className={cx(styles.item, index % 2 === 1 && styles.right)}
      initial={revealHidden(motionLevel)}
      animate={seen ? revealShown(motionLevel) : revealHidden(motionLevel)}
      transition={revealTransition(motionLevel)}
    >
      <span className={styles.dot} aria-hidden />
      <div className={styles.card}>
        {memory.media && (
          <SafeImage
            className={styles.photo}
            src={memory.media.thumbnailUrl ?? memory.media.url}
            alt={memory.title}
          />
        )}
        <div className={styles.body}>
          {dateLabel && <p className={styles.date}>{dateLabel}</p>}
          <h3 className={styles.itemTitle}>{memory.title}</h3>
          {memory.description && <p className={styles.description}>{memory.description}</p>}
          {memory.location && (
            <p className={styles.location}>
              <MapPin size={14} aria-hidden />
              <span>{memory.location}</span>
            </p>
          )}
        </div>
      </div>
    </motion.li>
  );
}

export default Timeline;
