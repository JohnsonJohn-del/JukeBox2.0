'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { usePlayerStore } from '@/store/playerStore';

let youtubeAPILoadPromise: Promise<void> | null = null;

declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void;
    ytPlayer?: YT.Player | null;
  }
}

function loadYouTubeAPI(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();

  if (window.YT && window.YT.Player) {
    return Promise.resolve();
  }

  if (youtubeAPILoadPromise) {
    return youtubeAPILoadPromise;
  }

  youtubeAPILoadPromise = new Promise((resolve) => {
    const existingScript = document.querySelector(
      'script[src="https://www.youtube.com/iframe_api"]'
    );

    if (!existingScript) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.async = true;
      document.body.appendChild(tag);
    }

    const prevOnReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (prevOnReady) prevOnReady();
      resolve();
    };

    const checkYT = setInterval(() => {
      if (window.YT && window.YT.Player) {
        clearInterval(checkYT);
        resolve();
      }
    }, 100);
  });

  return youtubeAPILoadPromise;
}

export function usePlayer(
  containerId: string = 'youtube-player-element',
  options?: {
    onEnded?: () => void;
    onError?: (errorCode: number) => void;
  }
) {
  const playerRef = useRef<YT.Player | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingVideoRef = useRef<{ videoId: string; startSeconds: number; autoPlay?: boolean } | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const [isReady, setIsReady] = useState(false);

  const {
    setCurrentTime,
    setDuration,
    setPlaybackState,
  } = usePlayerStore();

  const loadPendingVideo = useCallback((p: YT.Player) => {
    if (!pendingVideoRef.current) return;
    const { videoId, startSeconds, autoPlay } = pendingVideoRef.current;
    pendingVideoRef.current = null;

    try {
      p.loadVideoById({
        videoId,
        startSeconds: Math.floor(startSeconds),
      });
      p.unMute?.();
      if (autoPlay) {
        p.playVideo?.();
      }
    } catch (err) {
      console.error('[usePlayer] Error loading pending video:', err);
    }
  }, []);

  const startSyncInterval = useCallback((target?: YT.Player) => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      const p = playerRef.current || target || window.ytPlayer;
      let readFromPlayer = false;

      if (p) {
        try {
          if (typeof p.getCurrentTime === 'function') {
            const time = p.getCurrentTime();
            if (typeof time === 'number' && !isNaN(time) && time >= 0) {
              setCurrentTime(time);
              readFromPlayer = true;
            }
          }

          if (typeof p.getDuration === 'function') {
            const dur = p.getDuration();
            if (typeof dur === 'number' && !isNaN(dur) && dur > 0) {
              setDuration(dur);
            }
          }

          if (typeof p.getPlayerState === 'function') {
            const state = p.getPlayerState();
            if (state === window.YT?.PlayerState?.PLAYING) {
              if (usePlayerStore.getState().playbackState !== 'playing') {
                setPlaybackState('playing');
              }
            }
          }
        } catch {
          // ignore during video transitions
        }
      }

      // Active room timer fallback: If room playbackState is 'playing', smoothly advance seconds
      if (!readFromPlayer && usePlayerStore.getState().playbackState === 'playing') {
        const current = usePlayerStore.getState().currentTime;
        const maxDur = usePlayerStore.getState().duration;
        if (maxDur > 0 && current < maxDur) {
          setCurrentTime(current + 1);
        }
      }
    }, 1000);
  }, [setCurrentTime, setDuration, setPlaybackState]);

  const initializePlayer = useCallback(async () => {
    try {
      await loadYouTubeAPI();

      // If player already exists on window and is healthy
      if (window.ytPlayer && typeof window.ytPlayer.playVideo === 'function') {
        playerRef.current = window.ytPlayer;
        setIsReady(true);
        startSyncInterval(window.ytPlayer);
        if (pendingVideoRef.current) {
          loadPendingVideo(window.ytPlayer);
        }
        return;
      }

      // Poll up to 30 times (4.5s) for container to mount in DOM
      let attempts = 0;
      while (!document.getElementById(containerId) && attempts < 30) {
        await new Promise((r) => setTimeout(r, 150));
        attempts++;
      }

      const container = document.getElementById(containerId);
      if (!container) {
        console.warn('[usePlayer] Element not found after polling:', containerId);
        return;
      }

      const player = new window.YT.Player(containerId, {
        height: '100%',
        width: '100%',
        playerVars: {
          autoplay: 1,
          controls: 1,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          enablejsapi: 1,
          origin: typeof window !== 'undefined' ? window.location.origin : undefined,
        },
        events: {
          onReady: (event) => {
            playerRef.current = event.target;
            window.ytPlayer = event.target;
            setIsReady(true);

            console.log('[YouTube] Player ready on container:', containerId);
            startSyncInterval(event.target);

            if (pendingVideoRef.current) {
              loadPendingVideo(event.target);
            }
          },

          onStateChange: (event) => {
            switch (event.data) {
              case window.YT.PlayerState.PLAYING:
                setPlaybackState('playing');
                break;

              case window.YT.PlayerState.PAUSED:
                setPlaybackState('paused');
                break;

              case window.YT.PlayerState.BUFFERING:
                setPlaybackState('buffering');
                break;

              case window.YT.PlayerState.ENDED:
                setPlaybackState('stopped');
                optionsRef.current?.onEnded?.();
                break;

              default:
                break;
            }
          },

          onError: (error) => {
            const code = typeof error.data === 'number' ? error.data : -1;
            console.error('[YouTube] Player error code:', code);
            optionsRef.current?.onError?.(code);
          },
        },
      });

      playerRef.current = player;
      window.ytPlayer = player;
    } catch (err) {
      console.error('[usePlayer] Initialization failed:', err);
    }
  }, [containerId, loadPendingVideo, setPlaybackState, startSyncInterval]);

  useEffect(() => {
    initializePlayer();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [initializePlayer]);

  const loadVideo = useCallback((videoId: string, startSeconds: number = 0) => {
    try {
      const p = playerRef.current || window.ytPlayer;
      if (p && typeof p.loadVideoById === 'function') {
        p.loadVideoById({
          videoId,
          startSeconds: Math.floor(startSeconds),
        });
        p.unMute?.();
        p.playVideo?.();
      } else {
        pendingVideoRef.current = { videoId, startSeconds, autoPlay: true };
        initializePlayer();
      }
    } catch (err) {
      console.error('[YouTube] loadVideo error:', err);
      pendingVideoRef.current = { videoId, startSeconds, autoPlay: true };
    }
  }, [initializePlayer]);

  const play = useCallback(() => {
    try {
      const p = playerRef.current || window.ytPlayer;
      p?.unMute?.();
      p?.playVideo?.();
    } catch (err) {
      console.error('[YouTube] play error:', err);
    }
  }, []);

  const pause = useCallback(() => {
    try {
      const p = playerRef.current || window.ytPlayer;
      p?.pauseVideo?.();
    } catch (err) {
      console.error('[YouTube] pause error:', err);
    }
  }, []);

  const seekTo = useCallback((seconds: number) => {
    try {
      const p = playerRef.current || window.ytPlayer;
      p?.seekTo?.(seconds, true);
    } catch (err) {
      console.error('[YouTube] seek error:', err);
    }
  }, []);

  const mute = useCallback(() => {
    try {
      const p = playerRef.current || window.ytPlayer;
      p?.mute?.();
    } catch (err) {
      console.error('[YouTube] mute error:', err);
    }
  }, []);

  const unMute = useCallback(() => {
    try {
      const p = playerRef.current || window.ytPlayer;
      p?.unMute?.();
    } catch (err) {
      console.error('[YouTube] unMute error:', err);
    }
  }, []);

  const getCurrentTime = useCallback((): number => {
    try {
      const p = playerRef.current || window.ytPlayer;
      return p?.getCurrentTime?.() ?? 0;
    } catch {
      return 0;
    }
  }, []);

  const getDuration = useCallback((): number => {
    try {
      const p = playerRef.current || window.ytPlayer;
      return p?.getDuration?.() ?? 0;
    } catch {
      return 0;
    }
  }, []);

  return {
    loadVideo,
    play,
    pause,
    seekTo,
    mute,
    unMute,
    isReady,
    getCurrentTime,
    getDuration,
  };
}
