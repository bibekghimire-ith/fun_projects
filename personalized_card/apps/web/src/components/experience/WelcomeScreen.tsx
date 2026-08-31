import { motion } from 'framer-motion';
import { useExperience } from './context';
import { revealHidden, revealShown, revealTransition } from './motion';
import { PlainText } from './RichText';
import { SafeImage } from './SafeImage';
import styles from './welcome.module.css';

export interface WelcomeScreenProps {
  /** Moves on to the first chapter. */
  onBegin: () => void;
}

export function WelcomeScreen({ onBegin }: WelcomeScreenProps) {
  const { experience, t, motionLevel } = useExperience();

  return (
    <div className={styles.welcome}>
      {experience.coverMedia && (
        <motion.div
          className={styles.coverWrap}
          initial={revealHidden(motionLevel)}
          animate={revealShown(motionLevel)}
          transition={revealTransition(motionLevel)}
        >
          <SafeImage
            className={styles.cover}
            src={experience.coverMedia.url}
            alt={experience.title}
            eager
          />
        </motion.div>
      )}

      <motion.div
        className={styles.body}
        initial={revealHidden(motionLevel)}
        animate={revealShown(motionLevel)}
        transition={revealTransition(motionLevel, motionLevel === 'full' ? 0.15 : 0)}
      >
        <h1 className={styles.greeting}>{t('welcome.greeting')}</h1>
        <p className={styles.subtitle}>{t('welcome.subtitle')}</p>
        <PlainText text={experience.openingMessage} className={styles.opening} />

        <button type="button" className={styles.begin} onClick={onBegin}>
          {t('welcome.button')}
        </button>
      </motion.div>
    </div>
  );
}

export default WelcomeScreen;
