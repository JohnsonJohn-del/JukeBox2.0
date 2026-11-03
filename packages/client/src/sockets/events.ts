export const SOCKET_EVENTS = {
  // Room events
  CREATE_ROOM: 'create_room',
  JOIN_ROOM: 'join_room',
  REJOIN_ROOM: 'rejoin_room',
  LEAVE_ROOM: 'leave_room',
  TRANSFER_HOST: 'transfer_host',
  ROOM_CREATED: 'room_created',
  ROOM_JOINED: 'room_joined',
  USER_JOINED: 'user_joined',
  USER_LEFT: 'user_left',
  HOST_CHANGED: 'host_changed',
  ROOM_CLOSED: 'room_closed',
  // Playback events
  PLAY: 'play',
  PAUSE: 'pause',
  SEEK: 'seek',
  NEXT_TRACK: 'next_track',
  PLAYBACK_STATE: 'playback_state',
  SEEKED: 'seeked',
  TRACK_CHANGED: 'track_changed',
  SYNC_STATE: 'sync_state',
  REQUEST_SYNC: 'request_sync',
  TOGGLE_VIDEO_MODE: 'toggle_video_mode',
  VIDEO_MODE_CHANGED: 'video_mode_changed',
  // Queue events
  ADD_SONG: 'add_song',
  REMOVE_SONG: 'remove_song',
  REORDER_QUEUE: 'reorder_queue',
  QUEUE_UPDATED: 'queue_updated',
  // Error
  ERROR: 'error',
} as const;
