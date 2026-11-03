import { create } from 'zustand';
import type { ChatMessage } from '@/types';

interface ChatState {
  messages: ChatMessage[];
  unreadCount: number;
  isChatOpen: boolean;
  addMessage: (message: ChatMessage) => void;
  setMessages: (messages: ChatMessage[]) => void;
  clearUnread: () => void;
  incrementUnread: () => void;
  setIsChatOpen: (isOpen: boolean) => void;
  reset: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  unreadCount: 0,
  isChatOpen: false,

  addMessage: (message) =>
    set((state) => {
      // Prevent duplicate messages
      if (state.messages.some((m) => m.id === message.id)) {
        return state;
      }
      return {
        messages: [...state.messages, message],
        unreadCount: state.isChatOpen ? 0 : state.unreadCount + 1,
      };
    }),

  setMessages: (messages) =>
    set(() => ({
      messages,
    })),

  clearUnread: () =>
    set(() => ({
      unreadCount: 0,
    })),

  incrementUnread: () =>
    set((state) => ({
      unreadCount: state.unreadCount + 1,
    })),

  setIsChatOpen: (isOpen) =>
    set(() => ({
      isChatOpen: isOpen,
      unreadCount: isOpen ? 0 : 0,
    })),

  reset: () =>
    set(() => ({
      messages: [],
      unreadCount: 0,
      isChatOpen: false,
    })),
}));
