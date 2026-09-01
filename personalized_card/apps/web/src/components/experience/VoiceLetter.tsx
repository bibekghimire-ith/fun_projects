import { useCallback, useRef } from 'react';
import { Pause, Play } from 'lucide-react';
import { formatDuration } from '../../lib/format';
import { withMediaToken } from '../../lib/mediaUrl';
import { useMusic } from '../../stores/music';
import { useExperience } from './context';
import { useAudio } from './useAudio';
import { Scrubber } from './AudioPlayer';
import styles from './voice.module.css';

export interface VoiceLetterProps {
  src: string;
  /** The creator's own heading for this recording, if they wrote one. */
  title?: string;
  description?: string;
  duration?: number | null;
}

/**
 * "Don't read this. Press play instead." — one recording, one big control, and
 * nothing else on screen competing with it.
 */
export function VoiceLetter({ src, title, description, duration }: VoiceLetterProps) {
  const { t, mediaToken } = useExperience();
  const audio = useAudio(duration);
  const duckedRef = useRef(false);

  const onPlay = useCallback(() => {
    const music = useMusic.getState();
    if (music.playing) {
      duckedRef.current = true;
      music.setPlaying(false);
    }
    audio.bind.onPlay();
  }, [audio.bind]);

  const onFinished = useCallback(() => {
    if (duckedRef.current) {
      duckedRef.current = false;
      useMusic.getState().setPlaying(true);
    }
    audio.bind.onEnded();
  }, [audio.bind]);

  const total = audio.duration || duration || 0;
  const label = audio.playing ? t('voice.pause') : t('voice.play');

  return (
    <section className={styles.voice}>
      <audio
        ref={audio.ref}
        src={withMediaToken(src, mediaToken)}
        preload="metadata"
        onPlay={onPlay}
        onPause={audio.bind.onPause}
        onEnded={onFinished}
        onTimeUpdate={audio.bind.onTimeUpdate}
        onLoadedMetadata={audio.bind.onLoadedMetadata}
      />

      <p className={styles.title}>{title || t('voice.title')}</p>
      {description && <p className={styles.description}>{description}</p>}

      <button type="button" className={styles.play} onClick={audio.toggle} aria-label={label}>
        {audio.playing ? <Pause size={34} aria-hidden /> : <Play size={34} aria-hidden />}
      </button>

      <div className={styles.track}>
        <Scrubber value={audio.currentTime} max={total} onSeek={audio.seek} label={label} />
        <div className={styles.times} aria-hidden>
          <span>{formatDuration(audio.currentTime)}</span>
          <span>{formatDuration(total)}</span>
        </div>
      </div>
    </section>
  );
}

export default VoiceLetter;
