import { create } from 'zustand';

interface MusicState {
  src: string | null;
  playing: boolean;
  setSrc: (src: string | null) => void;
  setPlaying: (playing: boolean) => void;
}

export const useMusic = create<MusicState>((set) => ({
  src: null,
  playing: false,
  setSrc: (src) => set({ src }),
  setPlaying: (playing) => set({ playing }),
}));
