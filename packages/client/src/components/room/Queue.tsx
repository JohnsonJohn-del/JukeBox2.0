'use client';

import { useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GripVertical, Trash2, Music, Disc3, ListMusic, Film } from 'lucide-react';
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

        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-[10px] font-black tracking-widest text-jukebox-gold/70">
            {formatTime(item.duration)}
          </span>

          {isCurrent && (
            <span className="rounded-full border border-jukebox-cyan/40 bg-jukebox-cyan/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.18em] text-jukebox-cyan">
              Live
            </span>
          )}

          {isHost && !isCurrent && (
            <button
              onClick={() => onRemove(item.id)}
              className="rounded-full p-1 text-jukebox-cream/25 opacity-0 transition-all hover:bg-jukebox-red/10 hover:text-jukebox-red-bright group-hover:opacity-100"
              title="Remove song"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function Queue({ className }: { className?: string }) {
  const { queue, currentTrack } = useQueueStore();
  const { isHost } = useRoomStore();
  const { removeSong, reorderQueue } = useQueue();
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
        position: idx + 1,
      }));

      reorderQueue(reordered);

      dragItem.current = null;
      dragOverItem.current = null;
    },
    [queue, reorderQueue],
  );

  const isEmpty = queue.length === 0 && !currentTrack;

  return (
    <div className={cn('flex h-full flex-col', className)}>
      <div className="flex items-center justify-between border-b border-jukebox-gold/20 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <ListMusic className="h-4 w-4 dark:text-jukebox-gold/75 text-jukebox-brass" />
          <div>
            <p className="font-button text-[9px] font-black uppercase tracking-[0.28em] dark:text-jukebox-gold/70 text-jukebox-brass">
              Program Queue
            </p>
            <h3 className="font-heading text-lg font-black uppercase heading-tracking text-jukebox-cream">
              Upcoming Selections
            </h3>
          </div>
        </div>

        <span className="font-roomcode rounded-xl border border-jukebox-gold/30 bg-black/45 px-2.5 py-1 text-xs font-bold text-jukebox-gold">
          {queue.length + (currentTrack ? 1 : 0)}
        </span>
      </div>

      <ScrollArea className="flex-1 p-3">
        {isEmpty ? (
          <div className="flex h-64 flex-col items-center justify-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-jukebox-gold/20 bg-black/35">
              <Music className="h-6 w-6 text-jukebox-gold/40" />
            </div>

            <p className="font-button mt-4 text-[10px] font-black uppercase tracking-[0.24em] text-jukebox-gold/50">
              Queue Depleted
            </p>

            <p className="font-body mt-1 text-sm text-jukebox-cream/45">
              Search YouTube Music to add songs to the program.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {currentTrack && (
              <QueueItemRow
                item={currentTrack}
                isCurrent={true}
                isHost={false}
                currentUserId={currentUserId}
                onRemove={() => {}}
                onDragStart={() => {}}
                onDragOver={() => {}}
                onDragEnd={() => {}}
                onDrop={() => {}}
                index={0}
              />
            )}

            <AnimatePresence mode="popLayout">
              {queue.map((item, idx) => (
                <QueueItemRow
                  key={item.id}
                  item={item}
                  isCurrent={false}
                  isHost={isHost}
                  currentUserId={currentUserId}
                  onRemove={removeSong}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDragEnd={handleDragEnd}
                  onDrop={handleDrop}
                  index={currentTrack ? idx + 1 : idx}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
