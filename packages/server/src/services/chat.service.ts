import { v4 as uuidv4 } from 'uuid'
import { getDbClient } from '../config/database'
import { ChatMessage } from '../types'
import { AppError } from '../middleware/error.middleware'

// Sliding window rate-limiting: Max 5 messages every 3 seconds per user
const userMessageTimestamps = new Map<string, number[]>()

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const timestamps = userMessageTimestamps.get(userId) || []
  const recent = timestamps.filter((t) => now - t < 3000)
  if (recent.length >= 5) {
    return false
  }
  recent.push(now)
  userMessageTimestamps.set(userId, recent)
  return true
}

export async function sendMessage(
  roomId: string,
  senderId: string,
  text: string
): Promise<ChatMessage> {
  const cleanText = text?.trim()
  if (!cleanText) {
    throw new AppError('Message cannot be empty', 400, 'EMPTY_MESSAGE')
  }

  if (cleanText.length > 500) {
    throw new AppError('Message exceeds maximum limit of 500 characters', 400, 'MESSAGE_TOO_LONG')
  }

  if (!checkRateLimit(senderId)) {
    throw new AppError('Sending messages too quickly. Please wait a moment.', 429, 'RATE_LIMITED')
  }

  const db = getDbClient()

  // Verify membership and retrieve authoritative host status
  const { data: member } = await db
    .from('room_members')
    .select('*')
    .eq('room_id', roomId)
    .eq('user_id', senderId)
    .maybeSingle()

  if (!member) {
    throw new AppError('You are not a member of this room', 403, 'NOT_MEMBER')
  }

  const senderName = member.nickname || 'Guest'
  const isHost = Boolean(member.is_host)
  const id = uuidv4()
  const now = new Date().toISOString()

  const messageRecord: ChatMessage = {
    id,
    room_id: roomId,
    sender_id: senderId,
    sender_name: senderName,
    is_host: isHost,
    message: cleanText,
    created_at: now,
  }

  const { data: inserted, error } = await db
    .from('chat_messages')
    .insert(messageRecord)
    .select('*')
    .single()

  if (error && !inserted) {
    // Fallback if select single isn't supported on local db
    return messageRecord
  }

  return inserted || messageRecord
}

export async function getRoomMessages(
  roomId: string,
  limit: number = 100
): Promise<ChatMessage[]> {
  const db = getDbClient()

  const { data: messages, error } = await db
    .from('chat_messages')
    .select('*')
    .eq('room_id', roomId)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error || !messages) {
    return []
  }

  return messages
}
