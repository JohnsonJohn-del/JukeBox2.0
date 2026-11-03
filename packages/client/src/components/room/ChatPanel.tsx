'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Music, Sparkles, MessageSquare, ShieldCheck, Flame } from 'lucide-react';
import { useChat } from '@/hooks/useChat';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/types';

function formatMessageTime(isoString: string): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

// Check if a message looks like a song suggestion
function isSongSuggestion(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.startsWith('play ') ||
    lower.includes('play ') ||
    lower.includes('suggest') ||
    lower.includes('can we play') ||
    lower.includes('next song') ||
    lower.includes('queue this')
  );
}

export function ChatPanel({ className }: { className?: string }) {
  const { messages, sendMessage, clearUnread, setIsChatOpen } = useChat();
  const currentUser = useAuthStore((s) => s.user);
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsChatOpen(true);
    clearUnread();
    return () => {
      setIsChatOpen(false);
    };
  }, [clearUnread, setIsChatOpen]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = inputText.trim();
    if (!clean) return;

    sendMessage(clean);
    setInputText('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={cn('flex h-full flex-col overflow-hidden bg-jukebox-black/40', className)}>
      {/* Chat Header Note */}
      <div className="flex items-center justify-between border-b border-jukebox-gold/15 px-4 py-2.5 bg-black/30">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-3.5 w-3.5 text-jukebox-gold" />
          <span className="font-button text-[10px] font-black uppercase tracking-[0.25em] text-jukebox-gold">
            Room Chat & Suggestions
          </span>
        </div>
        <span className="text-[10px] font-semibold text-jukebox-cream/40">
          {messages.length} {messages.length === 1 ? 'message' : 'messages'}
        </span>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center p-6 text-center text-jukebox-cream/40">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-jukebox-gold/10 border border-jukebox-gold/20 mb-3">
              <Music className="h-6 w-6 text-jukebox-gold/70" />
            </div>
            <p className="font-heading text-sm font-bold text-jukebox-cream/70">
              Welcome to Room Chat
            </p>
            <p className="font-body text-xs mt-1 text-jukebox-cream/40 max-w-xs">
              Talk with everyone or suggest songs to the host (e.g. &ldquo;Play The Nights by Avicii&rdquo;)
            </p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMe = msg.senderId === currentUser?.id;
            const isSuggestion = isSongSuggestion(msg.message);

            return (
              <motion.div
                key={msg.id || index}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15 }}
                className={cn('flex flex-col', isMe ? 'items-end' : 'items-start')}
              >
                {/* Sender Identity & Badges */}
                <div className="flex items-center gap-1.5 mb-1 px-1">
                  <span className="text-xs font-bold text-jukebox-cream">
                    {msg.senderName}
                  </span>

                  {/* Authoritative HOST Badge */}
                  {msg.isHost && (
                    <span className="inline-flex items-center gap-1 rounded bg-amber-500/25 border border-amber-400/50 px-1.5 py-0.2 text-[9px] font-black uppercase tracking-wider text-amber-300 shadow-sm">
                      <ShieldCheck className="h-2.5 w-2.5 text-amber-400" />
                      HOST
                    </span>
                  )}

                  {/* Song suggestion indicator tag */}
                  {isSuggestion && (
                    <span className="inline-flex items-center gap-0.5 rounded bg-cyan-950/40 border border-cyan-500/30 px-1.5 py-0.2 text-[9px] font-bold text-cyan-300">
                      <Music className="h-2.5 w-2.5 text-cyan-400" />
                      Suggestion
                    </span>
                  )}

                  <span className="text-[10px] text-jukebox-cream/40 ml-1">
                    {formatMessageTime(msg.createdAt)}
                  </span>
                </div>

                {/* Message Bubble */}
                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed break-words shadow-md transition-all',
                    isMe
                      ? 'bg-gradient-to-r from-amber-600/30 to-jukebox-gold/30 border border-jukebox-gold/40 text-jukebox-cream rounded-tr-sm'
                      : 'bg-black/60 border border-white/10 text-jukebox-cream/90 rounded-tl-sm',
                    isSuggestion && 'ring-1 ring-cyan-500/30'
                  )}
                >
                  <p className="whitespace-pre-wrap">{msg.message}</p>
                </div>
              </motion.div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input Bar at Bottom */}
      <form
        onSubmit={handleSend}
        className="shrink-0 border-t border-jukebox-gold/20 p-2.5 bg-black/60 flex items-center gap-2"
      >
        <input
          ref={inputRef}
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={500}
          placeholder="Say something or suggest a song..."
          className="flex-1 bg-black/50 border border-jukebox-gold/25 rounded-xl px-3.5 py-2 text-sm text-jukebox-cream placeholder:text-jukebox-cream/35 focus:outline-none focus:border-jukebox-gold/70 focus:ring-1 focus:ring-jukebox-gold/40"
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          title="Send message"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-jukebox-gold text-jukebox-black hover:bg-jukebox-gold-bright transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-md cursor-pointer active:scale-95"
        >
          <Send className="h-4 w-4 fill-current ml-0.5" />
        </button>
      </form>
    </div>
  );
}
