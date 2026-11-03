import { Server, Socket } from 'socket.io'
import * as queueService from '../services/queue.service'
import { getOrCreatePlaybackState, persistPlaybackState, verifyIsHost } from './playback.socket'
import { SocketData, ClientToServerEvents, ServerToClientEvents, InterServerEvents } from '../types/socket'

export function registerQueueHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
): void {
  socket.on('add_song', async (payload) => {
    try {
      const userId = socket.data.userId
      const { roomId, videoId, title, artist, duration, thumbnail, musicVideoId, hasVideo } = payload

      const isHost = await verifyIsHost(roomId, userId)
      if (!isHost) {
        socket.emit('error', { message: 'Only the host can add songs to the queue', code: 'NOT_HOST' })
        return
      }

      let addedItem: any
      try {
        addedItem = await queueService.addSong(roomId, userId, {
          videoId,
          title,
          artist,
          duration,
          thumbnail,
          musicVideoId,
          hasVideo,
        })
      } catch (err: any) {
        if (err.code === 'DUPLICATE_SONG') {
          // If already in queue, continue
        } else {
          throw err
        }
      }

      const state = getOrCreatePlaybackState(roomId)

      // If nothing is playing or playback is stopped, play this song immediately
      if (!state.currentTrack || state.playbackState === 'stopped') {
        const nextTrack = await queueService.getNextTrack(roomId)
        state.currentTrack = nextTrack || addedItem
        state.playbackState = 'playing'
        state.playbackPosition = 0
        state.playbackStartTime = Date.now()
        state.isVideoMode = true

        if (state.currentTrack) {
          io.to(roomId).emit('track_changed', { track: state.currentTrack })
        }
      }

      const queue = await queueService.getQueue(roomId)
      io.to(roomId).emit('queue_updated', { queue })

      if (state.currentTrack) {
        io.to(roomId).emit('playback_state', {
          state: state.playbackState,
          position: state.playbackPosition,
          track: state.currentTrack,
          isVideoMode: state.isVideoMode,
        })
      }
    } catch (error: any) {
      socket.emit('error', { message: error.message || 'Failed to add song', code: 'ADD_SONG_FAILED' })
    }
  })

  // Play a song immediately (Host action from SearchBar or Queue)
  socket.on('play_song_now' as any, async (payload: any) => {
    try {
      const userId = socket.data.userId
      const { roomId, videoId, title, artist, duration, thumbnail, musicVideoId, hasVideo } = payload

      const isHost = await verifyIsHost(roomId, userId)
      if (!isHost) {
        socket.emit('error', { message: 'Only the host can control playback', code: 'NOT_HOST' })
        return
      }

      const track = await queueService.playSongNow(roomId, userId, {
        videoId,
        title,
        artist,
        duration,
        thumbnail,
        musicVideoId,
        hasVideo,
      })

      const state = getOrCreatePlaybackState(roomId)
      state.currentTrack = track
      state.playbackState = 'playing'
      state.playbackPosition = 0
      state.playbackStartTime = Date.now()
      state.isVideoMode = true
      persistPlaybackState(roomId, state)

      io.to(roomId).emit('track_changed', { track })
      io.to(roomId).emit('playback_state', {
        state: 'playing',
        position: 0,
        track,
        isVideoMode: true,
      })

      const queue = await queueService.getQueue(roomId)
      io.to(roomId).emit('queue_updated', { queue })
    } catch (error: any) {
      socket.emit('error', { message: error.message || 'Failed to play song', code: 'PLAY_FAILED' })
    }
  })

  socket.on('remove_song', async (payload) => {
    try {
      const userId = socket.data.userId
      const { roomId, itemId } = payload

      const isHost = await verifyIsHost(roomId, userId)
      if (!isHost) {
        socket.emit('error', { message: 'Only the host can remove songs', code: 'NOT_HOST' })
        return
      }

      await queueService.removeSong(roomId, itemId, userId)

      const queue = await queueService.getQueue(roomId)
      io.to(roomId).emit('queue_updated', { queue })
    } catch (error: any) {
      socket.emit('error', { message: error.message || 'Failed to remove song', code: 'REMOVE_SONG_FAILED' })
    }
  })

  socket.on('reorder_queue' as any, async (payload: any) => {
    try {
      const userId = socket.data.userId
      const { roomId, itemId, newIndex, items } = payload

      const isHost = await verifyIsHost(roomId, userId)
      if (!isHost) {
        socket.emit('error', { message: 'Only the host can reorder the queue', code: 'NOT_HOST' })
        return
      }

      let queue: any
      if (items && Array.isArray(items)) {
        queue = await queueService.reorderQueueBatch(roomId, items, userId)
      } else {
        queue = await queueService.reorderQueue(roomId, itemId, newIndex, userId)
      }
      io.to(roomId).emit('queue_updated', { queue })
    } catch (error: any) {
      socket.emit('error', { message: error.message || 'Failed to reorder queue', code: 'REORDER_FAILED' })
    }
  })
}
