import { Server, Socket } from 'socket.io'
import * as queueService from '../services/queue.service'
import { getOrCreatePlaybackState } from './playback.socket'
import { SocketData, ClientToServerEvents, ServerToClientEvents, InterServerEvents } from '../types/socket'

export function registerQueueHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
): void {
  socket.on('add_song', async (payload) => {
    try {
      const userId = socket.data.userId
      const { roomId, videoId, title, artist, duration, thumbnail, musicVideoId, hasVideo } = payload

      await queueService.addSong(roomId, userId, {
        videoId,
        title,
        artist,
        duration,
        thumbnail,
        musicVideoId,
        hasVideo,
      })

      const state = getOrCreatePlaybackState(roomId)

      if (!state.currentTrack) {
        const nextTrack = await queueService.getNextTrack(roomId)

        state.currentTrack = nextTrack
        state.playbackState = nextTrack ? 'playing' : 'stopped'
        state.playbackPosition = 0
        state.playbackStartTime = nextTrack ? Date.now() : null

        if (nextTrack) {
          io.to(roomId).emit('track_changed', { track: nextTrack })
        }
      }

      const queue = await queueService.getQueue(roomId)
      io.to(roomId).emit('queue_updated', { queue })

      if (state.currentTrack && state.playbackState === 'playing') {
        io.to(roomId).emit('playback_state', {
          state: 'playing',
          position: state.playbackPosition,
          track: state.currentTrack,
          isVideoMode: state.isVideoMode,
        })
      }
    } catch (error: any) {
      socket.emit('error', { message: error.message || 'Failed to add song', code: 'ADD_SONG_FAILED' })
    }
  })

  socket.on('remove_song', async (payload) => {
    try {
      const userId = socket.data.userId
      const { roomId, itemId } = payload

      await queueService.removeSong(roomId, itemId, userId)

      const queue = await queueService.getQueue(roomId)
      io.to(roomId).emit('queue_updated', { queue })
    } catch (error: any) {
      socket.emit('error', { message: error.message || 'Failed to remove song', code: 'REMOVE_SONG_FAILED' })
    }
  })

  socket.on('reorder_queue', async (payload) => {
    try {
      const userId = socket.data.userId
      const { roomId, itemId, newIndex } = payload

      const queue = await queueService.reorderQueue(roomId, itemId, newIndex, userId)
      io.to(roomId).emit('queue_updated', { queue })
    } catch (error: any) {
      socket.emit('error', { message: error.message || 'Failed to reorder queue', code: 'REORDER_FAILED' })
    }
  })
}
