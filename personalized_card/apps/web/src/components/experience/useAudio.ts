import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

export interface AudioController {
  ref: RefObject<HTMLAudioElement>;
  playing: boolean;
  /** Seconds. */
  currentTime: number;
  duration: number;
  toggle: () => void;
  seek: (seconds: number) => void;
  /** Wire these onto the <audio> element. */
  bind: {
    onPlay: () => void;
    onPause: () => void;
    onEnded: () => void;
    onTimeUpdate: () => void;
    onLoadedMetadata: () => void;
  };
}

/**
 * The shared plumbing behind the inline player and the voice letter. Nothing
 * here ever starts playback on its own — `toggle` is only ever called from a
 * real user gesture.
 */
export function useAudio(fallbackDuration?: number | null): AudioController {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(fallbackDuration ?? 0);

  const sync = useCallback(() => {
    const element = ref.current;
    if (!element) return;
    setCurrentTime(element.currentTime);
    if (Number.isFinite(element.duration) && element.duration > 0) {
      setDuration(element.duration);
    }
  }, []);

  const toggle = useCallback(() => {
    const element = ref.current;
    if (!element) return;
    if (element.paused) {
      void element.play().catch(() => setPlaying(false));
    } else {
      element.pause();
    }
  }, []);

  const seek = useCallback((seconds: number) => {
    const element = ref.current;
    if (!element) return;
    const max = Number.isFinite(element.duration) && element.duration > 0 ? element.duration : seconds;
    element.currentTime = Math.min(Math.max(seconds, 0), max);
    setCurrentTime(element.currentTime);
  }, []);

  // Leave nothing playing behind when the section goes away.
  useEffect(() => {
    const element = ref.current;
    return () => {
      element?.pause();
    };
  }, []);

  return {
    ref,
    playing,
    currentTime,
    duration,
    toggle,
    seek,
    bind: {
      onPlay: () => setPlaying(true),
      onPause: () => setPlaying(false),
      onEnded: () => {
        setPlaying(false);
        setCurrentTime(0);
      },
      onTimeUpdate: sync,
      onLoadedMetadata: sync,
    },
  };
}
