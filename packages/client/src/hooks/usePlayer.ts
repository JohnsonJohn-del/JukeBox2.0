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
    setPlayerControls,
  } = usePlayerStore();

  useEffect(() => {
    let mounted = true;

    async function initializePlayer() {
      try {
        await loadYouTubeAPI();

        if (!mounted) return;

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

        const container = document.getElementById(containerId);
        if (!container) {
          console.warn('[usePlayer] Element not found:', containerId);
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
              if (!mounted) return;

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
              if (!mounted) return;

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
    }

    function loadPendingVideo(p: YT.Player) {
      if (!pendingVideoRef.current) return;
      const { videoId, startSeconds, autoPlay } = pendingVideoRef.current;
      pendingVideoRef.current = null;

      try {
        p.loadVideoById({
          videoId,
          startSeconds: Math.floor(startSeconds),
        });
        if (autoPlay) {
          p.playVideo();
        }
      } catch (err) {
        console.error('[usePlayer] Error loading pending video:', err);
      }
    }

    function startSyncInterval(target: YT.Player) {
      if (intervalRef.current) clearInterval(intervalRef.current);

      intervalRef.current = setInterval(() => {
        const p = playerRef.current || target || window.ytPlayer;
        let readFromPlayer = false;

        if (p) {
          try {
            if (typeof p.getCurrentTime === 'function') {
              const time = p.getCurrentTime();
              if (typeof time === 'number' && !isNaN(time) && time > 0) {
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
    }

    initializePlayer();

    return () => {
      mounted = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [containerId, setCurrentTime, setDuration, setPlaybackState]);

  const loadVideo = useCallback((videoId: string, startSeconds: number = 0) => {
    try {
      const p = playerRef.current || window.ytPlayer;
      if (p && typeof p.loadVideoById === 'function') {
        p.loadVideoById({
          videoId,
          startSeconds: Math.floor(startSeconds),
        });
      } else {
        pendingVideoRef.current = { videoId, startSeconds, autoPlay: true };
      }
    } catch (err) {
      console.error('[YouTube] loadVideo error:', err);
      pendingVideoRef.current = { videoId, startSeconds, autoPlay: true };
    }
  }, []);

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
      console.error('[YouTube] unmute error:', err);
    }
  }, []);

  const getCurrentTime = useCallback((): number => {
    try {
      const p = playerRef.current || window.ytPlayer;
      if (p && typeof p.getCurrentTime === 'function') {
        return p.getCurrentTime() || 0;
      }
    } catch {
      // ignore
    }
    return usePlayerStore.getState().currentTime;
  }, []);

  // Register controls to store so FooterPlayerControls can reuse without double initialization
  useEffect(() => {
    setPlayerControls({
      play,
      pause,
      seekTo,
      mute,
      unMute,
      loadVideo,
    });
  }, [play, pause, seekTo, mute, unMute, loadVideo, setPlayerControls]);

  return {
    loadVideo,
    play,
    pause,
    seekTo,
    isReady,
    getCurrentTime,
    mute,
    unMute,
  };
}
