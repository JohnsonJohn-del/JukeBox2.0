import { Request, Response, NextFunction } from 'express'
import * as roomService from '../services/room.service'
import * as chatService from '../services/chat.service'
import { formatResponse, formatError } from '../utils/helpers'

export async function createRoom(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json(formatError('Authentication required', 'AUTH_REQUIRED'))
      return
    }

    const { name } = req.body
    const result = await roomService.createRoom(req.user.userId, name)
    res.status(201).json(formatResponse(result, 'Room created successfully'))
  } catch (error) {
    next(error)
  }
}

export async function joinRoom(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { roomCode, nickname } = req.body
    if (!roomCode || !nickname) {
      res.status(400).json(formatError('Room code and nickname are required', 'VALIDATION_ERROR'))
      return
    }

    if (req.user) {
      const result = await roomService.joinRoom(roomCode, req.user.userId, nickname)
      res.json(formatResponse(result, 'Joined room successfully'))
    } else {
      const result = await roomService.joinRoomAsGuest(roomCode, nickname)
      res.json(formatResponse(result, 'Joined room as guest successfully'))
    }
  } catch (error) {
    next(error)
  }
}

export async function getRoom(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params
    const result = await roomService.getRoom(id)

    if (!result.room) {
      res.status(404).json(formatError('Room not found', 'NOT_FOUND'))
      return
    }

    res.json(formatResponse(result))
  } catch (error) {
    next(error)
  }
}

export async function leaveRoom(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json(formatError('Authentication required', 'AUTH_REQUIRED'))
      return
    }

    const { id } = req.params
    await roomService.leaveRoom(id, req.user.userId)
    res.json(formatResponse(null, 'Left room successfully'))
  } catch (error) {
    next(error)
  }
}

export async function transferHost(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json(formatError('Authentication required', 'AUTH_REQUIRED'))
      return
    }

    const { id } = req.params
    const { newHostId } = req.body
    await roomService.transferHost(id, newHostId)
    res.json(formatResponse(null, 'Host transferred successfully'))
  } catch (error) {
    next(error)
  }
}

export async function getActiveRooms(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json(formatError('Authentication required', 'AUTH_REQUIRED'))
      return
    }

    const rooms = await roomService.getActiveRooms(req.user.userId)
    res.json(formatResponse(rooms))
  } catch (error) {
    next(error)
  }
}

export async function endRoom(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json(formatError('Authentication required', 'AUTH_REQUIRED'))
      return
    }

    const { id } = req.params
    await roomService.endRoom(id, req.user.userId)
    res.json(formatResponse(null, 'Room ended successfully'))
  } catch (error) {
    next(error)
  }
}

export async function getRoomByCode(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { code } = req.params
    const room = await roomService.getRoomByCode(code)
    if (!room) {
      res.status(404).json(formatError('Room not found or inactive', 'ROOM_NOT_FOUND'))
      return
    }
    res.json(formatResponse({ room }))
  } catch (error) {
    next(error)
  }
}

export async function getRoomMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params
    const limit = req.query.limit ? Number(req.query.limit) : 100
    const rawMessages = await chatService.getRoomMessages(id, limit)
    const messages = rawMessages.map((msg) => ({
      id: msg.id,
      roomId: msg.room_id,
      senderId: msg.sender_id,
      senderName: msg.sender_name,
      isHost: msg.is_host,
      message: msg.message,
      createdAt: msg.created_at,
    }))
    res.json(formatResponse({ messages }))
  } catch (error) {
    next(error)
  }
}

export async function sendRoomMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json(formatError('Authentication required', 'AUTH_REQUIRED'))
      return
    }
    const { id } = req.params
    const { message } = req.body
    const msg = await chatService.sendMessage(id, req.user.userId, message)
    res.json(formatResponse({
      message: {
        id: msg.id,
        roomId: msg.room_id,
        senderId: msg.sender_id,
        senderName: msg.sender_name,
        isHost: msg.is_host,
        message: msg.message,
        createdAt: msg.created_at,
      }
    }))
  } catch (error) {
    next(error)
  }
}
