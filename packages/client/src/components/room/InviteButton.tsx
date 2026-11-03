'use client';

import { useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Copy, Share2, QrCode } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRoomStore } from '@/store/roomStore';
import { APP_URL } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { QRCodeModal } from './QRCodeModal';

export function InviteButton({ className }: { className?: string }) {
  const { room } = useRoomStore();
  const [copied, setCopied] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);

  const inviteUrl = useMemo(() => {
    if (!room?.roomCode) return '';
    const base = typeof window !== 'undefined' && window.location.origin ? window.location.origin : APP_URL;
    return `${base}/join/${room.roomCode}`;
  }, [room?.roomCode]);

  const handleCopy = useCallback(async () => {
    if (!inviteUrl) return;

    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      toast.success('Invite link copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy link');
    }
  }, [inviteUrl]);

  const handleShare = useCallback(async () => {
    if (!inviteUrl) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join my Jukebox room!',
          text: `Join room ${room?.roomCode} on Jukebox!`,
          url: inviteUrl,
        });
      } catch {
        // user cancelled
      }
    } else {
      handleCopy();
    }
  }, [inviteUrl, handleCopy, room?.roomCode]);

  if (!room) return null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={cn('flex flex-col items-start gap-2', className)}
      >
        <div className="jukebox-display rounded-xl px-4 py-2 text-left">
          <p className="font-button text-[8px] font-black uppercase tracking-[0.24em] dark:text-jukebox-gold/65 text-jukebox-brass">
            Room Code
          </p>

          <p className="font-roomcode roomcode-tracking text-3xl leading-none text-jukebox-cream">
            {room.roomCode}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => setShowQRModal(true)}
            variant="outline"
            size="sm"
            className="font-button h-8 rounded-lg border-jukebox-gold/30 bg-jukebox-gold/15 px-3 text-xs text-jukebox-gold hover:bg-jukebox-gold/25"
          >
            <QrCode className="mr-1.5 h-3.5 w-3.5" />
            QR Code
          </Button>

          <Button
            onClick={handleCopy}
            variant="outline"
            size="sm"
            className={cn(
              'font-button h-8 rounded-lg border-jukebox-gold/20 bg-black/35 px-3 text-xs text-jukebox-cream/75 hover:bg-jukebox-gold/10 hover:text-jukebox-cream',
              copied && 'border-green-500/50 bg-green-500/10 text-green-400',
            )}
          >
            <Copy className="mr-1.5 h-3.5 w-3.5" />
            {copied ? 'Copied!' : 'Copy Link'}
          </Button>

          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <Button
              onClick={handleShare}
              variant="outline"
              size="sm"
              className="font-button h-8 rounded-lg border-jukebox-gold/20 bg-black/35 px-3 text-xs text-jukebox-cream/75 hover:bg-jukebox-gold/10 hover:text-jukebox-cream"
            >
              <Share2 className="mr-1.5 h-3.5 w-3.5" />
              Share
            </Button>
          )}
        </div>
      </motion.div>

      <QRCodeModal
        isOpen={showQRModal}
        onClose={() => setShowQRModal(false)}
        roomCode={room.roomCode}
        roomName={room.name}
        inviteUrl={inviteUrl}
      />
    </>
  );
}
