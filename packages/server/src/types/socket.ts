import { QueueItem, PlaybackState } from './index'

export interface CreateRoomPayload {
  name?: string
}

export interface JoinRoomPayload {
  roomCode: string
  nickname: string
}

export interface RejoinRoomPayload {
  roomId: string
}

export interface TransferHostPayload {
  roomId: string
  newHostId: string
}

export interface PlayPayload {
  roomId: string
  position?: number
}

export interface PausePayload {
  roomId: string
  position: number
}

export interface SeekPayload {
  roomId: string
  position: number
}

export interface NextTrackPayload {
  roomId: string
}

export interface ToggleVideoModePayload {
  roomId: string
  isVideoMode: boolean
  position?: number
}

export interface AddSongPayload {
  roomId: string
  videoId: string
  title: string
  artist: string
  duration: number
  thumbnail?: string | null
  musicVideoId?: string | null
  hasVideo?: boolean
}

export interface RemoveSongPayload {
  roomId: string
  itemId: string
}

export interface ReorderQueuePayload {
  roomId: string
  itemId: string
  newIndex: number
}

export interface RequestSyncPayload {
  roomId: string
  clientSendTime?: number
}

export interface RoomCreatedResponse {
  roomId: string
  roomCode: string
}

export interface UserJoinedResponse {
  userId: string
  nickname: string
}

export interface UserLeftResponse {
  userId: string
  nickname: string
}

export interface HostChangedResponse {
  newHostId: string
}

export interface PlaybackStateResponse {
  state: 'playing' | 'paused' | 'stopped'
  position: number
  track: QueueItem | null
  isVideoMode?: boolean
}

export interface SeekedResponse {
  position: number
}

export interface TrackChangedResponse {
  track: QueueItem | null
}

export interface VideoModeChangedResponse {
  isVideoMode: boolean
  position: number
}

export interface QueueUpdatedResponse {
  queue: QueueItem[]
}

export interface SyncStateResponse {
  serverTimestamp: number
  playbackState: 'playing' | 'paused' | 'stopped'
  playbackPosition: number
  currentTrack: QueueItem | null
  isVideoMode: boolean
  clientSendTime?: number
}

export interface ErrorResponse {
  message: string
  code?: string
}


export interface SendMessagePayload {
  roomId: string
  message: string
}

export interface GetMessagesPayload {
  roomId: string
  limit?: number
}

export interface NewMessageResponse {
  id: string
  roomId: string
  senderId: string
  senderName: string
  isHost: boolean
  message: string
  createdAt: string
}

export interface MessagesHistoryResponse {
  messages: NewMessageResponse[]
}

export interface ClientToServerEvents {
  create_room: (payload: CreateRoomPayload) => void
  join_room: (payload: JoinRoomPayload) => void
  rejoin_room: (payload: RejoinRoomPayload) => void
  leave_room: (payload: { roomId: string }) => void
  transfer_host: (payload: TransferHostPayload) => void
  play: (payload: PlayPayload) => void
  pause: (payload: PausePayload) => void
  seek: (payload: SeekPayload) => void
  next_track: (payload: NextTrackPayload) => void
  toggle_video_mode: (payload: ToggleVideoModePayload) => void
  add_song: (payload: AddSongPayload) => void
  remove_song: (payload: RemoveSongPayload) => void
  reorder_queue: (payload: ReorderQueuePayload) => void
  request_sync: (payload: RequestSyncPayload) => void
  send_message: (payload: SendMessagePayload) => void
  get_messages: (payload: GetMessagesPayload) => void
}

export interface ServerToClientEvents {
  room_created: (response: RoomCreatedResponse) => void
  room_joined: (response: { roomId: string; roomCode: string; members: any[]; queue: QueueItem[] }) => void
  user_joined: (response: UserJoinedResponse) => void
  user_left: (response: UserLeftResponse) => void
  host_changed: (response: HostChangedResponse) => void
  playback_state: (response: PlaybackStateResponse) => void
  seeked: (response: SeekedResponse) => void
  track_changed: (response: TrackChangedResponse) => void
  video_mode_changed: (response: VideoModeChangedResponse) => void
  queue_updated: (response: QueueUpdatedResponse) => void
  sync_state: (response: SyncStateResponse) => void
  error: (response: ErrorResponse) => void
  room_closed: (response: {}) => void
  new_message: (response: NewMessageResponse) => void
  messages_history: (response: MessagesHistoryResponse) => void
}

export interface InterServerEvents {
  ping: () => void
}

export interface SocketData {
  userId: string
  role: string
  roomId?: string
}
