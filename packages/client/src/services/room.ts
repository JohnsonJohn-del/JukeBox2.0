import { api } from './api';
import type { Room, RoomMember, User } from '@/types';

interface CreateRoomResponse {
  room: Room;
  member: RoomMember;
}

export interface JoinRoomResponse {
  room: Room;
  member: RoomMember;
  token?: string;
  user?: User;
}

interface GetRoomResponse {
  room: Room;
  members: RoomMember[];
}

interface GetRoomByCodeResponse {
  room: Room;
}

export const roomService = {
  createRoom(name?: string): Promise<CreateRoomResponse> {
    return api.post<CreateRoomResponse>('/rooms', { name });
  },

  joinRoom(roomCode: string, nickname: string): Promise<JoinRoomResponse> {
    return api.post<JoinRoomResponse>('/rooms/join', { roomCode, nickname });
  },

  getRoom(roomId: string): Promise<GetRoomResponse> {
    return api.get<GetRoomResponse>(`/rooms/${roomId}`);
  },

  getRoomByCode(code: string): Promise<GetRoomByCodeResponse> {
    return api.get<GetRoomByCodeResponse>(`/rooms/code/${code}`);
  },

  leaveRoom(roomId: string): Promise<void> {
    return api.post<void>(`/rooms/${roomId}/leave`);
  },

  transferHost(roomId: string, newHostId: string): Promise<void> {
    return api.post<void>(`/rooms/${roomId}/transfer`, { newHostId });
  },

  getActiveRooms(): Promise<Room[]> {
    return api.get<Room[]>('/rooms');
  },

  endRoom(roomId: string): Promise<void> {
    return api.post<void>(`/rooms/${roomId}/end`);
  },
};
