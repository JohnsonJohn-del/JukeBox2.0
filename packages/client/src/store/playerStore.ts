import { create } from 'zustand';

type PlaybackState = 'playing' | 'paused' | 'stopped' | 'buffering';

interface PlayerState {
  playbackState: PlaybackState;
  currentTime: number;
  duration: number;
  isVideoMode: boolean;
  activeVideoId: string | null;
  setPlaybackState: (state: PlaybackState) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setIsVideoMode: (isVideoMode: boolean) => void;
  setActiveVideoId: (id: string | null) => void;
  reset: () => void;
}

export const usePlayerStore = create<PlayerState>()((set) => ({
  playbackState: 'stopped',
  currentTime: 0,
  duration: 0,
  isVideoMode: false,
  activeVideoId: null,

  setPlaybackState: (state) =>
    set({ playbackState: state }),

  setCurrentTime: (time) =>
    set({ currentTime: time }),

  setDuration: (duration) =>
    set({ duration }),

  setIsVideoMode: (isVideoMode) =>
    set({ isVideoMode }),

  setActiveVideoId: (activeVideoId) =>
    set({ activeVideoId }),

  reset: () =>
    set({
      playbackState: 'stopped',
      currentTime: 0,
      duration: 0,
      isVideoMode: false,
      activeVideoId: null,
    }),
}));
