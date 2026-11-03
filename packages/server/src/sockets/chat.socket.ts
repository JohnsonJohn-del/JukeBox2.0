import { Server, Socket } from 'socket.io'
import * as chatService from '../services/chat.service'
import {
  SocketData,
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SendMessagePayload,
  GetMessagesPayload,
} from '../types/socket'

export function registerChatHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
): void {
  socket.on('send_message', async (payload: SendMessagePayload) => {
    try {
      const userId = socket.data.userId
      if (!userId) {
        socket.emit('error', { message: 'Authentication required to chat', code: 'UNAUTHORIZED' })
        return
      }

      const { roomId, message } = payload
      if (!roomId) {
        socket.emit('error', { message: 'Room ID is required', code: 'INVALID_INPUT' })
        return
      }

      const chatMsg = await chatService.sendMessage(roomId, userId, message)

      io.to(roomId).emit('new_message', {
        id: chatMsg.id,
        roomId: chatMsg.room_id,
        senderId: chatMsg.sender_id,
        senderName: chatMsg.sender_name,
        isHost: chatMsg.is_host,
        message: chatMsg.message,
        createdAt: chatMsg.created_at,
      })
    } catch (error: any) {
      socket.emit('error', {
        message: error.message || 'Failed to send message',
        code: error.code || 'SEND_MESSAGE_FAILED',
      })
    }
  })

  socket.on('get_messages', async (payload: GetMessagesPayload) => {
    try {
      const { roomId, limit } = payload
      if (!roomId) return

      const rawMessages = await chatService.getRoomMessages(roomId, limit || 100)

      const messages = rawMessages.map((msg) => ({
        id: msg.id,
        roomId: msg.room_id,
        senderId: msg.sender_id,
        senderName: msg.sender_name,
        isHost: msg.is_host,
        message: msg.message,
        createdAt: msg.created_at,
      }))

      socket.emit('messages_history', { messages })
    } catch (error: any) {
      socket.emit('error', {
        message: error.message || 'Failed to retrieve messages',
        code: 'GET_MESSAGES_FAILED',
      })
    }
  })
}
