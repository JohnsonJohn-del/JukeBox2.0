import { v4 as uuidv4 } from 'uuid'
import { getDbClient } from '../config/database'
import { Room, RoomMember, QueueItem } from '../types'
import { generateRoomCode } from '../utils/roomCode'
import { generateToken } from '../utils/jwt'
import { AppError } from '../middleware/error.middleware'

export async function createRoom(
  hostId: string,
  name?: string
): Promise<{ room: Room; member: RoomMember }> {
  const db = getDbClient()
  const roomId = uuidv4()
  const memberId = uuidv4()
  const now = new Date().toISOString()
  let roomCode = generateRoomCode()

  let isUnique = false
  let attempts = 0
  while (!isUnique && attempts < 10) {
    const { data: existing } = await db
      .from('rooms')
      .select('id')
      .eq('room_code', roomCode)
      .maybeSingle()

    if (!existing) {
      isUnique = true
    } else {
      roomCode = generateRoomCode()
      attempts++
    }
  }

  if (!isUnique) {
    throw new AppError('Failed to generate unique room code', 500, 'ROOM_CODE_FAILED')
  }

  const { data: room, error: roomError } = await db
    .from('rooms')
    .insert({
      id: roomId,
      room_code: roomCode,
      host_id: hostId,
      name: name || null,
      is_active: true,
      current_track_id: null,
      created_at: now,
      updated_at: now,
    })
    .select('*')
    .single()

  if (roomError || !room) {
    throw new AppError('Failed to create room', 500, 'ROOM_CREATE_FAILED')
  }

  const { data: member, error: memberError } = await db
    .from('room_members')
    .insert({
      id: memberId,
      room_id: roomId,
      user_id: hostId,
      nickname: 'Host',
      is_host: true,
      joined_at: now,
      socket_id: null,
    })
    .select('*')
    .single()

  if (memberError || !member) {
    await db.from('rooms').delete().eq('id', roomId)
    throw new AppError('Failed to add host as member', 500, 'MEMBER_CREATE_FAILED')
  }

  return { room, member }
}

export async function joinRoom(
  roomCode: string,
  userId: string,
  nickname: string
): Promise<{ room: Room; member: RoomMember }> {
  const db = getDbClient()

  const { data: room, error: roomError } = await db
    .from('rooms')
    .select('*')
    .eq('room_code', roomCode.toUpperCase())
    .maybeSingle()

  if (roomError) {
    throw new AppError('Database error finding room', 500, 'DB_ERROR')
  }

  if (!room) {
    throw new AppError('Room not found', 404, 'ROOM_NOT_FOUND')
  }

  if (!room.is_active) {
    throw new AppError('Room is no longer active', 410, 'ROOM_INACTIVE')
  }

  const { data: existingMember } = await db
    .from('room_members')
    .select('id')
    .eq('room_id', room.id)
    .eq('user_id', userId)
    .maybeSingle()

  if (existingMember) {
    throw new AppError('You are already in this room', 409, 'ALREADY_MEMBER')
  }

  const memberId = uuidv4()
  const now = new Date().toISOString()

  const { data: member, error: memberError } = await db
    .from('room_members')
    .insert({
      id: memberId,
      room_id: room.id,
      user_id: userId,
      nickname,
      is_host: false,
      joined_at: now,
      socket_id: null,
    })
    .select('*')
    .single()

  if (memberError || !member) {
    throw new AppError('Failed to join room', 500, 'JOIN_FAILED')
  }

  return { room, member }
}


export async function joinRoomAsGuest(
  roomCode: string,
  nickname: string
): Promise<{ room: Room; member: RoomMember; token: string; user: { id: string; username: string; email: string; role: string } }> {
  const db = getDbClient()

  const { data: room, error: roomError } = await db
    .from('rooms')
    .select('*')
    .eq('room_code', roomCode.toUpperCase())
    .maybeSingle()

  if (roomError) {
    throw new AppError('Database error finding room', 500, 'DB_ERROR')
  }

  if (!room) {
    throw new AppError('Room not found', 404, 'ROOM_NOT_FOUND')
  }

  if (!room.is_active) {
    throw new AppError('Room is no longer active', 410, 'ROOM_INACTIVE')
  }

  const guestId = uuidv4()
  const now = new Date().toISOString()
  const guestUser = {
    id: guestId,
    username: `${nickname.trim()}_${guestId.slice(0, 4)}`,
    email: `guest_${guestId}@jukebox.local`,
    password_hash: 'GUEST_EPHEMERAL',
    avatar_url: null,
    created_at: now,
    updated_at: now,
  }

  const { error: userError } = await db.from('users').insert(guestUser)
  if (userError) {
    throw new AppError('Failed to create guest session', 500, 'GUEST_CREATE_FAILED')
  }

  const memberId = uuidv4()
  const { data: member, error: memberError } = await db
    .from('room_members')
    .insert({
      id: memberId,
      room_id: room.id,
      user_id: guestId,
      nickname: nickname.trim(),
      is_host: false,
      joined_at: now,
      socket_id: null,
    })
    .select('*')
    .single()

  if (memberError || !member) {
    throw new AppError('Failed to join room as guest', 500, 'JOIN_FAILED')
  }

  const token = generateToken({ userId: guestId, role: 'guest' as any })

  return {
    room,
    member,
    token,
    user: {
      id: guestId,
      username: guestUser.username,
      email: guestUser.email,
      role: 'guest',
    },
  }
}

