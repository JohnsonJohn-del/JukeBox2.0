'use client';

import { useEffect, useState, useCallback, type CSSProperties } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { LogOut, AlertCircle, Music, Wifi, WifiOff, Radio } from 'lucide-react';
import { useSocket } from '@/hooks/useSocket';
import { useRoom } from '@/hooks/useRoom';
import { useQueue } from '@/hooks/useQueue';
import { useAuthStore } from '@/store/authStore';
import { useRoomStore } from '@/store/roomStore';
import { useQueueStore } from '@/store/queueStore';
import { usePlayerStore } from '@/store/playerStore';
import { useThemeStore } from '@/store/themeStore';
import { useThemeColors } from '@/hooks/useThemeColors';
import { roomService } from '@/services/room';
import { socket } from '@/sockets';
import { SOCKET_EVENTS } from '@/sockets/events';
import {
  Player,
  Queue,
  SearchBar,
  NowPlaying,
  MemberList,
  HostControls,
  InviteButton,
} from '@/components/room';
import { FooterPlayerControls } from '@/components/room/FooterPlayerControls';
import { Button } from '@/components/ui';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, getThumbnailUrl } from '@/lib/utils';

type PageState = 'loading' | 'error' | 'not-found' | 'ready';

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.id as string;

  const user = useAuthStore((s) => s.user);
  const { disconnect, isConnected } = useSocket();

  const {
    room,
    isHost,
    setRoom,
    setMembers,
    setIsHost,
    leaveRoom: leaveRoomStore,
  } = useRoomStore();

  const { queue, currentTrack } = useQueueStore();

  const { primaryColor, secondaryColor, accentColor, backgroundColor, surfaceColor, setColors } =
    useThemeStore();

  const [pageState, setPageState] = useState<PageState>('loading');
  const [pageError, setPageError] = useState('');
  const [showMobileQueue, setShowMobileQueue] = useState(false);
  const [socketError, setSocketError] = useState<string | null>(null);

  const { colors: themeColors } = useThemeColors(getThumbnailUrl(currentTrack));

  const roomHook = useRoom(roomId);
  useQueue();

  useEffect(() => {
    function onSocketError(data: { message: string; code?: string }) {
      setSocketError(data.message);
    }

    socket.on(SOCKET_EVENTS.ERROR, onSocketError);

    return () => {
      socket.off(SOCKET_EVENTS.ERROR, onSocketError);
    };
  }, []);

  useEffect(() => {
    if (!roomId) return;

    let cancelled = false;

    async function fetchRoom() {
      try {
        const data = await roomService.getRoom(roomId);

        if (cancelled) return;

        setRoom(data.room);
        setMembers(data.members);

        if (data.queue) {
          useQueueStore.getState().setQueue(data.queue);
        }

        if (data.playback) {
          if (data.playback.currentTrack) {
            useQueueStore.getState().setCurrentTrack(data.playback.currentTrack);
            if (data.playback.currentTrack.duration) {
              usePlayerStore.getState().setDuration(data.playback.currentTrack.duration);
            }
          }
          if (data.playback.playbackState) {
            usePlayerStore.getState().setPlaybackState(data.playback.playbackState);
          }
          if (typeof data.playback.playbackPosition === 'number') {
            usePlayerStore.getState().setCurrentTime(data.playback.playbackPosition);
          }
          if (data.playback.isVideoMode !== undefined) {
            usePlayerStore.getState().setIsVideoMode(data.playback.isVideoMode);
            useRoomStore.getState().setVideoMode(data.playback.isVideoMode);
          }
        }

        const myMember = data.members.find((member: any) =>
          member.userId === user?.id ||
          member.user_id === user?.id
        );

        const isRoomHost = Boolean((myMember as any)?.isHost || (myMember as any)?.is_host || (data.room as any)?.hostId === user?.id || (data.room as any)?.host_id === user?.id); setIsHost(isRoomHost);
        setPageState('ready');
      } catch (err) {
        if (cancelled) return;

        const msg = err instanceof Error ? err.message : '';

        if (msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('404')) {
          setPageState('not-found');
        } else {
          setPageState('error');
          setPageError(msg || 'Failed to load room');
        }
      }
    }

    fetchRoom();

    return () => {
      cancelled = true;
    };
  }, [roomId, setRoom, setMembers, setIsHost, user?.id]);

  useEffect(() => {
    function onRoomClosed() {
      leaveRoomStore();
      router.push('/');
    }

    socket.on(SOCKET_EVENTS.ROOM_CLOSED, onRoomClosed);

    return () => {
      socket.off(SOCKET_EVENTS.ROOM_CLOSED, onRoomClosed);
    };
  }, [router, leaveRoomStore]);

  const thumbnailUrl = getThumbnailUrl(currentTrack);

  useEffect(() => {
    if (thumbnailUrl) {
      setColors({
        primaryColor: themeColors.primary,
        secondaryColor: themeColors.secondary,
        accentColor: themeColors.accent,
        backgroundColor: themeColors.background,
        surfaceColor: themeColors.surface,
      });
    }
  }, [themeColors, thumbnailUrl, setColors]);

  const handleLeaveRoom = useCallback(() => {
    roomHook.leaveRoom();
    disconnect();
    router.push('/');
  }, [roomHook, disconnect, router]);

  const handleRetry = useCallback(() => {
    setPageState('loading');
    setPageError('');

    roomService
      .getRoom(roomId)
      .then((data) => {
        setRoom(data.room);
        setMembers(data.members);

        if (data.queue) {
          useQueueStore.getState().setQueue(data.queue);
        }

        if (data.playback) {
          if (data.playback.currentTrack) {
            useQueueStore.getState().setCurrentTrack(data.playback.currentTrack);
            if (data.playback.currentTrack.duration) {
              usePlayerStore.getState().setDuration(data.playback.currentTrack.duration);
            }
          }
          if (data.playback.playbackState) {
            usePlayerStore.getState().setPlaybackState(data.playback.playbackState);
          }
          if (typeof data.playback.playbackPosition === 'number') {
            usePlayerStore.getState().setCurrentTime(data.playback.playbackPosition);
          }
          if (data.playback.isVideoMode !== undefined) {
            usePlayerStore.getState().setIsVideoMode(data.playback.isVideoMode);
            useRoomStore.getState().setVideoMode(data.playback.isVideoMode);
          }
        }

        const myMember = data.members.find((member: any) =>
          member.userId === user?.id ||
          member.user_id === user?.id
        );

        const isRoomHost = Boolean((myMember as any)?.isHost || (myMember as any)?.is_host || (data.room as any)?.hostId === user?.id || (data.room as any)?.host_id === user?.id); setIsHost(isRoomHost);
        setPageState('ready');
      })
      .catch((err) => {
        setPageState('error');
        setPageError(err instanceof Error ? err.message : 'Failed to load room');
      });
  }, [roomId, setRoom, setMembers, setIsHost, user?.id]);

  if (pageState === 'loading') {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center jukebox-bg px-4">
        <div className="flex flex-col items-center gap-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
            className="flex h-20 w-20 items-center justify-center rounded-full jukebox-chrome-button"
          >
            <Music className="h-9 w-9 text-jukebox-black" />
          </motion.div>

          <div className="flex flex-col items-center gap-1 text-center">
            <p className="font-button text-[10px] font-black uppercase tracking-[0.32em] text-jukebox-gold/80">
              Room Selector
            </p>
            <p className="font-heading text-xl font-black uppercase heading-tracking text-jukebox-cream">
              Joining Room
            </p>
            <p className="font-body text-base text-jukebox-cream/55">
              Connecting to the listening party
            </p>
          </div>

          <div className="mt-4 flex flex-col gap-3">
            <Skeleton className="h-64 w-80 rounded-3xl bg-jukebox-gold/10 sm:w-96" />
            <Skeleton className="h-12 w-80 rounded-xl bg-jukebox-gold/10 sm:w-96" />
            <Skeleton className="h-8 w-80 rounded-xl bg-jukebox-gold/10 sm:w-96" />
          </div>
        </div>
      </div>
    );
  }

  if (pageState === 'not-found' || pageState === 'error') {
    const isNotFound = pageState === 'not-found';

    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center jukebox-bg px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="jukebox-panel flex max-w-md flex-col items-center gap-6 rounded-3xl p-8 text-center"
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-full border border-jukebox-red-bright/40 bg-jukebox-red/10 shadow-jukebox-red">
            <AlertCircle className="h-10 w-10 text-jukebox-red-bright" />
          </div>

          <div>
            <p className="font-button text-[10px] font-black uppercase tracking-[0.32em] text-jukebox-gold/70">
              Jukebox Error
            </p>
            <h2 className="font-heading mt-2 text-2xl font-black uppercase heading-tracking text-jukebox-cream">
              {isNotFound ? 'Room Not Found' : 'Something Went Wrong'}
            </h2>
            <p className="font-body mt-3 text-base leading-6 text-jukebox-cream/55">
              {isNotFound
                ? "This room doesn't exist or has been closed."
                : pageError || 'Unable to load the room.'}
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={isNotFound ? () => router.push('/') : handleRetry}
              className="jukebox-chrome-button font-button rounded-full font-black uppercase button-tracking"
            >
              {isNotFound ? 'Go Home' : 'Try Again'}
            </Button>

            <Button
              variant="outline"
              onClick={isNotFound ? handleRetry : () => router.push('/')}
              className="font-button rounded-full border-jukebox-cyan/40 bg-black/30 text-jukebox-cyan hover:bg-jukebox-cyan/10 hover:text-jukebox-cream"
            >
              {isNotFound ? 'Try Again' : 'Go Home'}
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div
      className="relative min-h-[calc(100vh-4rem)] overflow-hidden transition-colors duration-700 jukebox-bg"
      style={
        {
          '--room-primary': primaryColor,
          '--room-secondary': secondaryColor,
          '--room-accent': accentColor,
          '--room-bg': backgroundColor,
          '--room-surface': surfaceColor,
        } as CSSProperties
      }
    >
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute left-1/2 top-1/2 h-[680px] w-[680px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[150px]"
          style={{ backgroundColor: `${primaryColor || '#d6a84f'}20` }}
        />
        <div className="absolute inset-0 opacity-[0.05] jukebox-wood-bg" />
      </div>

      {/* DESKTOP LAYOUT */}
      <div className="relative z-10 hidden h-[calc(100vh-4rem)] grid-cols-[minmax(0,1fr)_400px] gap-4 p-4 lg:grid xl:grid-cols-[minmax(0,1fr)_430px]">
        <section className="flex min-h-0 flex-col overflow-hidden rounded-3xl border border-jukebox-gold/25 bg-jukebox-black/35 shadow-jukebox-panel">
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
            <Player />
          </div>

          <footer className="jukebox-panel m-3 mt-0 shrink-0 rounded-2xl px-4 py-3">
            <div className="grid gap-3 xl:grid-cols-[200px_minmax(0,1fr)_auto] xl:items-center">
              <div className="flex items-center gap-3">
                {/* <div className="jukebox-display min-w-[150px] rounded-xl px-4 py-2">
                  <p className="font-button text-[8px] font-black uppercase tracking-[0.28em] text-jukebox-gold/65">
                    Room Code
                  </p>
                  <p className="font-roomcode roomcode-tracking text-3xl leading-none text-jukebox-cream">
                    {room?.roomCode ?? '------'}
                  </p>
                </div> */}

                <div className="flex flex-col gap-2">
                  <InviteButton />
                </div>
              </div>

              <div className="flex min-w-0 flex-1 items-center px-2">
                <FooterPlayerControls />
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <div className="jukebox-display flex items-center gap-2 rounded-full px-3 py-1.5">
                  {isConnected ? (
                    <Wifi className="h-3.5 w-3.5 text-green-400" />
                  ) : (
                    <WifiOff className="h-3.5 w-3.5 text-jukebox-red-bright" />
                  )}

                  <span
                    className={cn(
                      'font-button text-[10px] font-black uppercase tracking-wider',
                      isConnected ? 'text-green-400' : 'text-jukebox-red-bright',
                    )}
                  >
                    {isConnected ? 'Connected' : 'Disconnected'}
                  </span>

                  {socketError && (
                    <span className="ml-2 max-w-[180px] truncate text-[10px] font-semibold text-jukebox-red-bright">
                      {socketError}
                    </span>
                  )}
                </div>

                {isHost && (
                  <div className="flex items-center gap-2">
                    <HostControls />
                  </div>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLeaveRoom}
                  className="font-button gap-2 rounded-full border border-jukebox-red/25 bg-black/30 text-jukebox-red-bright/75 hover:bg-jukebox-red/10 hover:text-jukebox-red-bright"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="text-xs font-black uppercase tracking-wider">Leave</span>
                </Button>
              </div>
            </div>
          </footer>
        </section>

        <aside className="flex min-h-0 flex-col overflow-hidden rounded-3xl border border-jukebox-gold/30 bg-jukebox-black/55 shadow-jukebox-panel">
          <div className="shrink-0 border-b border-jukebox-gold/20 px-4 py-4">
            <SearchBar />
          </div>

          <div className="min-h-0 flex-1 overflow-hidden">
            <Queue />
          </div>

          <div className="max-h-[220px] shrink-0 border-t border-jukebox-gold/20">
            <MemberList />
          </div>
        </aside>
      </div>

      {/* MOBILE / TABLET LAYOUT */}
      <div className="relative z-10 flex min-h-[calc(100vh-4rem)] flex-col lg:hidden">
        <div className="sticky top-0 z-20 border-b border-jukebox-gold/25 bg-jukebox-black/90 px-3 py-2 backdrop-blur-2xl">
          <NowPlaying onExpand={() => setShowMobileQueue(!showMobileQueue)} />
        </div>

        <div className="flex-1 px-3 py-3">
          <Player />
        </div>

        <div className="sticky bottom-0 z-20 border-t border-jukebox-gold/25 bg-jukebox-black/95 backdrop-blur-2xl">
          <div className="px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="jukebox-display flex min-w-0 flex-1 items-center gap-2 rounded-full px-3 py-2">
                {isConnected ? (
                  <Wifi className="h-3 w-3 shrink-0 text-green-400" />
                ) : (
                  <WifiOff className="h-3 w-3 shrink-0 text-jukebox-red-bright" />
                )}

                <span className="font-button truncate text-[10px] font-black uppercase tracking-[0.2em] text-jukebox-gold/70">
                  {room?.roomCode ? `Room ${room.roomCode}` : 'Room'}
                </span>
              </div>

              <div className="flex max-w-full items-center gap-2 overflow-x-auto pb-1">
                <InviteButton />
                {isHost && <HostControls className="shrink-0" />}

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLeaveRoom}
                  className="h-8 shrink-0 gap-1 rounded-full border border-jukebox-red/25 bg-black/30 text-jukebox-red-bright/70 hover:bg-jukebox-red/10 hover:text-jukebox-red-bright"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span className="font-button text-xs">Leave</span>
                </Button>
              </div>
            </div>
          </div>

          <motion.div
            initial={false}
            animate={{ height: showMobileQueue ? 'auto' : 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden border-t border-jukebox-gold/20"
          >
            <div className="px-3 py-3">
              <SearchBar />
            </div>

            <div className="max-h-[42vh] overflow-y-auto">
              <Queue />
            </div>

            <div className="border-t border-jukebox-gold/20">
              <MemberList />
            </div>
          </motion.div>

          <button
            onClick={() => setShowMobileQueue(!showMobileQueue)}
            className="font-button flex w-full items-center justify-center gap-2 border-t border-jukebox-gold/20 py-3 text-[10px] font-black uppercase tracking-[0.28em] text-jukebox-gold/70 transition-colors hover:text-jukebox-cream"
          >
            <Radio className="h-3.5 w-3.5 text-jukebox-cyan/70" />
            {showMobileQueue ? 'Hide Selector' : `Show Selector (${queue.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}