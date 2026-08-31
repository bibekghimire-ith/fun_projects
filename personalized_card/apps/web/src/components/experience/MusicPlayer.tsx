import { useCallback, useEffect, useRef } from 'react';
import { Music, Pause } from 'lucide-react';
import { withMediaToken } from '../../lib/mediaUrl';
import { useMusic } from '../../stores/music';
import { useExperience } from './context';
import styles from './music.module.css';

/**
 * Mounted once, at the top of the renderer, and never unmounted while the
 * letter is open — so the song carries on across chapters instead of starting
 * again at every section.
 *
 * It never sounds before the recipient has done something deliberate: opening
 * the envelope, pressing begin, or pressing play here.
 */
export function MusicPlayer() {
  const { experience, config, t, preview, mediaToken } = useExperience();
  const media = experience.musicMedia;
  const src = withMediaToken(media?.url ?? '', mediaToken) || null;

  const audioRef = useRef<HTMLAudioElement>(null);
  const playing = useMusic((state) => state.playing);
  const started = useMusic((state) => state.started);
  const setPlaying = useMusic((state) => state.setPlaying);
  const setSrc = useMusic((state) => state.setSrc);
  const setVolume = useMusic((state) => state.setVolume);
  const markStarted = useMusic((state) => state.markStarted);

  // Keep the store in step with this experience, and leave nothing behind.
  useEffect(() => {
    setSrc(src);
    setVolume((config.musicVolume ?? 60) / 100);
    return () => {
      useMusic.getState().reset();
    };
  }, [src, config.musicVolume, setSrc, setVolume]);

  // Autoplay is a *request*, honoured only once a gesture has happened.
  useEffect(() => {
    if (!media || preview || !config.features.music) return;
    if (!config.musicAutoplay || !started) return;
    setPlaying(true);
  }, [media, preview, config.features.music, config.musicAutoplay, started, setPlaying]);

  // The one place playback is actually driven.
  useEffect(() => {
    const element = audioRef.current;
    if (!element) return;
    element.volume = Math.min(Math.max((config.musicVolume ?? 60) / 100, 0), 1);
    if (playing) {
      void element.play().catch(() => setPlaying(false));
    } else {
      element.pause();
    }
  }, [playing, config.musicVolume, setPlaying]);

  const toggle = useCallback(() => {
    markStarted();
    setPlaying(!playing);
  }, [markStarted, playing, setPlaying]);

  if (!media || !config.features.music) return null;

  return (
    <div className={styles.player}>
      <audio ref={audioRef} src={src ?? undefined} loop preload="auto" />
      <button
        type="button"
        className={styles.toggle}
        onClick={toggle}
        aria-label={playing ? t('music.pause') : t('music.play')}
        aria-pressed={playing}
      >
        {playing ? <Pause size={16} aria-hidden /> : <Music size={16} aria-hidden />}
        {playing && (
          <span className={styles.bars} aria-hidden>
            <span />
            <span />
            <span />
          </span>
        )}
      </button>
    </div>
  );
}

export default MusicPlayer;
