'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  Music,
  Disc3,
  Sparkles,
  Video,
  Film,
  AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { usePlayer } from '@/hooks/usePlayer';
import { useSocket } from '@/hooks/useSocket';
import { usePlayerStore } from '@/store/playerStore';
import { useQueueStore } from '@/store/queueStore';
import { useRoomStore } from '@/store/roomStore';
import { useThemeColors } from '@/hooks/useThemeColors';
import { SOCKET_EVENTS } from '@/sockets/events';
import { Button } from '@/components/ui/button';
import { getThumbnailUrl } from '@/lib/utils';
import type { QueueItem, VideoModeChangedPayload } from '@/types';

function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function Player() {
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [muted, setMuted] = useState(false);
  const [userInteracted, setUserInteracted] = useState(false);
  const [seekHover, setSeekHover] = useState<number | null>(null);
  const currentActiveVideoIdRef = useRef<string | null>(null);

  const { socket } = useSocket();
  const { isHost, room, setVideoMode } = useRoomStore();
  const { currentTrack } = useQueueStore();
  const {
    playbackState,
    currentTime,
    duration,
    isVideoMode,
    setCurrentTime,
    setDuration,
    setPlaybackState,
    setIsVideoMode,
  } = usePlayerStore();

  const handlePlayerError = useCallback((errorCode: number) => {
    console.warn('[Player] YouTube error received:', errorCode);
    if (errorCode === 101 || errorCode === 150) {
      toast.error('Embedded playback restricted by owner. Trying audio/music stream...', {
        duration: 4000,
        icon: '⚠️',
      });
      if (currentTrack?.videoId) {
        setIsVideoMode(false);
        setVideoMode(false);
        currentActiveVideoIdRef.current = currentTrack.videoId;
        loadVideo(currentTrack.videoId, currentTime);
        play();
      }
    }
  }, [currentTrack, currentTime, setIsVideoMode, setVideoMode]);

  // Stage B Sync: When player is ready, non-hosts request authoritative sync
  const handlePlayerReady = useCallback(() => {
    if (!isHost && room?.id) {
      socket.emit('request_sync', { roomId: room.id, clientSendTime: Date.now() });
    }
  }, [isHost, room?.id, socket]);

  const {
    loadVideo,
    play,
    pause,
    seekTo,
    isReady,
    getCurrentTime,
    mute: mutePlayer,
    unMute: unMutePlayer,
  } = usePlayer(playerContainerRef, {
    onEnded: () => {
      if (!isHost) return;
      socket.emit(SOCKET_EVENTS.NEXT_TRACK, { roomId: room?.id });
    },
    onError: handlePlayerError,
    onReady: handlePlayerReady,
  });

  const { colors } = useThemeColors(getThumbnailUrl(currentTrack) || null);

  // Global user interaction listener to unblock browser autoplay
  useEffect(() => {
    const onInteraction = () => {
      setUserInteracted(true);
      unMutePlayer();
    };
    window.addEventListener('click', onInteraction, { once: true });
    window.addEventListener('keydown', onInteraction, { once: true });
    return () => {
      window.removeEventListener('click', onInteraction);
      window.removeEventListener('keydown', onInteraction);
    };
  }, [unMutePlayer]);

  // Periodic host progress heartbeat (emitted every 2.5s to keep server position authoritative)
  useEffect(() => {
    if (!isHost || playbackState !== 'playing' || !room?.id) return;

    const interval = setInterval(() => {
      const activeTime = getCurrentTime() || currentTime;
      if (activeTime > 0) {
        socket.emit('host_progress', { roomId: room.id, position: activeTime });
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [isHost, playbackState, room?.id, socket, getCurrentTime, currentTime]);

  // Determine active video ID: in Video Mode prefer official music/lyric video
  const musicVideoId = currentTrack?.musicVideoId || (currentTrack as any)?.music_video_id || null;
  const audioVideoId = currentTrack?.videoId || (currentTrack as any)?.video_id || null;
  const hasOfficialVideo = Boolean(musicVideoId && musicVideoId !== audioVideoId);
  const targetVideoId = isVideoMode && musicVideoId ? musicVideoId : (musicVideoId || audioVideoId);

  // Automatically load and start track when targetVideoId changes
  useEffect(() => {
    if (!targetVideoId) return;

    if (currentActiveVideoIdRef.current !== targetVideoId) {
      currentActiveVideoIdRef.current = targetVideoId;
      loadVideo(targetVideoId, currentTime || 0);
      play();
    }
  }, [targetVideoId, isVideoMode, isReady, loadVideo, play]);

  // Synchronize with socket events
  useEffect(() => {
    function onPlaybackState(data: { state: string; position: number; track: QueueItem | null; isVideoMode?: boolean }) {
      if (data.track) {
        useQueueStore.getState().setCurrentTrack(data.track);
        if (data.track.duration) setDuration(data.track.duration);
      }
      setCurrentTime(data.position);
      setPlaybackState(data.state as 'playing' | 'paused' | 'stopped');

      if (data.isVideoMode !== undefined) {
        setIsVideoMode(data.isVideoMode);
        setVideoMode(data.isVideoMode);
      }

      if (data.state === 'playing') {
        play();
      } else if (data.state === 'paused') {
        pause();
      }
    }

    function onSeeked(data: { position: number }) {
      setCurrentTime(data.position);
      seekTo(data.position);
    }

    function onTrackChanged(data: { track: QueueItem | null }) {
      if (!data.track) return;

      const track = data.track;
      useQueueStore.getState().setCurrentTrack(track);
      if (track.duration) setDuration(track.duration);
      setCurrentTime(0);
      setPlaybackState('playing');

      const mId = track.musicVideoId || (track as any).music_video_id;
      const vId = track.videoId || (track as any).video_id;
      const nextTarget = isVideoMode && mId ? mId : (mId || vId);

      if (nextTarget) {
        currentActiveVideoIdRef.current = nextTarget;
        loadVideo(nextTarget, 0);
        play();
      }
    }

    function onVideoModeChanged(data: VideoModeChangedPayload) {
      setIsVideoMode(data.isVideoMode);
      setVideoMode(data.isVideoMode);

      toast(data.isVideoMode ? 'Host switched to Video Mode 🎬' : 'Host switched to Audio Mode 🎵', {
        icon: data.isVideoMode ? '🎬' : '🎵',
        duration: 3000,
      });
    }

    function onSyncState(data: {
      playbackPosition: number;
      playbackState: string;
      currentTrack: QueueItem | null;
      isVideoMode: boolean;
      clientSendTime?: number;
    }) {
      if (data.currentTrack) {
        useQueueStore.getState().setCurrentTrack(data.currentTrack);
        if (data.currentTrack.duration) setDuration(data.currentTrack.duration);
      }

      const rttSec = data.clientSendTime ? Math.max(0, (Date.now() - data.clientSendTime) / 2000) : 0;
      const targetPos = data.playbackPosition + (data.playbackState === 'playing' ? rttSec : 0);
      const localTime = getCurrentTime();
      const drift = Math.abs(localTime - targetPos);

      if (drift > 2) {
        seekTo(targetPos);
        setCurrentTime(targetPos);
      } else {
        setCurrentTime(targetPos);
      }

      setPlaybackState(data.playbackState as 'playing' | 'paused' | 'stopped' | 'buffering');
      if (data.playbackState === 'playing') {
        play();
      } else if (data.playbackState === 'paused') {
        pause();
      }

      if (data.isVideoMode !== undefined) {
        setIsVideoMode(data.isVideoMode);
        setVideoMode(data.isVideoMode);
      }
    }

    socket.on(SOCKET_EVENTS.PLAYBACK_STATE, onPlaybackState);
    socket.on(SOCKET_EVENTS.SEEKED, onSeeked);
    socket.on(SOCKET_EVENTS.TRACK_CHANGED, onTrackChanged);
    socket.on(SOCKET_EVENTS.VIDEO_MODE_CHANGED, onVideoModeChanged);
    socket.on(SOCKET_EVENTS.SYNC_STATE, onSyncState);

    return () => {
      socket.off(SOCKET_EVENTS.PLAYBACK_STATE, onPlaybackState);
      socket.off(SOCKET_EVENTS.SEEKED, onSeeked);
      socket.off(SOCKET_EVENTS.TRACK_CHANGED, onTrackChanged);
      socket.off(SOCKET_EVENTS.VIDEO_MODE_CHANGED, onVideoModeChanged);
      socket.off(SOCKET_EVENTS.SYNC_STATE, onSyncState);
    };
  }, [
    socket,
    seekTo,
    setCurrentTime,
    setDuration,
    setPlaybackState,
    setIsVideoMode,
    setVideoMode,
    loadVideo,
    play,
    pause,
    getCurrentTime,
    isVideoMode,
  ]);

  const handleEnablePlayback = useCallback(() => {
    setUserInteracted(true);
    unMutePlayer();

    if (targetVideoId) {
      currentActiveVideoIdRef.current = targetVideoId;
      loadVideo(targetVideoId, currentTime || 0);
      play();
    }

    if (isHost && room?.id) {
      socket.emit(SOCKET_EVENTS.PLAY, { roomId: room.id, position: currentTime || 0 });
    }
  }, [targetVideoId, loadVideo, play, currentTime, unMutePlayer, isHost, room?.id, socket]);

  const handlePlayPause = useCallback(() => {
    if (!userInteracted) {
      handleEnablePlayback();
      return;
    }

    if (playbackState === 'playing') {
      pause();
      setPlaybackState('paused');
      if (isHost && room?.id) {
        socket.emit(SOCKET_EVENTS.PAUSE, { roomId: room.id, position: currentTime });
      }
    } else {
      unMutePlayer();
      play();
      setPlaybackState('playing');
      if (isHost && room?.id) {
        socket.emit(SOCKET_EVENTS.PLAY, { roomId: room.id, position: currentTime });
      }
    }
  }, [playbackState, pause, play, socket, room?.id, currentTime, userInteracted, handleEnablePlayback, unMutePlayer, isHost, setPlaybackState]);

  const handleToggleVideoMode = useCallback((desiredMode?: boolean) => {
    if (!currentTrack) return;

    const nextMode = desiredMode !== undefined ? desiredMode : !isVideoMode;
    setIsVideoMode(nextMode);
    setVideoMode(nextMode);

    const mId = currentTrack.musicVideoId || (currentTrack as any).music_video_id;
    const vId = currentTrack.videoId || (currentTrack as any).video_id;
    const newTarget = nextMode && mId ? mId : (mId || vId);

    if (newTarget && currentActiveVideoIdRef.current !== newTarget) {
      currentActiveVideoIdRef.current = newTarget;
      loadVideo(newTarget, currentTime || 0);
      play();
    }

    if (isHost && room?.id) {
      socket.emit(SOCKET_EVENTS.TOGGLE_VIDEO_MODE, {
        roomId: room.id,
        isVideoMode: nextMode,
        position: currentTime,
      });
    }
  }, [currentTrack, isHost, isVideoMode, currentTime, setIsVideoMode, setVideoMode, loadVideo, play, socket, room?.id]);

  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isHost || !progressRef.current || !duration) return;

      const rect = progressRef.current.getBoundingClientRect();
      const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const time = fraction * duration;

      seekTo(time);
      setCurrentTime(time);
      socket.emit(SOCKET_EVENTS.SEEK, { roomId: room?.id, position: time });
    },
    [isHost, duration, seekTo, setCurrentTime, socket, room?.id],
  );

  const handleSeekHover = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!progressRef.current || !duration) return;

      const rect = progressRef.current.getBoundingClientRect();
      const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));

      setSeekHover(fraction * duration);
    },
    [duration],
  );

  const handlePrevious = useCallback(() => {
    if (!isHost) return;
    socket.emit(SOCKET_EVENTS.PREVIOUS_TRACK, { roomId: room?.id });
  }, [isHost, socket, room?.id]);

  const handleSkip = useCallback(() => {
    if (!isHost) return;
    socket.emit(SOCKET_EVENTS.NEXT_TRACK, { roomId: room?.id });
  }, [isHost, socket, room?.id]);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      if (next) mutePlayer();
      else unMutePlayer();
      return next;
    });
  }, [mutePlayer, unMutePlayer]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const isPlaying = playbackState === 'playing';
  const accentColor = colors.primary || '#d6a84f';
  const thumbnailUrl = getThumbnailUrl(currentTrack);

  return (
    <div
      className="relative flex h-full w-full items-center justify-center overflow-hidden p-3 sm:p-5 lg:p-6"
      style={
        {
          '--player-accent': accentColor,
          '--player-glow': `${accentColor}55`,
        } as React.CSSProperties
      }
    >
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute left-1/2 top-1/2 h-[620px] w-[620px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[130px]"
          style={{ backgroundColor: `${accentColor}20` }}
        />
      </div>

      <div className="relative flex w-full max-w-[800px] flex-col items-center">
        {/* Native YouTube Music [ Song | Video ] Toggle Pill Bar */}
        <div className="mb-4 flex flex-col sm:flex-row items-center justify-between gap-3 w-full max-w-[640px] px-2">
          <div className="flex items-center gap-2">
            <span className="flex h-6 items-center gap-1.5 rounded-full border border-red-500/40 bg-red-950/40 px-2.5 text-[10px] font-bold uppercase tracking-wider text-red-400">
              <Film className="h-3 w-3 text-red-500" />
              YouTube Music
            </span>
            {hasOfficialVideo ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-950/30 px-2.5 py-0.5 text-[10px] font-medium text-cyan-300">
                <Sparkles className="h-3 w-3 text-cyan-400" />
                Official Music Video
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-green-500/30 bg-green-950/30 px-2.5 py-0.5 text-[10px] font-medium text-green-300">
                <Video className="h-3 w-3 text-green-400" />
                Video Mode Active
              </span>
            )}
          </div>

          {/* YouTube Music Native [ Song | Video ] Segmented Control */}
          <div className="flex items-center rounded-full bg-[#1e1e1e] p-1 border border-white/10 shadow-lg">
            <button
              onClick={() => handleToggleVideoMode(false)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                !isVideoMode
                  ? 'bg-white text-black shadow-md'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              <Music className="h-3.5 w-3.5" />
              Song
            </button>
            <button
              onClick={() => handleToggleVideoMode(true)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                isVideoMode
                  ? 'bg-red-600 text-white shadow-md'
                  : 'text-white/70 hover:text-white'
              }`}
              title={!isHost ? 'Only host can toggle Video Mode' : 'Switch to Video Mode'}
            >
              <Film className="h-3.5 w-3.5" />
              Video
            </button>
          </div>
        </div>

        {/* Central Viewport Box */}
        <div className="jukebox-arch-frame relative w-full overflow-hidden px-4 pb-6 pt-6 sm:px-8 lg:px-10">
          <div className="absolute left-1/2 top-3 h-2.5 w-36 -translate-x-1/2 rounded-full jukebox-tube-gold" />

          {/* Active Cinema / Jukebox Viewport */}
          <div className="relative mx-auto mt-2 w-full max-w-[640px]">
            <motion.div
              className="absolute -inset-4 rounded-[2.5rem] opacity-35 blur-2xl"
              animate={{
                scale: [1, 1.04, 1],
                opacity: [0.25, 0.42, 0.25],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              style={{ backgroundColor: accentColor }}
            />

            <div
              className="relative aspect-video w-full overflow-hidden rounded-3xl border border-jukebox-gold/50 bg-black shadow-2xl"
              style={{
                boxShadow: `0 0 38px var(--player-glow), 0 0 80px rgba(0,0,0,0.8)`,
              }}
            >
              {/* YouTube IFrame Player Container (Unmanaged ref node so React reconciler never destroys it) */}
              <div
                ref={playerContainerRef}
                className="absolute inset-0 w-full h-full z-10 pointer-events-auto"
              />

              {/* Waiting for Selection State (When queue is completely empty) */}
              {!currentTrack && (
                <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/95 p-6 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full jukebox-chrome-button">
                    <Music className="h-8 w-8 text-jukebox-black" />
                  </div>
                  <p className="font-button mt-4 text-[10px] font-black uppercase tracking-[0.3em] text-jukebox-gold">
                    Waiting for Selection
                  </p>
                  <h3 className="font-heading mt-2 text-xl font-bold uppercase text-jukebox-cream">
                    Choose a Song Above
                  </h3>
                  <p className="font-body mt-2 text-xs text-jukebox-cream/60 max-w-xs">
                    Search YouTube Music above. Click any song to start video & music immediately!
                  </p>
                </div>
              )}

              {/* YouTube Music Song Mode: High-Res Square Album Art View Overlay */}
              <AnimatePresence>
                {currentTrack && !isVideoMode && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="absolute inset-0 z-20 flex flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-[#181818]/90 via-[#121212]/95 to-[#0a0a0a] cursor-pointer"
                    onClick={() => handleToggleVideoMode(true)}
                    title="Click to switch to Video Mode"
                  >
                    {/* Subtle Blurred Background Glow */}
                    <img
                      src={thumbnailUrl}
                      alt={currentTrack.title}
                      className="absolute inset-0 h-full w-full object-cover opacity-20 blur-xl scale-110"
                    />

                    {/* Centered Square Artwork (YouTube Music Native Look) */}
                    <div className="relative z-10 flex flex-col items-center">
                      <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.3 }}
                        className="relative h-44 w-44 sm:h-56 sm:w-56 md:h-64 md:w-64 overflow-hidden rounded-2xl shadow-2xl border border-white/10 ring-1 ring-white/10 group"
                      >
                        <img
                          src={thumbnailUrl}
                          alt={currentTrack.title}
                          className="h-full w-full object-cover"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-600 text-white text-xs font-bold shadow-lg">
                            <Film className="h-3.5 w-3.5" /> Watch Video
                          </span>
                        </div>
                      </motion.div>

                      <div className="mt-3 text-center px-4 max-w-sm">
                        <h4 className="font-heading truncate text-base font-bold text-white">
                          {currentTrack.title}
                        </h4>
                        <p className="font-body truncate text-xs text-white/60">
                          {currentTrack.artist}
                        </p>
                      </div>
                    </div>

                    {/* Mode Badge */}
                    <div className="absolute bottom-3 left-4 z-20 flex items-center gap-1.5 rounded-full border border-jukebox-gold/30 bg-black/70 px-3 py-1 backdrop-blur-md">
                      <Music className="h-3.5 w-3.5 text-jukebox-gold" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-jukebox-gold">
                        Song Mode (YouTube Music)
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Track Details & Bottom Info */}
          <div className="mt-5 text-center">
            <h3 className="font-heading truncate text-xl font-black uppercase heading-tracking text-jukebox-cream sm:text-2xl">
              {currentTrack?.title || 'No Track Selected'}
            </h3>
            <p className="font-body mt-1 text-sm font-semibold text-jukebox-cream/70 sm:text-base">
              {currentTrack?.artist || 'Search songs above to begin playback'}
            </p>
          </div>

          {/* Interactive Progress Bar */}
          <div className="mt-4 px-2 sm:px-6">
            <div
              ref={progressRef}
              onClick={handleSeek}
              onMouseMove={handleSeekHover}
              onMouseLeave={() => setSeekHover(null)}
              className="group relative h-3.5 cursor-pointer rounded-full jukebox-progress-track"
              title={isHost ? 'Click to seek' : 'Only host can seek'}
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

              {seekHover !== null && duration > 0 && (
                <div
                  className="font-button absolute -top-8 -translate-x-1/2 rounded bg-black/90 px-2 py-0.5 text-[10px] font-bold text-jukebox-cream border border-jukebox-gold/30 pointer-events-none"
                  style={{ left: `${(seekHover / duration) * 100}%` }}
                >
                  {formatTime(seekHover)}
                </div>
              )}
            </div>

            <div className="font-button mt-2 flex items-center justify-between text-xs font-black tracking-widest text-jukebox-cream/60">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Quick Player Controls (Mobile / In-Panel) */}
          <div className="mt-4 flex items-center justify-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrevious}
              disabled={!isHost}
              className="h-10 w-10 rounded-full border border-jukebox-gold/20 bg-black/40 text-jukebox-gold hover:bg-jukebox-gold/10 hover:text-jukebox-cream disabled:opacity-30"
              title="Previous Song"
            >
              <SkipBack className="h-5 w-5" />
            </Button>

            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={handlePlayPause}
              className="jukebox-chrome-button flex h-14 w-14 items-center justify-center rounded-full shadow-lg cursor-pointer"
            >
              {isPlaying ? (
                <Pause className="h-6 w-6 text-jukebox-black" />
              ) : (
                <Play className="ml-0.5 h-6 w-6 text-jukebox-black" />
              )}
            </motion.button>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleSkip}
              disabled={!isHost}
              className="h-10 w-10 rounded-full border border-jukebox-gold/20 bg-black/40 text-jukebox-gold hover:bg-jukebox-gold/10 hover:text-jukebox-cream disabled:opacity-30"
              title="Next Song"
            >
              <SkipForward className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
