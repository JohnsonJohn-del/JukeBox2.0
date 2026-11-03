export interface User {
  id: string
  username: string
  email: string
  password_hash: string
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface Room {
  id: string
  room_code: string
  host_id: string
  name: string | null
  is_active: boolean
  is_video_mode?: boolean
  current_track_id: string | null
  created_at: string
  updated_at: string
}

export interface RoomMember {
  id: string
  room_id: string
  user_id: string
  nickname: string
  is_host: boolean
  joined_at: string
  socket_id: string | null
}

export interface QueueItem {
  id: string
  room_id: string
  added_by: string
  video_id: string
  music_video_id?: string | null
  has_video?: boolean
  title: string
  artist: string
  duration: number
  thumbnail: string | null
  position: number
  is_played: boolean
  added_at: string
}

export interface JwtPayload {
  userId: string
  role: 'user' | 'guest'
  nickname?: string
  roomId?: string
  iat: number
  exp: number
}

export interface PlaybackState {
  currentTrack: QueueItem | null
  playbackState: 'playing' | 'paused' | 'stopped'
  playbackPosition: number
  playbackStartTime: number | null
  isVideoMode: boolean
}

export interface AuthRequest {
  userId: string
  role: 'user' | 'guest'
}

export interface ChatMessage {
  id: string
  room_id: string
  sender_id: string
  sender_name: string
  is_host: boolean
  message: string
  created_at: string
}