export async function leaveRoom(
  roomId: string,
  userId: string
): Promise<void> {
  const db = getDbClient()

  const { data: member } = await db
    .from('room_members')
    .select('*')
    .eq('room_id', roomId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!member) {
    throw new AppError('You are not a member of this room', 403, 'NOT_MEMBER')
  }

  const { error: deleteError } = await db
    .from('room_members')
    .delete()
    .eq('room_id', roomId)
    .eq('user_id', userId)

  if (deleteError) {
    throw new AppError('Failed to leave room', 500, 'LEAVE_FAILED')
  }

  const { data: remainingMembers, error: countError } = await db
    .from('room_members')
    .select('id')
    .eq('room_id', roomId)

  if (!countError && (!remainingMembers || remainingMembers.length === 0)) {
    await db
      .from('rooms')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', roomId)
  }
}

export async function closeRoom(roomId: string): Promise<void> {
  const db = getDbClient()
  await db
    .from('rooms')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', roomId)
  await db
    .from('room_members')
    .delete()
    .eq('room_id', roomId)
}

export async function getRoom(roomId: string): Promise<{
  room: Room | null
  members: RoomMember[]
  queue: QueueItem[]
  playback?: any
}> {
  const db = getDbClient()

  const { data: room } = await db
    .from('rooms')
    .select('*')
    .eq('id', roomId)
    .maybeSingle()

  const { data: members } = await db
    .from('room_members')
    .select('*')
    .eq('room_id', roomId)
    .order('joined_at', { ascending: true })

  const { data: queue } = await db
    .from('queue_items')
    .select('*')
    .eq('room_id', roomId)
    .eq('is_played', false)
    .order('position', { ascending: true })

  let playback: any = null
  try {
    const { getPlaybackState } = require('../sockets/playback.socket')
    playback = getPlaybackState(roomId)
  } catch {
    if (room) {
      let pos = (room as any).playback_position || 0
      if ((room as any).playback_state === 'playing' && (room as any).playback_updated_at) {
        pos += Math.max(0, (Date.now() - Number((room as any).playback_updated_at)) / 1000)
      }
      playback = {
        currentTrack: (room as any).current_track || null,
        playbackState: (room as any).playback_state || 'stopped',
        playbackPosition: pos,
        isVideoMode: (room as any).is_video_mode !== false,
      }
    }
  }

  return {
    room: room || null,
    members: members || [],
    queue: queue || [],
    playback,
  }
}

export async function getRoomByCode(code: string): Promise<Room | null> {
  const db = getDbClient()

  const { data: room } = await db
    .from('rooms')
    .select('*')
    .eq('room_code', code.toUpperCase())
    .eq('is_active', true)
    .maybeSingle()

  return room || null
}

export async function transferHost(
  roomId: string,
  newHostId: string
): Promise<void> {
  const db = getDbClient()

  const { data: room } = await db
    .from('rooms')
    .select('*')
    .eq('id', roomId)
    .maybeSingle()

  if (!room) {
    throw new AppError('Room not found', 404, 'ROOM_NOT_FOUND')
  }

  const { data: newHost } = await db
    .from('room_members')
    .select('*')
    .eq('room_id', roomId)
    .eq('user_id', newHostId)
    .maybeSingle()

  if (!newHost) {
    throw new AppError('New host is not a member of this room', 400, 'NOT_MEMBER')
  }

  await db
    .from('room_members')
    .update({ is_host: false })
    .eq('room_id', roomId)
    .eq('is_host', true)

  await db
    .from('room_members')
    .update({ is_host: true })
    .eq('id', newHost.id)

  await db
    .from('rooms')
    .update({ host_id: newHostId, updated_at: new Date().toISOString() })
    .eq('id', roomId)
}

export async function endRoom(
  roomId: string,
  userId: string
): Promise<void> {
  const db = getDbClient()

  const { data: room } = await db
    .from('rooms')
    .select('*')
    .eq('id', roomId)
    .maybeSingle()

  if (!room) {
    throw new AppError('Room not found', 404, 'ROOM_NOT_FOUND')
  }

  if (room.host_id !== userId) {
    throw new AppError('Only the host can end the room', 403, 'NOT_HOST')
  }

  await db
    .from('rooms')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', roomId)

  await db
    .from('queue_items')
    .delete()
    .eq('room_id', roomId)
}

export async function getRoomMembers(roomId: string): Promise<RoomMember[]> {
  const db = getDbClient()

  const { data: members } = await db
    .from('room_members')
    .select('*')
    .eq('room_id', roomId)
    .order('joined_at', { ascending: true })

  return members || []
}

export async function getActiveRooms(userId: string): Promise<Room[]> {
  const db = getDbClient()

  const { data: memberships } = await db
    .from('room_members')
    .select('room_id')
    .eq('user_id', userId)

  if (!memberships || memberships.length === 0) {
    return []
  }

  const roomIds = memberships.map((m: any) => m.room_id)

  const { data: rooms } = await db
    .from('rooms')
    .select('*')
    .in('id', roomIds)
    .eq('is_active', true)
    .order('updated_at', { ascending: false })

  return rooms || []
}

export async function updateSocketId(
  roomId: string,
  userId: string,
  socketId: string | null
): Promise<void> {
  const db = getDbClient()

  await db
    .from('room_members')
    .update({ socket_id: socketId })
    .eq('room_id', roomId)
    .eq('user_id', userId)
}
