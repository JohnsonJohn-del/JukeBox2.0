'use client';

import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import { X, Copy, Check, Download, QrCode, Music, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomCode: string;
  roomName?: string;
  inviteUrl: string;
}

export function QRCodeModal({
  isOpen,
  onClose,
  roomCode,
  roomName,
  inviteUrl,
}: QRCodeModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  if (!isOpen) return null;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedLink(true);
      toast.success('Invite link copied!');
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopiedCode(true);
      toast.success('Room code copied!');
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      toast.error('Failed to copy code');
    }
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      toast.error('Unable to generate download');
      return;
    }
    const pngUrl = canvas.toDataURL('image/png');
    const downloadLink = document.createElement('a');
    downloadLink.href = pngUrl;
    downloadLink.download = `Jukebox-Room-${roomCode}.png`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    toast.success('QR Code downloaded!');
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl border border-jukebox-gold/30 bg-gradient-to-b from-[#181512] to-[#0c0a09] p-6 text-center shadow-2xl shadow-jukebox-gold/10"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full p-1.5 text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Header */}
          <div className="mb-4">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-jukebox-gold to-jukebox-brass text-black shadow-lg shadow-jukebox-gold/20">
              <QrCode className="h-6 w-6" />
            </div>
            <h3 className="font-heading text-xl font-bold text-jukebox-cream">
              Scan to Join Party
            </h3>
            <p className="mt-1 text-xs text-jukebox-cream/70">
              {roomName ? `"${roomName}"` : 'Instant party access'} — no account required!
            </p>
          </div>

          {/* QR Code Canvas (High Contrast Container) */}
          <div className="relative mx-auto my-4 flex w-fit items-center justify-center rounded-2xl bg-white p-4 shadow-xl shadow-black/60">
            <QRCodeSVG
              value={inviteUrl}
              size={190}
              level="H"
              includeMargin={false}
              fgColor="#000000"
              bgColor="#ffffff"
            />
            {/* Hidden canvas for PNG export */}
            <div className="hidden">
              <QRCodeCanvas
                ref={canvasRef}
                value={inviteUrl}
                size={512}
                level="H"
                includeMargin={true}
              />
            </div>
          </div>

          {/* Room Code Quick Display */}
          <div className="my-3 rounded-xl border border-jukebox-gold/20 bg-black/40 p-3">
            <div className="flex items-center justify-between">
              <div className="text-left">
                <span className="text-[10px] font-bold uppercase tracking-wider text-jukebox-gold/80">
                  Room Code
                </span>
                <p className="font-mono text-2xl font-bold tracking-widest text-jukebox-cream">
                  {roomCode}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyCode}
                className="h-8 border-jukebox-gold/30 bg-jukebox-gold/10 text-xs text-jukebox-gold hover:bg-jukebox-gold/20"
              >
                {copiedCode ? <Check className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                {copiedCode ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2 mt-4">
            <Button
              onClick={handleCopyLink}
              className="w-full bg-gradient-to-r from-jukebox-gold to-jukebox-brass font-semibold text-black hover:brightness-110 shadow-lg shadow-jukebox-gold/20"
            >
              {copiedLink ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
              {copiedLink ? 'Link Copied to Clipboard!' : 'Copy Direct Join Link'}
            </Button>

            <Button
              variant="outline"
              onClick={handleDownload}
              className="w-full border-white/10 bg-white/5 text-xs text-jukebox-cream/80 hover:bg-white/10 hover:text-white"
            >
              <Download className="h-3.5 w-3.5 mr-2" />
              Download QR Code (PNG)
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
