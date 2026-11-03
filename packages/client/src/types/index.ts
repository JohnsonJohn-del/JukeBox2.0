export interface User {
  id: string;
  username: string;
  email: string;
  avatarUrl?: string;
  role?: 'user' | 'guest';
}

export interface Room {
  id: string;
  roomCode: string;
  hostId: string;
  name: string;
  isActive: boolean;
  isVideoMode?: boolean;
  currentTrack?: QueueItem;
  createdAt: string;
}

export interface RoomMember {
  id: string;
  userId: string;
  nickname: string;
  isHost: boolean;
  joinedAt: string;
}

export interface QueueItem {
  id: string;
  videoId: string;
  musicVideoId?: string | null;
  hasVideo?: boolean;
  title: string;
  artist: string;
  duration: number;
  thumbnail: string;
  position: number;
  addedBy: string;
  addedAt: string;
}

export type PlaybackState = 'playing' | 'paused' | 'stopped';

export interface PlayerState {
  state: PlaybackState;
  videoId?: string;
  currentTime: number;
  duration: number;
  isVideoMode?: boolean;
  musicVideoId?: string | null;
  hasVideo?: boolean;
}

export interface VideoModeChangedPayload {
  isVideoMode: boolean;
  position?: number;
  roomId?: string;
  activeVideoId?: string;
  currentTime?: number;
  by?: string;
}

export interface SearchResult {
  videoId: string;
  musicVideoId?: string | null;
  hasVideo?: boolean;
  title: string;
  artist: string;
  duration: number;
  thumbnails: { url: string; width: number; height: number }[];
}

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
}
