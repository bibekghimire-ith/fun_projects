import { useMemo, type CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { useExperience } from './context';
import { revealHidden, revealShown, revealTransition } from './motion';
import { PlainText } from './RichText';
import styles from './closing.module.css';

export interface ClosingScreenProps {
  /** Start the letter over. Only offered when the creator allows it. */
  onReplay?: () => void;
}

/** Custom properties carrying each piece's randomised path. */
type PieceStyle = CSSProperties & Record<`--${string}`, string>;

export function ClosingScreen({ onReplay }: ClosingScreenProps) {
  const { experience, config, t, motionLevel } = useExperience();

  // Confetti is a flourish, not information: skipped entirely whenever the
  // viewer or the theme has asked for stillness.
  const showConfetti = config.enableConfetti && motionLevel === 'full';

  const pieces = useMemo<PieceStyle[]>(() => {
    if (!showConfetti) return [];
    return Array.from({ length: 24 }, (_, index) => ({
      '--left': `${(index * 4.17 + ((index * 37) % 11)) % 100}%`,
      '--delay': `${((index * 13) % 30) / 10}s`,
      '--fall': `${4 + ((index * 7) % 25) / 10}s`,
      '--drift': `${((index % 5) - 2) * 18}px`,
      '--size': `${5 + (index % 4)}px`,
    }));
  }, [showConfetti]);

  return (
    <div className={styles.closing}>
      {showConfetti && (
        <div className={styles.confetti} aria-hidden>
          {pieces.map((style, index) => (
            <span key={index} className={styles.piece} style={style} />
          ))}
        </div>
      )}

      <motion.div
        className={styles.body}
        initial={revealHidden(motionLevel)}
        animate={revealShown(motionLevel)}
        transition={revealTransition(motionLevel)}
      >
        <h2 className={styles.title}>{t('closing.title')}</h2>
        <PlainText text={experience.closingMessage} className={styles.message} />

        {config.features.replay && onReplay && (
          <button type="button" className={styles.replay} onClick={onReplay}>
            {t('closing.replay')}
          </button>
        )}
      </motion.div>
    </div>
  );
}

export default ClosingScreen;
