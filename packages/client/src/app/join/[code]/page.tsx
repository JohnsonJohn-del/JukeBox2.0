'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  DoorOpen,
  ClipboardPaste,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Button,
  Input,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui';
import { roomService } from '@/services/room';
import { useAuthStore } from '@/store/authStore';

const ROOM_CODE_REGEX = /^[A-Z0-9]{6}$/;
const INVITE_URL_REGEX = /join\/([a-zA-Z0-9]{6})/i;
const NICKNAME_REGEX = /^[a-zA-Z0-9_ ]+$/;

export default function JoinRoomPage() {
  const params = useParams();
  const router = useRouter();
  const currentUser = useAuthStore((s) => s.user);

  const code = ((params.code as string) || '').toUpperCase();

  const [roomCode, setRoomCode] = useState(code);
  const [nickname, setNickname] = useState(currentUser?.username || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const cleanNickname = nickname.trim();

  const isRoomCodeValid = ROOM_CODE_REGEX.test(roomCode);

  const isNicknameValid =
    cleanNickname.length >= 2 && NICKNAME_REGEX.test(cleanNickname);

  const canSubmit = isRoomCodeValid && isNicknameValid && !loading;

  useEffect(() => {
    if (code) {
      setRoomCode(code);
    }
  }, [code]);

  const handleRoomCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    setRoomCode(value);

    if (error) {
      setError('');
    }
  };

  const handleNicknameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNickname(e.target.value);

    if (error) {
      setError('');
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const match = text.match(INVITE_URL_REGEX);

      if (match) {
        setRoomCode(match[1].toUpperCase());
        return;
      }

      const clean = text.toUpperCase().replace(/[^A-Z0-9]/g, '');

      if (clean.length === 6) {
        setRoomCode(clean);
      }
    } catch {
      const match = roomCode.match(INVITE_URL_REGEX);

      if (match) {
        setRoomCode(match[1].toUpperCase());
      }
    }
  };

  const handleJoin = async () => {
    if (!ROOM_CODE_REGEX.test(roomCode)) {
      setError('Room code must be exactly 6 characters');
      return;
    }

    if (cleanNickname.length < 2) {
      setError('Nickname must be at least 2 characters');
      return;
    }

    if (!NICKNAME_REGEX.test(cleanNickname)) {
      setError('Nickname can only contain letters, numbers, spaces, and underscores');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await roomService.joinRoom(roomCode, cleanNickname);
      if (res.token && res.user) {
        useAuthStore.getState().setGuest(cleanNickname, res.token, res.user.id);
      }
      toast.success(`Welcome to the room, ${cleanNickname}!`);
      router.push(`/room/${res.room.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join room');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden px-4">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -left-40 -top-40 h-[500px] w-[500px] animate-pulse rounded-full bg-blue-600/10 blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 h-[500px] w-[500px] animate-pulse rounded-full bg-cyan-600/10 blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-8"
        >
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <Card className="border-white/10 bg-white/5 backdrop-blur-xl">
            <CardHeader className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-600 shadow-lg shadow-blue-500/20"
              >
                <DoorOpen className="h-7 w-7 text-white" />
              </motion.div>

              <CardTitle className="text-2xl font-bold text-white">
                Join a Room
              </CardTitle>

              <CardDescription className="text-gray-400">
                {code ? 'You were invited! Enter a nickname to join.' : 'Enter the room code shared by the host'}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">
                  Room Code
                </label>

                <div className="relative">
                  <Input
                    placeholder="ABC123"
                    value={roomCode}
                    onChange={handleRoomCodeChange}
                    maxLength={6}
                    disabled={loading || Boolean(code)}
                    className="border-white/10 bg-white/5 text-center font-mono text-2xl tracking-[0.3em] text-white placeholder:text-gray-600"
                  />

                  {!code && (
                    <button
                      type="button"
                      onClick={handlePaste}
                      disabled={loading}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 transition-colors hover:text-white disabled:opacity-50"
                      title="Paste from clipboard"
                    >
                      <ClipboardPaste size={18} />
                    </button>
                  )}
                </div>

                {roomCode.length > 0 && !isRoomCodeValid && (
                  <p className="flex items-center gap-1 text-xs text-red-400">
                    <AlertCircle className="h-3 w-3" />
                    Code must be exactly 6 alphanumeric characters
                  </p>
                )}

                {isRoomCodeValid && (
                  <p className="flex items-center gap-1 text-xs text-green-400">
                    <CheckCircle2 className="h-3 w-3" />
                    Valid room code
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">
                  Nickname / Display Name
                </label>

                <Input
                  placeholder="e.g. NeonDancer"
                  value={nickname}
                  onChange={handleNicknameChange}
                  maxLength={20}
                  minLength={2}
                  required
                  disabled={loading}
                  className="border-white/10 bg-white/5 text-white placeholder:text-gray-500"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && canSubmit) {
                      handleJoin();
                    }
                  }}
                />

                {nickname.length > 0 && cleanNickname.length < 2 && (
                  <p className="text-xs text-red-400">
                    Nickname must be at least 2 characters
                  </p>
                )}

                {nickname.length > 0 && !NICKNAME_REGEX.test(cleanNickname) && (
                  <p className="text-xs text-red-400">
                    Letters, numbers, spaces, and underscores only
                  </p>
                )}
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </CardContent>

            <CardFooter className="flex flex-col gap-3">
              <Button
                onClick={handleJoin}
                disabled={!canSubmit}
                className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-medium hover:from-blue-700 hover:to-cyan-700 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Joining Room...
                  </>
                ) : (
                  'Join Room'
                )}
              </Button>

              <p className="text-center text-xs text-gray-500">
                No sign-up needed. Guests get instant playback sync.
              </p>
            </CardFooter>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
