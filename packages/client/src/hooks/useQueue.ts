'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { socket } from '@/sockets';
import { SOCKET_EVENTS } from '@/sockets/events';
import { useQueueStore } from '@/store/queueStore';
import { useAuthStore } from '@/store/authStore';
import { useRoomStore } from '@/store/roomStore';
import type { QueueItem } from '@/types';

export function useQueue() {
  const { queue, currentTrack, setQueue, setCurrentTrack } = useQueueStore();
  const token = useAuthStore((s) => s.token);
  const roomId = useRoomStore((s) => s.room?.id);
  const [isAddCooldown, setIsAddCooldown] = useState(false);
  const cooldownTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    function onQueueUpdated(data: { queue: QueueItem[] }) {
      setQueue(data.queue);
    }
    function onTrackChanged(data: { track: QueueItem | null }) {
      setCurrentTrack(data.track);
    }

    socket.on(SOCKET_EVENTS.QUEUE_UPDATED, onQueueUpdated);
    socket.on(SOCKET_EVENTS.TRACK_CHANGED, onTrackChanged);

    return () => {
      socket.off(SOCKET_EVENTS.QUEUE_UPDATED, onQueueUpdated);
      socket.off(SOCKET_EVENTS.TRACK_CHANGED, onTrackChanged);
    };
  }, [setQueue, setCurrentTrack]);

  const addSong = useCallback(
    (
      videoId: string,
      title: string,
      artist: string,
      duration: number,
      thumbnail: string,
      musicVideoId?: string | null,
      hasVideo?: boolean,
    ) => {
      if (isAddCooldown || !roomId) return;

      setIsAddCooldown(true);
      cooldownTimer.current = setTimeout(() => {
        setIsAddCooldown(false);
      }, 60000);

      socket.emit(SOCKET_EVENTS.ADD_SONG, {
        roomId,
        videoId,
        title,
        artist,
        duration,
        thumbnail,
        musicVideoId,
        hasVideo,
      });

      console.log('[QUEUE SONG]', { roomId, videoId, title, musicVideoId, hasVideo });
    },
    [roomId, isAddCooldown],
  );

  const removeSong = useCallback(
    (itemId: string) => {
      if (!roomId) return;
      socket.emit(SOCKET_EVENTS.REMOVE_SONG, { roomId, itemId });
    },
    [roomId],
  );

  const reorderQueue = useCallback(
    (items: { id: string; position: number }[]) => {
      if (!roomId) return;
      socket.emit(SOCKET_EVENTS.REORDER_QUEUE, { roomId, items });
    },
    [roomId],
  );

  return {
    queue,
    currentTrack,
    addSong,
    removeSong,
    reorderQueue,
    isAddCooldown,
  };
}
