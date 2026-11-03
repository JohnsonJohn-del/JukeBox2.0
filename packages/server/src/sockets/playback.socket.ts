import { Server, Socket } from 'socket.io'
import { QueueItem, PlaybackState } from '../types'
import * as queueService from '../services/queue.service'
import { SocketData, ClientToServerEvents, ServerToClientEvents, InterServerEvents } from '../types/socket'
import { getDbClient } from '../config/database'

interface RoomPlaybackState {
  currentTrack: QueueItem | null
  playbackState: 'playing' | 'paused' | 'stopped'
  playbackPosition: number
  playbackStartTime: number | null
  isVideoMode: boolean
  playedTrackIds: Set<string>
}

const roomPlaybackStates = new Map<string, RoomPlaybackState>()

export function getOrCreatePlaybackState(roomId: string): RoomPlaybackState {
  let state = roomPlaybackStates.get(roomId)
  if (!state) {
    state = {
      currentTrack: null,
      playbackState: 'stopped',
      playbackPosition: 0,
      playbackStartTime: null,
      isVideoMode: false,
      playedTrackIds: new Set(),
    }
    roomPlaybackStates.set(roomId, state)
  }
  return state
}

export function getPlaybackState(roomId: string): PlaybackState {
  const state = roomPlaybackStates.get(roomId)
  if (!state) {
    return {
      currentTrack: null,
      playbackState: 'stopped',
      playbackPosition: 0,
      playbackStartTime: null,
      isVideoMode: false,
    }
  }

  let position = state.playbackPosition
  if (state.playbackState === 'playing' && state.playbackStartTime) {
    position += (Date.now() - state.playbackStartTime) / 1000
  }

  return {
    currentTrack: state.currentTrack,
    playbackState: state.playbackState,
    playbackPosition: position,
    playbackStartTime: state.playbackStartTime,
    isVideoMode: state.isVideoMode,
  }
}

async function verifyIsHost(roomId: string, userId: string): Promise<boolean> {
  try {
    const db = getDbClient()
    const { data: member } = await db
      .from('room_members')
      .select('is_host')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .maybeSingle()

    if (member?.is_host) return true

    const { data: room } = await db
      .from('rooms')
      .select('host_id')
      .eq('id', roomId)
      .maybeSingle()

    return room?.host_id === userId
  } catch {
    // If DB check fails or in development without DB, default to true for creator
    return true
  }
}

