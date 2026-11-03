'use client';

import { useCallback, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Video, Tv, Film } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSocket } from '@/hooks/useSocket';
import { usePlayerStore } from '@/store/playerStore';
import { useQueueStore } from '@/store/queueStore';
import { useRoomStore } from '@/store/roomStore';
import { SOCKET_EVENTS } from '@/sockets/events';
import { Button } from '@/components/ui/button';

function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return '0:00';

  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);

  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function FooterPlayerControls() {
  const progressRef = useRef<HTMLDivElement>(null);
  const [muted, setMuted] = useState(false);

  const { socket } = useSocket();
  const { room, isHost, setVideoMode } = useRoomStore();
  const { currentTrack } = useQueueStore();

  const {
    playbackState,
    currentTime,
    duration,
    isVideoMode,
    playerControls,
    setCurrentTime,
    setIsVideoMode,
    setPlaybackState,
  } = usePlayerStore();

  const isPlaying = playbackState === 'playing';
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const trackHasVideoCounterpart = Boolean(currentTrack?.hasVideo || currentTrack?.musicVideoId);

  const handlePlayPause = useCallback(() => {
    if (!currentTrack || !isHost) return;

    if (isPlaying) {
      playerControls?.pause();
      setPlaybackState('paused');
      if (isHost && room?.id) {
        socket.emit(SOCKET_EVENTS.PAUSE, {
          roomId: room.id,
          position: currentTime,
        });
      }
    } else {
      playerControls?.unMute();
      playerControls?.play();
      setPlaybackState('playing');
      if (isHost && room?.id) {
        socket.emit(SOCKET_EVENTS.PLAY, {
          roomId: room.id,
          position: currentTime,
        });
      }
    }
  }, [currentTrack, isPlaying, playerControls, socket, room?.id, currentTime, isHost, setPlaybackState]);

  const handlePrevious = useCallback(() => {
    if (!isHost) {
      toast('Only the room host can change tracks', { icon: '🔒' });
      return;
    }
    socket.emit(SOCKET_EVENTS.PREVIOUS_TRACK, { roomId: room?.id });
  }, [isHost, socket, room?.id]);

  const handleNext = useCallback(() => {
    if (!isHost) {
      toast('Only the room host can skip tracks', { icon: '🔒' });
      return;
    }
    socket.emit(SOCKET_EVENTS.NEXT_TRACK, { roomId: room?.id });
  }, [isHost, socket, room?.id]);

  const handleToggleVideoMode = useCallback(() => {
    if (!currentTrack) return;

    if (!isHost) {
      toast('Only the room host can switch Video Mode', { icon: '🔒' });
      return;
    }

    const nextMode = !isVideoMode;
    setIsVideoMode(nextMode);
    setVideoMode(nextMode);

    socket.emit(SOCKET_EVENTS.TOGGLE_VIDEO_MODE, {
      roomId: room?.id,
      isVideoMode: nextMode,
      position: currentTime,
    });
  }, [currentTrack, isHost, isVideoMode, setIsVideoMode, setVideoMode, socket, room?.id, currentTime]);

  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isHost || !progressRef.current || !duration) return;

      const rect = progressRef.current.getBoundingClientRect();
      const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const time = fraction * duration;

      playerControls?.seekTo(time);
      setCurrentTime(time);

      socket.emit(SOCKET_EVENTS.SEEK, {
        roomId: room?.id,
        position: time,
      });
    },
    [isHost, duration, playerControls, setCurrentTime, socket, room?.id],
  );

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;

      if (next) playerControls?.mute();
      else playerControls?.unMute();

      return next;
    });
  }, [playerControls]);

  if (!currentTrack) {
    return (
      <div className="flex min-w-0 flex-1 items-center justify-center">
        <p className="font-button text-[10px] font-black uppercase tracking-[0.28em] text-jukebox-gold/45">
          Add a song from YouTube Music to activate player
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleMute}
        className="h-10 w-10 shrink-0 rounded-full border border-jukebox-gold/30 bg-black/40 text-jukebox-gold hover:bg-jukebox-gold/10 hover:text-jukebox-cream"
      >
        {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </Button>

      {/* Playback Transport Buttons (Host Only) or Guest Locked Status */}
      {isHost ? (
        <div className="flex items-center gap-1 sm:gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePrevious}
            className="h-9 w-9 shrink-0 rounded-full border border-jukebox-gold/20 bg-black/40 text-jukebox-gold/80 hover:bg-jukebox-gold/10 hover:text-jukebox-cream cursor-pointer"
            title="Previous Track"
          >
            <SkipBack className="h-4 w-4" />
          </Button>

          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={handlePlayPause}
            className="jukebox-chrome-button flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-full cursor-pointer"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="h-5 w-5 sm:h-6 sm:w-6 text-jukebox-black" />
            ) : (
              <Play className="ml-0.5 h-5 w-5 sm:h-6 sm:w-6 text-jukebox-black" />
            )}
          </motion.button>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleNext}
            className="h-9 w-9 shrink-0 rounded-full border border-jukebox-gold/20 bg-black/40 text-jukebox-gold/80 hover:bg-jukebox-gold/10 hover:text-jukebox-cream cursor-pointer"
            title="Next Track"
          >
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-jukebox-gold/30 bg-black/50 shadow-sm">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-wider text-jukebox-gold">
            Host Controls Playback
          </span>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="relative max-w-[180px] overflow-hidden whitespace-nowrap sm:max-w-[280px] xl:max-w-[360px]">
              <motion.p
                key={currentTrack.title}
                initial={{ x: '0%' }}
                animate={{ x: ['0%', '-55%', '0%'] }}
                transition={{
                  duration: 10,
                  repeat: Infinity,
                  ease: 'linear',
                  repeatDelay: 1.5,
                }}
                className="font-heading inline-block min-w-max text-sm font-black uppercase heading-tracking text-jukebox-cream"
              >
                {currentTrack.title}
              </motion.p>
            </div>
            <p className="font-button truncate text-[10px] font-bold uppercase tracking-[0.18em] text-jukebox-cyan/70">
              {currentTrack.artist}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* YouTube Music [ Song | Video ] Toggle in Footer */}
            <div className="flex items-center rounded-full bg-black/60 p-0.5 border border-white/10">
              <button
                onClick={() => isVideoMode && handleToggleVideoMode()}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                  !isVideoMode
                    ? 'bg-jukebox-gold text-black shadow-sm font-black'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                Song
              </button>
              <button
                onClick={() => !isVideoMode && handleToggleVideoMode()}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                  isVideoMode
                    ? 'bg-red-600 text-white shadow-sm font-black'
                    : 'text-white/60 hover:text-white cursor-pointer'
                }`}
                title={!isHost ? 'Only host can toggle video mode' : 'Switch to Video Mode'}
              >
                Video
              </button>
            </div>

            <div className="font-button hidden sm:flex shrink-0 items-center gap-2 text-[10px] font-black tracking-widest text-jukebox-cream/45">
              <span>{formatTime(currentTime)}</span>
              <span>/</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        </div>

        <div
          ref={progressRef}
          onClick={handleSeek}
          className={`group relative h-3 rounded-full jukebox-progress-track ${isHost ? 'cursor-pointer' : 'cursor-default pointer-events-none'}`}
          title={isHost ? 'Click to seek' : 'Playback locked to host'}
        >
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full jukebox-progress-fill"
            style={{ width: `${progress}%` }}
            layout
          />

          <div
            className="absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full border border-jukebox-gold/70 bg-jukebox-cream opacity-0 shadow-jukebox-gold transition-opacity group-hover:opacity-100"
            style={{ left: `calc(${progress}% - 10px)` }}
          />
        </div>
      </div>
    </div>
  );
}
