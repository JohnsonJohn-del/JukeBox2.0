import { Server as HttpServer } from 'http'
import { Server } from 'socket.io'
import { verifyToken } from '../utils/jwt'
import { config } from '../config'
import { registerRoomHandlers } from './room.socket'
import { registerPlaybackHandlers } from './playback.socket'
import { registerQueueHandlers } from './queue.socket'
import { registerChatHandlers } from './chat.socket'
import { SocketData, ClientToServerEvents, ServerToClientEvents, InterServerEvents } from '../types/socket'
import { getRoom, transferHost, getRoomMembers, updateSocketId } from '../services/room.service'

let io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>

export function setupSocket(httpServer: HttpServer): Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData> {
  io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(httpServer, {
    cors: {
      origin: (origin, callback) => {
        callback(null, true)
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingInterval: 25000,
    pingTimeout: 20000,
    transports: ['websocket', 'polling'],
  })

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token

    if (!token) {
      return next(new Error('Authentication required'))
    }

    try {
      const decoded = verifyToken(token as string)
      ;(socket as any).data.userId = decoded.userId
      ;(socket as any).data.role = decoded.role
      next()
    } catch {
      next(new Error('Invalid token'))
    }
  })

  io.on('connection', (socket) => {
    const userId = socket.data.userId
    console.log(`[Socket] User ${userId} connected (socket: ${socket.id})`)

    registerRoomHandlers(io, socket)
    registerPlaybackHandlers(io, socket)
    registerQueueHandlers(io, socket)
    registerChatHandlers(io, socket)

    socket.on('disconnect', async () => {
      console.log(`[Socket] User ${userId} disconnected (socket: ${socket.id})`)
      const roomId = socket.data.roomId
      if (roomId) {
        try {
          const roomData = await getRoom(roomId)
          if (roomData.room) {
            const member = roomData.members.find((m: any) => m.user_id === userId)
            const wasHost = member?.is_host ?? false
            await updateSocketId(roomId, userId, null)
            socket.to(roomId).emit('user_left', {
              userId,
              nickname: member?.nickname || 'Unknown',
            })
            // Host preserved across disconnects
          }
        } catch (err) {
          console.error(`[Socket] Error handling disconnect for user ${userId}:`, err)
        }
      }
    })
  })

  console.log('[Socket] Socket.IO initialized')
  return io
}

export function getIO(): Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData> {
  if (!io) {
    throw new Error('Socket.IO not initialized')
  }
  return io
}
