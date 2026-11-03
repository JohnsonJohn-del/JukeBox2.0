import { create } from 'zustand';

type PlaybackState = 'playing' | 'paused' | 'stopped' | 'buffering';

export interface PlayerControls {
  play: () => void;
  pause: () => void;
  seekTo: (seconds: number) => void;
  mute: () => void;
  unMute: () => void;
  loadVideo: (videoId: string, startSeconds?: number) => void;
}

interface PlayerState {
  playbackState: PlaybackState;
  currentTime: number;
  duration: number;
  isVideoMode: boolean;
  activeVideoId: string | null;
  playerControls: PlayerControls | null;
  setPlaybackState: (state: PlaybackState) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setIsVideoMode: (isVideoMode: boolean) => void;
  setActiveVideoId: (id: string | null) => void;
  setPlayerControls: (controls: PlayerControls | null) => void;
  reset: () => void;
}

export const usePlayerStore = create<PlayerState>()((set) => ({
  playbackState: 'stopped',
  currentTime: 0,
  duration: 0,
  isVideoMode: true,
  activeVideoId: null,
  playerControls: null,

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

  setPlayerControls: (playerControls) =>
    set({ playerControls }),

  reset: () =>
    set({
      playbackState: 'stopped',
      currentTime: 0,
      duration: 0,
      isVideoMode: true,
      activeVideoId: null,
      playerControls: null,
    }),
}));
