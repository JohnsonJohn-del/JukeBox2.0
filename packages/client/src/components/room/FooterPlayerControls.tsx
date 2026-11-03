'use client';

import { useCallback, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, Volume2, VolumeX, Video, Tv, Film } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSocket } from '@/hooks/useSocket';
import { usePlayer } from '@/hooks/usePlayer';
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
    setCurrentTime,
    setIsVideoMode,
  } = usePlayerStore();

  const {
    play,
    pause,
    seekTo,
    mute: mutePlayer,
    unMute: unMutePlayer,
  } = usePlayer('youtube-player-element');

  const isPlaying = playbackState === 'playing';
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const trackHasVideoCounterpart = Boolean(currentTrack?.hasVideo && currentTrack?.musicVideoId);

  const handlePlayPause = useCallback(() => {
    if (!currentTrack) return;

    if (isPlaying) {
      pause();
      socket.emit(SOCKET_EVENTS.PAUSE, {
        roomId: room?.id,
        position: currentTime,
      });
    } else {
      play();
      socket.emit(SOCKET_EVENTS.PLAY, {
        roomId: room?.id,
        position: currentTime,
      });
    }
  }, [currentTrack, isPlaying, pause, play, socket, room?.id, currentTime]);

  const handleToggleVideoMode = useCallback(() => {
    if (!currentTrack) return;

    if (!isHost) {
      toast('Only the room host can switch Video Mode', { icon: '🔒' });
      return;
    }

    if (!isVideoMode && !trackHasVideoCounterpart) {
      toast.error('Official music video counterpart is not available on YouTube Music for this track.');
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
  }, [currentTrack, isHost, isVideoMode, trackHasVideoCounterpart, setIsVideoMode, setVideoMode, socket, room?.id, currentTime]);

  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isHost || !progressRef.current || !duration) return;

      const rect = progressRef.current.getBoundingClientRect();
      const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const time = fraction * duration;

      seekTo(time);
      setCurrentTime(time);

      socket.emit(SOCKET_EVENTS.SEEK, {
        roomId: room?.id,
        position: time,
      });
    },
    [isHost, duration, seekTo, setCurrentTime, socket, room?.id],
  );

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;

      if (next) mutePlayer();
      else unMutePlayer();

      return next;
    });
  }, [mutePlayer, unMutePlayer]);

  if (!currentTrack) {
    return (
      <div className="flex min-w-0 flex-1 items-center justify-center">
        <p className="font-button text-[10px] font-black uppercase tracking-[0.28em] text-jukebox-gold/45">
          Add a song to activate footer controls
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 items-center gap-4">
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleMute}
        className="h-10 w-10 shrink-0 rounded-full border border-jukebox-gold/30 bg-black/40 text-jukebox-gold hover:bg-jukebox-gold/10 hover:text-jukebox-cream"
      >
        {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </Button>

      <motion.button
        whileTap={{ scale: 0.92 }}
        onClick={handlePlayPause}
        className="jukebox-chrome-button flex h-14 w-14 shrink-0 items-center justify-center rounded-full"
      >
        {isPlaying ? (
          <Pause className="h-6 w-6 text-jukebox-black" />
        ) : (
          <Play className="ml-0.5 h-6 w-6 text-jukebox-black" />
        )}
      </motion.button>

      <div className="min-w-0 flex-1">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="relative max-w-[220px] overflow-hidden whitespace-nowrap sm:max-w-[280px] xl:max-w-[360px]">
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
            {/* Video Mode toggle button in footer */}
            <Button
              size="sm"
              variant="outline"
              onClick={handleToggleVideoMode}
              disabled={!isHost && !isVideoMode}
              className={`h-7 rounded-full px-2.5 text-[10px] font-bold transition-all ${
                isVideoMode
                  ? 'border-red-500/50 bg-red-600/20 text-red-400 hover:bg-red-600/30'
                  : trackHasVideoCounterpart
                  ? 'border-jukebox-gold/30 bg-black/40 text-jukebox-gold hover:bg-jukebox-gold/15'
                  : 'border-white/10 bg-white/5 text-gray-500 opacity-60'
              }`}
              title={
                !trackHasVideoCounterpart
                  ? 'No video counterpart on YouTube Music'
                  : !isHost
                  ? 'Host controls Video Mode'
                  : isVideoMode
                  ? 'Switch to Audio'
                  : 'Switch to Video'
              }
            >
              {isVideoMode ? (
                <>
                  <Tv className="mr-1 h-3 w-3 animate-pulse text-red-400" />
                  Video ON
                </>
              ) : (
                <>
                  <Video className="mr-1 h-3 w-3" />
                  {trackHasVideoCounterpart ? 'Video Avail' : 'Audio Only'}
                </>
              )}
            </Button>

            <div className="font-button flex shrink-0 items-center gap-2 text-[10px] font-black tracking-widest text-jukebox-cream/45">
              <span>{formatTime(currentTime)}</span>
              <span>/</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        </div>

        <div
          ref={progressRef}
          onClick={handleSeek}
          className="group relative h-3 cursor-pointer rounded-full jukebox-progress-track"
          title={isHost ? 'Click to seek' : 'Only host can seek'}
        >
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full jukebox-progress-fill"
            style={{ width: `${progress}%` }}
            layout
          />

          <div
            className="absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full border border-jukebox-gold/70 bg-jukebox-cream opacity-0 shadow-jukebox-gold transition-opacity group-hover:opacity-100"
            style={{
              left: `calc(${progress}% - 10px)`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
