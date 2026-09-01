import { useCallback, useRef } from 'react';
import { Pause, Play } from 'lucide-react';
import { cx } from '../../ui';
import { formatDuration } from '../../lib/format';
import { withMediaToken } from '../../lib/mediaUrl';
import { useMusic } from '../../stores/music';
import { useExperience } from './context';
import { useAudio } from './useAudio';
import styles from './audio.module.css';

export interface AudioPlayerProps {
  src: string;
  title?: string;
  description?: string;
  duration?: number | null;
}

/**
 * A quiet inline player for a song or a short note. Background music steps out
 * of the way while it plays, and steps back in when it finishes.
 */
export function AudioPlayer({ src, title, description, duration }: AudioPlayerProps) {
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
    <div className={styles.inline}>
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

      <button type="button" className={styles.playSmall} onClick={audio.toggle} aria-label={label}>
        {audio.playing ? <Pause size={18} aria-hidden /> : <Play size={18} aria-hidden />}
      </button>

      <div className={styles.inlineBody}>
        {title && <p className={styles.inlineTitle}>{title}</p>}
        {description && <p className={styles.inlineDescription}>{description}</p>}
        <Scrubber
          className={styles.inlineScrubber}
          value={audio.currentTime}
          max={total}
          onSeek={audio.seek}
          label={label}
        />
      </div>

      <span className={styles.time} aria-hidden>
        {formatDuration(total - audio.currentTime)}
      </span>
    </div>
  );
}

interface ScrubberProps {
  value: number;
  max: number;
  onSeek: (seconds: number) => void;
  /** Reused as the accessible name — there is no separate copy key for a seek bar. */
  label: string;
  className?: string;
}

/**
 * A native range input, so arrow keys, Home/End and page keys all work without
 * anything being reimplemented.
 */
export function Scrubber({ value, max, onSeek, label, className }: ScrubberProps) {
  return (
    <input
      type="range"
      className={cx(styles.scrubber, className)}
      min={0}
      max={max > 0 ? max : 1}
      step={0.5}
      value={Math.min(value, max > 0 ? max : 1)}
      onChange={(event) => onSeek(Number(event.target.value))}
      aria-label={label}
      aria-valuetext={formatDuration(value)}
      disabled={max <= 0}
    />
  );
}

export default AudioPlayer;
