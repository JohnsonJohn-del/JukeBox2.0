'use client';

import { useEffect, useCallback } from 'react';
import { socket } from '@/sockets';
import { SOCKET_EVENTS } from '@/sockets/events';
import { useChatStore } from '@/store/chatStore';
import { useRoomStore } from '@/store/roomStore';
import toast from 'react-hot-toast';
import type { ChatMessage } from '@/types';

export function useChat() {
  const roomId = useRoomStore((s) => s.room?.id);
  const { messages, unreadCount, isChatOpen, addMessage, setMessages, clearUnread, setIsChatOpen } =
    useChatStore();

  useEffect(() => {
    function onNewMessage(message: ChatMessage) {
      addMessage(message);
    }

    function onMessagesHistory(data: { messages: ChatMessage[] }) {
      if (Array.isArray(data.messages)) {
        setMessages(data.messages);
      }
    }

    socket.on(SOCKET_EVENTS.NEW_MESSAGE, onNewMessage);
    socket.on(SOCKET_EVENTS.MESSAGES_HISTORY, onMessagesHistory);

    // Initial message fetch for this room
    if (roomId) {
      socket.emit(SOCKET_EVENTS.GET_MESSAGES, { roomId });
    }

    return () => {
      socket.off(SOCKET_EVENTS.NEW_MESSAGE, onNewMessage);
      socket.off(SOCKET_EVENTS.MESSAGES_HISTORY, onMessagesHistory);
    };
  }, [roomId, addMessage, setMessages]);

  const sendMessage = useCallback(
    (text: string) => {
      const clean = text.trim();
      if (!clean) return;
      if (!roomId) {
        toast.error('Cannot send message: Not connected to room');
        return;
      }

      socket.emit(SOCKET_EVENTS.SEND_MESSAGE, {
        roomId,
        message: clean,
      });
    },
    [roomId],
  );

  return {
    messages,
    unreadCount,
    isChatOpen,
    sendMessage,
    clearUnread,
    setIsChatOpen,
  };
}
