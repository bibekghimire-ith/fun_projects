import { create } from 'zustand';

interface MusicState {
  src: string | null;
  playing: boolean;
  /** 0–1. Set from the experience's config, which stores 0–100. */
  volume: number;
  /**
   * True once the recipient has done something deliberate — opened the
   * envelope, pressed begin, pressed play. Nothing may sound before this.
   */
  started: boolean;
  setSrc: (src: string | null) => void;
  setPlaying: (playing: boolean) => void;
  setVolume: (volume: number) => void;
  markStarted: () => void;
  reset: () => void;
}

export const useMusic = create<MusicState>((set) => ({
  src: null,
  playing: false,
  volume: 0.6,
  started: false,
  setSrc: (src) => set({ src }),
  setPlaying: (playing) => set({ playing }),
  setVolume: (volume) => set({ volume: Math.min(Math.max(volume, 0), 1) }),
  markStarted: () => set({ started: true }),
  reset: () => set({ src: null, playing: false, started: false }),
}));
