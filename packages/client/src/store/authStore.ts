import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isGuest: boolean;
  setAuth: (user: User, token: string) => void;
  setGuest: (nickname: string, token: string, userId?: string) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isGuest: false,

      setAuth: (user, token) =>
        set({
          user,
          token,
          isAuthenticated: true,
          isGuest: false,
        }),

      setGuest: (nickname, token, userId) =>
        set({
          user: { id: userId || '', username: nickname, email: '' },
          token,
          isAuthenticated: true,
          isGuest: true,
        }),

      logout: () =>
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isGuest: false,
        }),

      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),
    }),
    { name: 'auth-storage' },
  ),
);
