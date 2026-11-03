import { create } from 'zustand';
import type { QueueItem } from '@/types';

export function normalizeQueueItem(t: any): QueueItem | null {
  if (!t) return null;

  const musicVideoId = t.musicVideoId || t.music_video_id || null;
  const videoId = t.videoId || t.video_id || '';
  const hasVideo = Boolean(t.hasVideo ?? t.has_video ?? musicVideoId);

  return {
    id: t.id,
    roomId: t.roomId || t.room_id || '',
    videoId,
    musicVideoId: musicVideoId || videoId,
    hasVideo: true, // Any YouTube stream can be watched in Video Mode
    title: t.title || 'Unknown Title',
    artist: t.artist || 'Unknown Artist',
    duration: Number(t.duration || 0),
    thumbnail: t.thumbnail || null,
    position: Number(t.position || 0),
    addedBy: t.addedBy || t.added_by || '',
    addedAt: t.addedAt || t.added_at || '',
    isPlayed: Boolean(t.isPlayed ?? t.is_played),
  };
}

interface QueueState {
  queue: QueueItem[];
  currentTrack: QueueItem | null;
  setQueue: (queue: any[]) => void;
  setCurrentTrack: (track: any) => void;
  addItem: (item: any) => void;
  removeItem: (itemId: string) => void;
  reorder: (fromIndex: number, toIndex: number) => void;
  clearQueue: () => void;
}

export const useQueueStore = create<QueueState>()((set) => ({
  queue: [],
  currentTrack: null,

  setQueue: (rawQueue) => {
    const queue = (rawQueue || [])
      .map(normalizeQueueItem)
      .filter((item): item is QueueItem => item !== null);
    set({ queue });
  },

  setCurrentTrack: (rawTrack) => {
    const currentTrack = normalizeQueueItem(rawTrack);
    set({ currentTrack });
  },

  addItem: (rawItem) => {
    const item = normalizeQueueItem(rawItem);
    if (!item) return;
    set((state) => ({
      queue: [...state.queue, item],
    }));
  },

  removeItem: (itemId) =>
    set((state) => ({
      queue: state.queue.filter((i) => i.id !== itemId),
    })),

  reorder: (fromIndex, toIndex) =>
    set((state) => {
      const queue = [...state.queue];
      const [moved] = queue.splice(fromIndex, 1);
      queue.splice(toIndex, 0, moved);
      return { queue };
    }),

  clearQueue: () =>
    set({ queue: [], currentTrack: null }),
}));
