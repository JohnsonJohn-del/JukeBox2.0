import { Server, Socket } from 'socket.io'
import * as roomService from '../services/room.service'
import * as authService from '../services/auth.service'
import { generateToken } from '../utils/jwt'
import { SocketData, ClientToServerEvents, ServerToClientEvents, InterServerEvents } from '../types/socket'
import { getPlaybackState } from './playback.socket'

export function registerRoomHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
): void {
  socket.on('create_room', async (payload) => {
    try {
      const userId = socket.data.userId
      const { name } = payload

      const { room, member } = await roomService.createRoom(userId, name)

      const guestToken = generateToken({ userId, role: 'guest', roomId: room.id }, '24h')

      socket.join(room.id)
      socket.data.roomId = room.id

      await roomService.updateSocketId(room.id, userId, socket.id)

      socket.emit('room_created', {
        roomId: room.id,
        roomCode: room.room_code,
      })

      io.to(room.id).emit('room_joined', {
        roomId: room.id,
        roomCode: room.room_code,
        members: [member],
        queue: [],
      })
    } catch (error: any) {
      socket.emit('error', { message: error.message || 'Failed to create room', code: 'CREATE_FAILED' })
    }
  })

  socket.on('join_room', async (payload) => {
    try {
      const userId = socket.data.userId
      const { roomCode, nickname } = payload

      const room = await roomService.getRoomByCode(roomCode)
      if (!room) {
        socket.emit('error', { message: 'Room not found or inactive', code: 'ROOM_NOT_FOUND' })
        return
      }

      const { member } = await roomService.joinRoom(roomCode, userId, nickname)

      socket.join(room.id)
      socket.data.roomId = room.id

      await roomService.updateSocketId(room.id, userId, socket.id)

      const roomData = await roomService.getRoom(room.id)

      socket.emit('room_joined', {
        roomId: room.id,
        roomCode: room.room_code,
        members: roomData.members,
        queue: roomData.queue,
      })

      // Send current playback and track state to the joining user
      const playback = getPlaybackState(room.id)
      if (playback.currentTrack) {
        socket.emit('track_changed', { track: playback.currentTrack })
      }
      socket.emit('playback_state', {
        state: playback.playbackState,
        position: playback.playbackPosition,
        track: playback.currentTrack,
        isVideoMode: playback.isVideoMode,
      })

      socket.to(room.id).emit('user_joined', {
        userId,
        nickname,
      })
    } catch (error: any) {
      socket.emit('error', { message: error.message || 'Failed to join room', code: 'JOIN_FAILED' })
    }
  })

  socket.on('leave_room', async (payload) => {
    try {
      const userId = socket.data.userId
      const { roomId } = payload

      const roomData = await roomService.getRoom(roomId)
      if (!roomData.room) {
        socket.emit('error', { message: 'Room not found', code: 'ROOM_NOT_FOUND' })
        return
      }

      const member = roomData.members.find((m) => m.user_id === userId)
      if (!member) {
        socket.emit('error', { message: 'Not a member of this room', code: 'NOT_MEMBER' })
        return
      }

      const wasHost = member.is_host

      await roomService.leaveRoom(roomId, userId)
      await roomService.updateSocketId(roomId, userId, null)

      socket.leave(roomId)

      socket.to(roomId).emit('user_left', {
        userId,
        nickname: member.nickname,
      })

      socket.emit('room_joined', {
        roomId: '',
        roomCode: '',
        members: [],
        queue: [],
      })

      const updatedMembers = await roomService.getRoomMembers(roomId)

      if (updatedMembers.length === 0) {
        io.to(roomId).emit('room_closed', {})
      } else if (wasHost && updatedMembers.length > 0) {
        const newHost = updatedMembers[0]
        await roomService.transferHost(roomId, newHost.user_id)
        io.to(roomId).emit('host_changed', { newHostId: newHost.user_id })
      }
    } catch (error: any) {
      socket.emit('error', { message: error.message || 'Failed to leave room', code: 'LEAVE_FAILED' })
    }
  })

  socket.on('rejoin_room', async (payload) => {
    try {
      const userId = socket.data.userId
      const { roomId } = payload

      const roomData = await roomService.getRoom(roomId)
      if (!roomData.room) {
        socket.emit('error', { message: 'Room not found', code: 'ROOM_NOT_FOUND' })
        return
      }

      const member = roomData.members.find((m) => m.user_id === userId)
      if (!member) {
        socket.emit('error', { message: 'Not a member of this room', code: 'NOT_MEMBER' })
        return
      }

      socket.join(roomId)
      socket.data.roomId = roomId

      await roomService.updateSocketId(roomId, userId, socket.id)

      socket.emit('room_joined', {
        roomId: roomData.room.id,
        roomCode: roomData.room.room_code,
        members: roomData.members,
        queue: roomData.queue,
      })

      const playback = getPlaybackState(roomId)
      if (playback.currentTrack) {
        socket.emit('track_changed', { track: playback.currentTrack })
      }
      socket.emit('playback_state', {
        state: playback.playbackState,
        position: playback.playbackPosition,
        track: playback.currentTrack,
        isVideoMode: playback.isVideoMode,
      })
    } catch (error: any) {
      socket.emit('error', { message: error.message || 'Failed to rejoin room', code: 'REJOIN_FAILED' })
    }
  })

  socket.on('transfer_host', async (payload) => {
    try {
      const userId = socket.data.userId
      const { roomId, newHostId } = payload

      const roomData = await roomService.getRoom(roomId)
      if (!roomData.room) {
        socket.emit('error', { message: 'Room not found', code: 'ROOM_NOT_FOUND' })
        return
      }

      const currentHost = roomData.members.find((m) => m.user_id === userId)
      if (!currentHost || !currentHost.is_host) {
        socket.emit('error', { message: 'Only the host can transfer host', code: 'NOT_HOST' })
        return
      }

      await roomService.transferHost(roomId, newHostId)

      io.to(roomId).emit('host_changed', { newHostId })
    } catch (error: any) {
      socket.emit('error', { message: error.message || 'Failed to transfer host', code: 'TRANSFER_FAILED' })
    }
  })
}
