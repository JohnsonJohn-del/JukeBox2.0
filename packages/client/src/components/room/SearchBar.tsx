'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Loader2, Clock, Plus, AlertCircle, Radio, Disc3, Film, Play } from 'lucide-react';
import { searchService } from '@/services/search';
import { useQueue } from '@/hooks/useQueue';
import { useQueueStore } from '@/store/queueStore';
import { useAuthStore } from '@/store/authStore';
import { useRoomStore } from '@/store/roomStore';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { SearchResult } from '@/types';

function getSearchThumbnail(result: SearchResult): string {
  return result.thumbnails?.[0]?.url || `https://img.youtube.com/vi/${result.videoId}/hqdefault.jpg`;
}

function formatDuration(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return '0:00';

  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);

  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function SearchBar({ className }: { className?: string }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const { addSong, playSongNow, isAddCooldown } = useQueue();
  const queue = useQueueStore((s) => s.queue);
  const user = useAuthStore((s) => s.user);
  const isHost = useRoomStore((s) => s.isHost);
  const currentUserId = user?.id ?? '';

  const userQueueCount = queue.filter((item) => item.addedBy === currentUserId).length;
  const maxQueueReached = userQueueCount >= 7;

  const performSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setIsOpen(false);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { results: searchResults } = await searchService.searchSongs(q);
      setResults(searchResults);
      setIsOpen(true);
      setSelectedIndex(-1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      setResults([]);
      setIsOpen(false);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    debounceRef.current = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, performSearch]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handlePlayNow(result: SearchResult, e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    playSongNow(
      result.videoId,
      result.title,
      result.artist,
      result.duration,
      getSearchThumbnail(result),
      result.musicVideoId,
      result.hasVideo,
    );
    setQuery('');
    setResults([]);
    setIsOpen(false);
    inputRef.current?.blur();
  }

  function handleAddToQueue(result: SearchResult, e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    if (!isHost && (maxQueueReached || isAddCooldown)) return;

    addSong(
      result.videoId,
      result.title,
      result.artist,
      result.duration,
      getSearchThumbnail(result),
      result.musicVideoId,
      result.hasVideo,
    );

    setQuery('');
    setResults([]);
    setIsOpen(false);
    inputRef.current?.blur();
  }

  function handleSelect(result: SearchResult) {
    if (isHost) {
      handlePlayNow(result);
    } else {
      handleAddToQueue(result);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen || results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
        break;

      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
        break;

      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          handleSelect(results[selectedIndex]);
        }
        break;

      case 'Escape':
        setIsOpen(false);
        inputRef.current?.blur();
        break;
    }
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="jukebox-display relative rounded-2xl p-2">
        <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-jukebox-cyan/60 to-transparent" />

        <Search className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 dark:text-jukebox-gold/65 text-jukebox-brass" />

        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0 || isLoading) setIsOpen(true);
          }}
          placeholder="Search YouTube Music (click song to play instantly)..."
          className="h-11 rounded-xl border-jukebox-gold/20 bg-black/45 pl-10 pr-10 text-sm font-semibold text-jukebox-cream placeholder:text-black/40 dark:placeholder:text-jukebox-cream/30 focus-visible:ring-jukebox-cyan/35"
        />

        {isLoading ? (
          <Loader2 className="absolute right-5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-jukebox-cyan" />
        ) : (
          <Radio className="absolute right-5 top-1/2 h-4 w-4 -translate-y-1/2 text-jukebox-cyan/50" />
        )}
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="jukebox-panel absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border-jukebox-gold/40 bg-jukebox-black/95 shadow-2xl backdrop-blur-2xl"
          >
            <div className="flex items-center justify-between border-b border-jukebox-gold/15 px-4 py-3">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.28em] text-jukebox-gold/70">
                  YouTube Music Results
                </p>
                <p className="mt-1 text-xs text-jukebox-cream/45">
                  Click song or Play to start video & music immediately &bull; Click + to queue
                </p>
              </div>
              <Disc3 className="h-4 w-4 text-jukebox-cyan/70" />
            </div>

            {error ? (
              <div className="flex items-center justify-center gap-3 px-4 py-6 text-center">
                <AlertCircle className="h-5 w-5 shrink-0 text-jukebox-red-bright" />
                <p className="text-sm font-semibold text-jukebox-red-bright">{error}</p>
              </div>
            ) : results.length === 0 && !isLoading ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm font-semibold text-jukebox-cream/45">No results found</p>
                <p className="mt-1 text-xs text-jukebox-cream/25">Try another song or artist</p>
              </div>
            ) : (
              <div className="max-h-[360px] overflow-y-auto py-2">
                {results.map((result, idx) => {
                  const addDisabled = !isHost && (isAddCooldown || maxQueueReached);
                  const thumbnailUrl = getSearchThumbnail(result);
                  const hasVideo = Boolean(result.hasVideo && result.musicVideoId);

                  return (
                    <motion.div
                      key={result.videoId}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: idx * 0.03 }}
                      onClick={() => handleSelect(result)}
                      className={cn(
                        'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors cursor-pointer group',
                        selectedIndex === idx
                          ? 'bg-jukebox-cyan/10'
                          : 'hover:bg-jukebox-gold/10',
                      )}
                    >
                      <img
                        src={thumbnailUrl}
                        alt={result.title}
                        className="h-11 w-11 shrink-0 rounded-xl border border-jukebox-gold/25 bg-black/50 object-cover"
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-bold text-jukebox-cream group-hover:text-jukebox-gold transition-colors">
                            {result.title}
                          </p>
                          {hasVideo && (
                            <span className="flex shrink-0 items-center gap-1 rounded border border-red-500/30 bg-red-950/40 px-1.5 py-0.5 text-[9px] font-bold text-red-400">
                              <Film className="h-2.5 w-2.5" /> Video
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-jukebox-cream/45">
                          {result.artist}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <span className="text-[10px] font-black tracking-widest text-jukebox-gold/70">
                          {formatDuration(result.duration)}
                        </span>

                        {/* Direct Play Now Button */}
                        <button
                          type="button"
                          onClick={(e) => handlePlayNow(result, e)}
                          title="Play Now (Starts Video Immediately)"
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-red-600 hover:bg-red-500 text-white shadow-md transition-transform hover:scale-110 active:scale-95"
                        >
                          <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
                        </button>

                        {/* Add to Queue Button */}
                        <button
                          type="button"
                          onClick={(e) => handleAddToQueue(result, e)}
                          disabled={addDisabled}
                          title="Add to Queue"
                          className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-full jukebox-chrome-button transition-transform hover:scale-105 active:scale-95",
                            addDisabled && "opacity-40 cursor-not-allowed"
                          )}
                        >
                          <Plus className="h-4 w-4 text-jukebox-black" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
