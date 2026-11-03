'use client';

import { useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GripVertical, Trash2, Music, Disc3, ListMusic, Film, Play } from 'lucide-react';
import { useQueueStore } from '@/store/queueStore';
import { useRoomStore } from '@/store/roomStore';
import { useQueue } from '@/hooks/useQueue';
import { useAuthStore } from '@/store/authStore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn, getThumbnailUrl } from '@/lib/utils';
import type { QueueItem } from '@/types';

function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return '0:00';

  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);

  return `${m}:${s.toString().padStart(2, '0')}`;
}

function selectionCode(index: number): string {
  const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
  const letter = letters[Math.floor(index / 9)] ?? 'Z';
  const number = (index % 9) + 1;

  return `${letter}${number}`;
}

function QueueItemRow({
  item,
  isCurrent,
  isHost,
  currentUserId,
  onPlayNow,
  onRemove,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  index,
}: {
  item: QueueItem;
  isCurrent: boolean;
  isHost: boolean;
  currentUserId: string;
  onPlayNow?: (item: QueueItem) => void;
  onRemove: (id: string) => void;
  onDragStart: (index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDragEnd: () => void;
  onDrop: (index: number) => void;
  index: number;
}) {
  const code = selectionCode(index);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20, height: 0 }}
      animate={{ opacity: 1, x: 0, height: 'auto' }}
      exit={{ opacity: 0, x: 20, height: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'group relative overflow-hidden rounded-2xl border px-3 py-3 transition-all',
        isCurrent
          ? 'border-jukebox-cyan/55 bg-jukebox-cyan/10 shadow-jukebox-cyan'
          : 'border-jukebox-gold/20 bg-black/30 hover:border-jukebox-gold/45 hover:bg-jukebox-gold/5',
      )}
      draggable={isHost && !isCurrent}
      onDragStart={() => onDragStart(index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDragEnd={onDragEnd}
      onDrop={() => onDrop(index)}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-jukebox-gold/35 to-transparent" />

      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-xs font-black tracking-widest',
            isCurrent
              ? 'border-jukebox-cyan/60 bg-jukebox-cyan/15 text-jukebox-cyan'
              : 'border-jukebox-gold/40 bg-jukebox-black/80 text-jukebox-gold',
          )}
        >
          {code}
        </div>

        {isHost && !isCurrent && (
          <div className="shrink-0 cursor-grab text-jukebox-cream/20 transition-colors hover:text-jukebox-gold active:cursor-grabbing">
            <GripVertical className="h-4 w-4" />
          </div>
        )}

        <div className="relative shrink-0">
          <img
            src={getThumbnailUrl(item)}
            alt={item.title}
            className={cn(
              'h-11 w-11 rounded-xl border object-cover',
              isCurrent
                ? 'border-jukebox-cyan/70 shadow-jukebox-cyan'
                : 'border-jukebox-gold/25',
            )}
          />

          {isCurrent && (
            <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border border-jukebox-cyan/60 bg-jukebox-black shadow-jukebox-cyan">
              <Disc3 className="h-3 w-3 animate-spin text-jukebox-cyan [animation-duration:3s]" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'truncate text-sm font-bold',
              isCurrent ? 'text-jukebox-cream' : 'text-jukebox-cream/85',
            )}
          >
            {item.title}
          </p>

          <div className="flex items-center gap-2">
            <p className="mt-0.5 truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-jukebox-cream/35">
              {item.artist}
              {!isCurrent && item.addedBy && item.addedBy !== currentUserId && (
                <span className="text-jukebox-gold/45"> &middot; {item.addedBy}</span>
              )}
            </p>
            {item.hasVideo && (
              <span className="flex shrink-0 items-center gap-0.5 rounded border border-red-500/30 bg-red-950/40 px-1 py-0.2 text-[8px] font-bold text-red-400">
                <Film className="h-2 w-2" /> Video
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="text-[10px] font-black tracking-widest text-jukebox-gold/70">
            {formatTime(item.duration)}
          </span>

          {isCurrent ? (
            <span className="rounded-full border border-jukebox-cyan/40 bg-jukebox-cyan/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.18em] text-jukebox-cyan">
              Live
            </span>
          ) : (
            isHost && (
              <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                {onPlayNow && (
                  <button
                    onClick={() => onPlayNow(item)}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-red-600 hover:bg-red-500 text-white shadow-sm transition-transform hover:scale-110 active:scale-95"
                    title="Play this song now"
                  >
                    <Play className="h-3 w-3 fill-current ml-0.5" />
                  </button>
                )}
                <button
                  onClick={() => onRemove(item.id)}
                  className="rounded-full p-1.5 text-jukebox-cream/30 hover:bg-jukebox-red/15 hover:text-jukebox-red-bright transition-colors"
                  title="Remove song"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function Queue({ className }: { className?: string }) {
  const { queue, currentTrack } = useQueueStore();
  const { isHost } = useRoomStore();
  const { removeSong, reorderQueue, playSongNow } = useQueue();
  const user = useAuthStore((s) => s.user);
  const currentUserId = user?.id ?? '';

  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const handleDragStart = useCallback((index: number) => {
    dragItem.current = index;
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    dragOverItem.current = index;
  }, []);

  const handleDragEnd = useCallback(() => {
    dragItem.current = null;
    dragOverItem.current = null;
  }, []);

  const handleDrop = useCallback(
    (dropIndex: number) => {
      if (dragItem.current === null || dragItem.current === dropIndex) return;

      const items = [...queue];
      const [dragged] = items.splice(dragItem.current, 1);
      items.splice(dropIndex, 0, dragged);

      const reordered = items.map((item, idx) => ({
        id: item.id,
        position: idx,
      }));

      reorderQueue(reordered);
      dragItem.current = null;
      dragOverItem.current = null;
    },
    [queue, reorderQueue],
  );

  const handlePlayNow = useCallback(
    (item: QueueItem) => {
      playSongNow(
        item.videoId,
        item.title,
        item.artist,
        item.duration,
        getThumbnailUrl(item),
        item.musicVideoId,
        item.hasVideo,
      );
    },
    [playSongNow],
  );

  return (
    <div className={cn('jukebox-panel flex h-full flex-col overflow-hidden rounded-3xl p-4 sm:p-5', className)}>
      <div className="flex items-center justify-between border-b border-jukebox-gold/15 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-jukebox-gold/30 bg-black/40">
            <ListMusic className="h-5 w-5 text-jukebox-gold" />
          </div>
          <div>
            <h2 className="font-heading text-lg font-black uppercase heading-tracking text-jukebox-cream">
              Song Queue
            </h2>
            <p className="font-button text-[10px] font-black uppercase tracking-[0.2em] text-jukebox-gold/60">
              {queue.length} {queue.length === 1 ? 'Track' : 'Tracks'} Queued
            </p>
          </div>
        </div>

        {isHost && queue.length > 1 && (
          <span className="hidden rounded-full border border-jukebox-gold/20 bg-jukebox-gold/5 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-jukebox-gold/70 sm:inline-block">
            Drag &bull; Play &bull; Manage
          </span>
        )}
      </div>

      <ScrollArea className="flex-1 pt-3 pr-2">
        <div className="space-y-2">
          {currentTrack && (
            <QueueItemRow
              key={currentTrack.id || 'current-track'}
              item={currentTrack}
              isCurrent={true}
              isHost={isHost}
              currentUserId={currentUserId}
              onRemove={removeSong}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              onDrop={handleDrop}
              index={0}
            />
          )}

          <AnimatePresence initial={false}>
            {queue.map((item, index) => (
              <QueueItemRow
                key={item.id}
                item={item}
                isCurrent={false}
                isHost={isHost}
                currentUserId={currentUserId}
                onPlayNow={handlePlayNow}
                onRemove={removeSong}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
                onDrop={handleDrop}
                index={index + (currentTrack ? 1 : 0)}
              />
            ))}
          </AnimatePresence>

          {!currentTrack && queue.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-jukebox-gold/20 bg-black/30">
                <Music className="h-6 w-6 text-jukebox-gold/40" />
              </div>
              <p className="font-heading mt-4 text-base font-bold text-jukebox-cream/60">
                The Queue is Empty
              </p>
              <p className="font-body mt-1 text-xs text-jukebox-cream/35">
                Search songs above to build the playlist!
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
