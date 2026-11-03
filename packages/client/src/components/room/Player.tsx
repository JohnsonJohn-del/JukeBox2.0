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
  Tv,
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
    // Error 101 or 150 = embedding restricted by owner
    if (errorCode === 101 || errorCode === 150) {
      toast.error('Music video embedding restricted by copyright holder. Switching back to Audio Mode.', {
        duration: 4000,
        icon: '⚠️',
      });
      if (currentTrack?.videoId) {
        setIsVideoMode(false);
        setVideoMode(false);
        currentActiveVideoIdRef.current = currentTrack.videoId;
        loadVideo(currentTrack.videoId, currentTime);
        play();
        if (isHost && room?.id) {
          socket.emit(SOCKET_EVENTS.TOGGLE_VIDEO_MODE, {
            roomId: room.id,
            isVideoMode: false,
            position: currentTime,
          });
        }
      }
    }
  }, [currentTrack, currentTime, isHost, room?.id, socket, setIsVideoMode, setVideoMode]);

  const {
    loadVideo,
    play,
    pause,
    seekTo,
    isReady,
    getCurrentTime,
    mute: mutePlayer,
    unMute: unMutePlayer,
  } = usePlayer('youtube-player-element', {
    onEnded: () => {
      if (!isHost) return;
      socket.emit(SOCKET_EVENTS.NEXT_TRACK, { roomId: room?.id });
    },
    onError: handlePlayerError,
  });

  const { colors } = useThemeColors(getThumbnailUrl(currentTrack) || null);

  // Switch video source when track or video mode changes
  const syncTrackVideoSource = useCallback((track: QueueItem | null, videoMode: boolean, startTime: number = 0) => {
    if (!track) return;

    const audioId = (track as any).videoId || (track as any).video_id;
    const musicVideoId = track.musicVideoId || null;
    const hasVideo = Boolean(track.hasVideo && musicVideoId);

    // If in video mode and counterpart exists, use music video; else use audio track
    const targetVideoId = videoMode && hasVideo ? musicVideoId! : audioId;

    if (!targetVideoId) return;

    if (currentActiveVideoIdRef.current !== targetVideoId) {
      currentActiveVideoIdRef.current = targetVideoId;
      loadVideo(targetVideoId, startTime);
      play();
    }
  }, [loadVideo, play]);

  // Synchronize with socket events
  useEffect(() => {
    function onPlaybackState(data: { state: string; position: number; track: QueueItem | null; isVideoMode?: boolean }) {
      setCurrentTime(data.position);
      if (data.track?.duration) setDuration(data.track.duration);
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
      if (track.duration) setDuration(track.duration);

      const targetId = isVideoMode && track.hasVideo && track.musicVideoId
        ? track.musicVideoId
        : ((track as any).videoId || (track as any).video_id);

      currentActiveVideoIdRef.current = targetId;
      loadVideo(targetId, 0);
      play();
    }

    function onVideoModeChanged(data: VideoModeChangedPayload) {
      setIsVideoMode(data.isVideoMode);
      setVideoMode(data.isVideoMode);

      if (currentTrack) {
        syncTrackVideoSource(currentTrack, data.isVideoMode, data.position || currentTime);
      }

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
    }) {
      const localTime = getCurrentTime();
      const drift = Math.abs(localTime - data.playbackPosition);

      if (drift > 2) seekTo(data.playbackPosition);

      setCurrentTime(data.playbackPosition);
      setPlaybackState(data.playbackState as 'playing' | 'paused' | 'stopped' | 'buffering');

      if (data.isVideoMode !== undefined) {
        setIsVideoMode(data.isVideoMode);
        setVideoMode(data.isVideoMode);
      }

      if (data.currentTrack) {
        syncTrackVideoSource(data.currentTrack, data.isVideoMode, data.playbackPosition);
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
    currentTrack,
    currentTime,
    syncTrackVideoSource,
  ]);

  const handleEnablePlayback = useCallback(() => {
    setUserInteracted(true);
    unMutePlayer();

    if (currentTrack) {
      const targetId = isVideoMode && currentTrack.hasVideo && currentTrack.musicVideoId
        ? currentTrack.musicVideoId
        : ((currentTrack as any).videoId || (currentTrack as any).video_id);

      if (targetId) {
        currentActiveVideoIdRef.current = targetId;
        loadVideo(targetId, currentTime);
        play();
      }
    }

    if (isHost && room?.id) {
      socket.emit(SOCKET_EVENTS.PLAY, { roomId: room.id, position: currentTime || 0 });
    }
  }, [currentTrack, isVideoMode, loadVideo, play, currentTime, unMutePlayer, isHost, room?.id, socket]);

  const handlePlayPause = useCallback(() => {
    if (!userInteracted) {
      handleEnablePlayback();
      return;
    }

    if (playbackState === 'playing') {
      pause();
      socket.emit(SOCKET_EVENTS.PAUSE, { roomId: room?.id, position: currentTime });
    } else {
      unMutePlayer();
      play();
      socket.emit(SOCKET_EVENTS.PLAY, { roomId: room?.id, position: currentTime });
    }
  }, [playbackState, pause, play, socket, room?.id, currentTime, userInteracted, handleEnablePlayback, unMutePlayer]);

  const handleToggleVideoMode = useCallback(() => {
    if (!currentTrack) return;

    if (!isHost) {
      toast('Only the room host can switch between Audio and Video mode', {
        icon: '🔒',
      });
      return;
    }

    const hasVideo = Boolean(currentTrack.hasVideo && currentTrack.musicVideoId);

    if (!isVideoMode && !hasVideo) {
      toast.error('Official music video counterpart is not available on YouTube Music for this track.', {
        duration: 3500,
      });
      return;
    }

    const nextMode = !isVideoMode;
    setIsVideoMode(nextMode);
    setVideoMode(nextMode);

    syncTrackVideoSource(currentTrack, nextMode, currentTime);

    socket.emit(SOCKET_EVENTS.TOGGLE_VIDEO_MODE, {
      roomId: room?.id,
      isVideoMode: nextMode,
      position: currentTime,
    });
  }, [currentTrack, isHost, isVideoMode, currentTime, setIsVideoMode, setVideoMode, syncTrackVideoSource, socket, room?.id]);

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
  const trackHasVideoCounterpart = Boolean(currentTrack?.hasVideo && currentTrack?.musicVideoId);

  if (!currentTrack) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex h-full w-full items-center justify-center p-4"
      >
        <div className="jukebox-panel relative flex w-full max-w-2xl flex-col items-center overflow-hidden rounded-3xl p-10 text-center">
          <div className="absolute inset-x-10 top-0 h-1 rounded-full jukebox-tube-red" />

          <div className="flex h-28 w-28 items-center justify-center rounded-full jukebox-chrome-button">
            <Music className="h-12 w-12 text-jukebox-black" />
          </div>

          <p className="font-button mt-6 text-[10px] font-black uppercase tracking-[0.32em] dark:text-jukebox-gold/75 text-jukebox-brass">
            Waiting for Selection
          </p>

          <h2 className="font-heading mt-3 text-3xl font-black uppercase heading-tracking text-jukebox-cream">
            Insert a Song
          </h2>

          <p className="font-body mt-3 max-w-sm text-lg leading-6 text-jukebox-cream/55">
            Search YouTube Music to queue official tracks. Seamlessly switch between Album Art and Official Music Videos!
          </p>
        </div>
      </motion.div>
    );
  }

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

      {!userInteracted && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 z-50 flex cursor-pointer items-center justify-center bg-black/80 p-4 backdrop-blur-md"
          onClick={handleEnablePlayback}
        >
          <motion.div
            whileTap={{ scale: 0.94 }}
            className="jukebox-panel flex max-w-sm flex-col items-center rounded-3xl p-7 text-center border border-jukebox-gold/40 shadow-2xl"
          >
            <div className="flex h-20 w-20 items-center justify-center rounded-full jukebox-chrome-button shadow-lg shadow-jukebox-gold/30">
              <Play className="ml-1 h-9 w-9 text-jukebox-black" />
            </div>

            <p className="font-button mt-5 text-[10px] font-black uppercase tracking-[0.3em] text-jukebox-gold">
              Power On Jukebox
            </p>

            <h3 className="font-heading mt-2 text-xl font-black uppercase heading-tracking text-jukebox-cream">
              Tap to Start Playback
            </h3>

            <p className="font-body mt-2 text-sm leading-5 text-jukebox-cream/65">
              Browser audio policies require one tap to unlock synchronized streaming.
            </p>
          </motion.div>
        </motion.div>
      )}

      <div className="relative flex w-full max-w-[800px] flex-col items-center">
        {/* Native YouTube Music [ Song | Video ] Toggle Pill Bar */}
        <div className="mb-4 flex flex-col sm:flex-row items-center justify-between gap-3 w-full max-w-[640px] px-2">
          <div className="flex items-center gap-2">
            <span className="flex h-6 items-center gap-1.5 rounded-full border border-red-500/40 bg-red-950/40 px-2.5 text-[10px] font-bold uppercase tracking-wider text-red-400">
              <Film className="h-3 w-3 text-red-500" />
              YouTube Music
            </span>
            {trackHasVideoCounterpart ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-950/30 px-2.5 py-0.5 text-[10px] font-medium text-cyan-300">
                <Sparkles className="h-3 w-3 text-cyan-400" />
                Music Video Available
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-yellow-500/20 bg-yellow-950/20 px-2.5 py-0.5 text-[10px] font-medium text-yellow-300/70">
                Official Audio Only
              </span>
            )}
          </div>

          {/* YouTube Music Native [ Song | Video ] Segmented Control */}
          <div className="flex items-center rounded-full bg-[#1e1e1e] p-1 border border-white/10 shadow-lg">
            <button
              onClick={() => isVideoMode && handleToggleVideoMode()}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                !isVideoMode
                  ? 'bg-white text-black shadow-md'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              <Music className="h-3.5 w-3.5" />
              Song
            </button>
            <button
              onClick={() => !isVideoMode && handleToggleVideoMode()}
              disabled={!trackHasVideoCounterpart && !isVideoMode}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                isVideoMode
                  ? 'bg-white text-black shadow-md'
                  : trackHasVideoCounterpart
                  ? 'text-white/70 hover:text-white cursor-pointer'
                  : 'text-white/25 cursor-not-allowed opacity-50'
              }`}
              title={
                !trackHasVideoCounterpart
                  ? 'No official video counterpart available on YouTube Music'
                  : !isHost
                  ? 'Only host can toggle Video Mode'
                  : 'Switch to Official Music Video'
              }
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
              {/* YouTube IFrame Player Container (Visible in Video Mode) */}
              <div
                className={`w-full h-full transition-opacity duration-300 ${
                  isVideoMode ? 'opacity-100 z-20 relative' : 'opacity-0 pointer-events-none absolute inset-0 -z-10'
                }`}
              >
                <div id="youtube-player-element" className="w-full h-full" />
              </div>

              {/* YouTube Music Song Mode: High-Res Square Album Art View */}
              {!isVideoMode && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-[#181818]/60 via-[#121212]/90 to-[#0a0a0a]">
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
                      className="relative h-44 w-44 sm:h-56 sm:w-56 md:h-64 md:w-64 overflow-hidden rounded-2xl shadow-2xl border border-white/10 ring-1 ring-white/10"
                    >
                      <img
                        src={thumbnailUrl}
                        alt={currentTrack.title}
                        className="h-full w-full object-cover"
                      />
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
                </div>
              )}
            </div>
          </div>

          {/* Track Details & Bottom Info */}
          <div className="mt-5 text-center">
            <h3 className="font-heading truncate text-xl font-black uppercase heading-tracking text-jukebox-cream sm:text-2xl">
              {currentTrack.title}
            </h3>
            <p className="font-body mt-1 text-sm font-semibold text-jukebox-cream/70 sm:text-base">
              {currentTrack.artist}
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
              className="jukebox-chrome-button flex h-14 w-14 items-center justify-center rounded-full shadow-lg"
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