export function registerPlaybackHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
): void {
  socket.on('play', async (payload) => {
    try {
      const userId = socket.data.userId
      const { roomId, position } = payload

      const isHost = await verifyIsHost(roomId, userId)
      if (!isHost) {
        socket.emit('error', { message: 'Only the host can control playback', code: 'NOT_HOST' })
        return
      }

      const state = getOrCreatePlaybackState(roomId)
      state.playbackState = 'playing'
      state.playbackStartTime = Date.now()

      if (position !== undefined) {
        state.playbackPosition = position
      }

      if (!state.currentTrack) {
        const nextTrack = await queueService.getNextTrack(roomId)
        state.currentTrack = nextTrack
        state.playbackPosition = 0

        if (nextTrack) {
          io.to(roomId).emit('track_changed', { track: nextTrack })
        }
      }

      socket.to(roomId).emit('playback_state', {
        state: 'playing',
        position: state.playbackPosition,
        track: state.currentTrack,
        isVideoMode: state.isVideoMode,
      })
    } catch (error: any) {
      socket.emit('error', { message: error.message || 'Playback failed', code: 'PLAYBACK_ERROR' })
    }
  })

  socket.on('pause', async (payload) => {
    try {
      const userId = socket.data.userId
      const { roomId, position } = payload

      const isHost = await verifyIsHost(roomId, userId)
      if (!isHost) {
        socket.emit('error', { message: 'Only the host can control playback', code: 'NOT_HOST' })
        return
      }

      const state = getOrCreatePlaybackState(roomId)
      state.playbackState = 'paused'
      state.playbackPosition = position
      state.playbackStartTime = null

      socket.to(roomId).emit('playback_state', {
        state: 'paused',
        position,
        track: state.currentTrack,
        isVideoMode: state.isVideoMode,
      })
    } catch (error: any) {
      socket.emit('error', { message: error.message || 'Pause failed', code: 'PAUSE_ERROR' })
    }
  })

  socket.on('seek', async (payload) => {
    try {
      const userId = socket.data.userId
      const { roomId, position } = payload

      const isHost = await verifyIsHost(roomId, userId)
      if (!isHost) {
        socket.emit('error', { message: 'Only the host can seek', code: 'NOT_HOST' })
        return
      }

      const state = getOrCreatePlaybackState(roomId)
      state.playbackPosition = position

      if (state.playbackState === 'playing') {
        state.playbackStartTime = Date.now()
      }

      io.to(roomId).emit('seeked', { position })
    } catch (error: any) {
      socket.emit('error', { message: error.message || 'Seek failed', code: 'SEEK_ERROR' })
    }
  })

  socket.on('toggle_video_mode', async (payload) => {
    try {
      const userId = socket.data.userId
      const { roomId, isVideoMode, position } = payload

      const isHost = await verifyIsHost(roomId, userId)
      if (!isHost) {
        socket.emit('error', { message: 'Only the host can toggle Video Mode', code: 'NOT_HOST' })
        return
      }

      const state = getOrCreatePlaybackState(roomId)
      state.isVideoMode = isVideoMode

      if (position !== undefined) {
        state.playbackPosition = position
      }
      if (state.playbackState === 'playing') {
        state.playbackStartTime = Date.now()
      }

      io.to(roomId).emit('video_mode_changed', {
        isVideoMode: state.isVideoMode,
        position: state.playbackPosition,
      })
    } catch (error: any) {
      socket.emit('error', { message: error.message || 'Failed to toggle Video Mode', code: 'TOGGLE_VIDEO_ERROR' })
    }
  })

  socket.on('next_track', async (payload) => {
    try {
      const userId = socket.data.userId
      const { roomId } = payload

      const isHost = await verifyIsHost(roomId, userId)
      if (!isHost) {
        socket.emit('error', { message: 'Only the host can skip tracks', code: 'NOT_HOST' })
        return
      }

      const state = getOrCreatePlaybackState(roomId)

      if (state.currentTrack) {
        state.playedTrackIds.add(state.currentTrack.id)
        await queueService.markAsPlayed(state.currentTrack.id)
      }

      const nextTrack = await queueService.getNextTrack(roomId)

      state.currentTrack = nextTrack
      state.playbackState = nextTrack ? 'playing' : 'stopped'
      state.playbackPosition = 0
      state.playbackStartTime = nextTrack ? Date.now() : null

      if (nextTrack) {
        io.to(roomId).emit('track_changed', { track: nextTrack })

        io.to(roomId).emit('playback_state', {
          state: 'playing',
          position: 0,
          track: nextTrack,
          isVideoMode: state.isVideoMode,
        })
      } else {
        io.to(roomId).emit('playback_state', {
          state: 'stopped',
          position: 0,
          track: null,
          isVideoMode: state.isVideoMode,
        })
      }
    } catch (error: any) {
      socket.emit('error', { message: error.message || 'Failed to skip track', code: 'SKIP_ERROR' })
    }
  })

  socket.on('request_sync', async (payload) => {
    try {
      const { roomId, clientSendTime } = payload
      const state = roomPlaybackStates.get(roomId)

      let position = 0
      let playbackState: 'playing' | 'paused' | 'stopped' = 'stopped'
      let currentTrack: QueueItem | null = null
      let isVideoMode = false

      if (state) {
        currentTrack = state.currentTrack
        playbackState = state.playbackState
        isVideoMode = state.isVideoMode

        if (state.playbackState === 'playing' && state.playbackStartTime) {
          position = state.playbackPosition + (Date.now() - state.playbackStartTime) / 1000
        } else {
          position = state.playbackPosition
        }
      } else {
        const queue = await queueService.getQueue(roomId)
        if (queue.length > 0) {
          currentTrack = queue[0]
        }
      }

      socket.emit('sync_state', {
        serverTimestamp: Date.now(),
        playbackState,
        playbackPosition: position,
        currentTrack,
        isVideoMode,
        clientSendTime,
      })
    } catch (error: any) {
      socket.emit('error', { message: error.message || 'Sync failed', code: 'SYNC_ERROR' })
    }
  })
}
