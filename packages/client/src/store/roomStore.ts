import { create } from 'zustand';
import type { Room, RoomMember } from '@/types';

interface RoomState {
  room: Room | null;
  members: RoomMember[];
  isHost: boolean;
  setRoom: (room: Room) => void;
  setMembers: (members: RoomMember[]) => void;
  addMember: (member: RoomMember) => void;
  removeMember: (userId: string) => void;
  setHost: (hostId: string) => void;
  setIsHost: (isHost: boolean) => void;
  setVideoMode: (isVideoMode: boolean) => void;
  leaveRoom: () => void;
}

export const useRoomStore = create<RoomState>()((set) => ({
  room: null,
  members: [],
  isHost: false,

  setRoom: (room) =>
    set({ room }),

  setMembers: (members) =>
    set({ members }),

  setIsHost: (isHost) =>
    set({ isHost }),

  setVideoMode: (isVideoMode) =>
    set((state) => ({
      room: state.room ? { ...state.room, isVideoMode } : null,
    })),

  addMember: (member) =>
    set((state) => ({
      members: state.members.some((m) => m.userId === member.userId)
        ? state.members
        : [...state.members, member],
    })),

  removeMember: (userId) =>
    set((state) => ({
      members: state.members.filter((m) => m.userId !== userId),
    })),

  setHost: (hostId) =>
    set((state) => ({
      isHost: hostId === state.room?.hostId,
      members: state.members.map((m) => ({
        ...m,
        isHost: m.userId === hostId,
      })),
    })),

  leaveRoom: () =>
    set({
      room: null,
      members: [],
      isHost: false,
    }),
}));
