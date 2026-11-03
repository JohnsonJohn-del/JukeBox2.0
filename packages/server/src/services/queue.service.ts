import { v4 as uuidv4 } from 'uuid'
import { getDbClient } from '../config/database'
import { QueueItem } from '../types'
import { AppError } from '../middleware/error.middleware'

interface CooldownEntry {
  count: number
  lastAddedAt: number
}

const userCooldowns = new Map<string, CooldownEntry>()
const COOLDOWN_MS = 30000
const MAX_SONGS_PER_USER = 7

function checkCooldown(roomId: string, userId: string): void {
  const now = Date.now()
  const key = `${roomId}:${userId}`
  const entry = userCooldowns.get(key)

  if (entry) {
    if (now - entry.lastAddedAt < COOLDOWN_MS) {
      throw new AppError(
        'Please wait 30 seconds between adding songs',
        429,
        'COOLDOWN_ACTIVE'
      )
    }

    if (entry.count >= MAX_SONGS_PER_USER) {
      throw new AppError(
        'You can only add up to 7 songs at a time',
        429,
        'MAX_SONGS_REACHED'
      )
    }
  }
}

function updateCooldown(roomId: string, userId: string): void {
  const now = Date.now()
  const key = `${roomId}:${userId}`
  const entry = userCooldowns.get(key)

  if (entry) {
    entry.count += 1
    entry.lastAddedAt = now
  } else {
    userCooldowns.set(key, { count: 1, lastAddedAt: now })
  }
}

export function clearUserCooldown(userId: string): void {
  userCooldowns.delete(userId)
}

export async function addSong(
  roomId: string,
  userId: string,
  songData: {
    videoId: string
    title: string
    artist: string
    duration: number
    thumbnail?: string | null
    musicVideoId?: string | null
    hasVideo?: boolean
  }
): Promise<QueueItem> {
  const db = getDbClient()

  const { data: room } = await db
    .from('rooms')
    .select('id, is_active, host_id')
    .eq('id', roomId)
    .maybeSingle()

  if (!room) {
    throw new AppError('Room not found', 404, 'ROOM_NOT_FOUND')
  }

  if (!room.is_active) {
    throw new AppError('Room is no longer active', 410, 'ROOM_INACTIVE')
  }

  const { data: existingSong } = await db
    .from('queue_items')
    .select('id')
    .eq('room_id', roomId)
    .eq('video_id', songData.videoId)
    .eq('is_played', false)
    .maybeSingle()

  if (existingSong) {
    throw new AppError('This song is already in the queue', 409, 'DUPLICATE_SONG')
  }

  const isHost = room.host_id === userId
  if (!isHost) {
    checkCooldown(roomId, userId)
  }

  const { data: maxPosition } = await db
    .from('queue_items')
    .select('position')
    .eq('room_id', roomId)
    .eq('is_played', false)
    .order('position', { ascending: false })
    .limit(1)

  const nextPosition = maxPosition && maxPosition.length > 0 ? maxPosition[0].position + 1 : 0

  const itemId = uuidv4()
  const now = new Date().toISOString()

  const { data: item, error: insertError } = await db
    .from('queue_items')
    .insert({
      id: itemId,
      room_id: roomId,
      added_by: userId,
      video_id: songData.videoId,
      music_video_id: songData.musicVideoId || null,
      has_video: Boolean(songData.hasVideo),
      title: songData.title,
      artist: songData.artist,
      duration: songData.duration,
      thumbnail: songData.thumbnail || null,
      position: nextPosition,
      is_played: false,
      added_at: now,
    })
    .select('*')
    .single()

  if (insertError || !item) {
    throw new AppError('Failed to add song', 500, 'ADD_SONG_FAILED')
  }

  updateCooldown(roomId,userId)

  return item
}

export async function removeSong(
  roomId: string,
  itemId: string,
  userId: string
): Promise<void> {
  const db = getDbClient()

  const { data: room } = await db
    .from('rooms')
    .select('id, is_active, host_id')
    .eq('id', roomId)
    .maybeSingle()

  if (!room) {
    throw new AppError('Room not found', 404, 'ROOM_NOT_FOUND')
  }

  if (!room.is_active) {
    throw new AppError('Room is no longer active', 410, 'ROOM_INACTIVE')
  }

  const { data: item } = await db
    .from('queue_items')
    .select('*')
    .eq('id', itemId)
    .eq('room_id', roomId)
    .maybeSingle()

  if (!item) {
    throw new AppError('Song not found in queue', 404, 'SONG_NOT_FOUND')
  }

  if (item.added_by !== userId) {
    const { data: member } = await db
      .from('room_members')
      .select('is_host')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .maybeSingle()

    if (!member || !member.is_host) {
      throw new AppError('Only the host or the person who added the song can remove it', 403, 'NOT_AUTHORIZED')
    }
  }

  const { error: deleteError } = await db
    .from('queue_items')
    .delete()
    .eq('id', itemId)
    .eq('room_id', roomId)

  if (deleteError) {
    throw new AppError('Failed to remove song', 500, 'REMOVE_FAILED')
  }

  await renumberPositions(roomId)
}

export async function reorderQueue(
  roomId: string,
  itemId: string,
  newIndex: number,
  userId: string
): Promise<QueueItem[]> {
  const db = getDbClient()

  const { data: room } = await db
    .from('rooms')
    .select('host_id, is_active')
    .eq('id', roomId)
    .maybeSingle()

  if (!room) {
    throw new AppError('Room not found', 404, 'ROOM_NOT_FOUND')
  }

  if (!room.is_active) {
    throw new AppError('Room is no longer active', 410, 'ROOM_INACTIVE')
  }

  if (room.host_id !== userId) {
    throw new AppError('Only the host can reorder the queue', 403, 'NOT_HOST')
  }

  const { data: queue, error: fetchError } = await db
    .from('queue_items')
    .select('*')
    .eq('room_id', roomId)
    .eq('is_played', false)
    .order('position', { ascending: true })

  if (fetchError || !queue) {
    throw new AppError('Failed to fetch queue', 500, 'FETCH_FAILED')
  }

  const itemIndex = queue.findIndex((q: any) => q.id === itemId)
  if (itemIndex === -1) {
    throw new AppError('Song not found in queue', 404, 'SONG_NOT_FOUND')
  }

  if (newIndex < 0 || newIndex >= queue.length) {
    throw new AppError('Invalid position', 400, 'INVALID_POSITION')
  }

  const [movedItem] = queue.splice(itemIndex, 1)
  queue.splice(newIndex, 0, movedItem)

  for (let i = 0; i < queue.length; i++) {
    if (queue[i].position !== i) {
      await db
        .from('queue_items')
        .update({ position: i })
        .eq('id', queue[i].id)
    }
  }

  const { data: updatedQueue } = await db
    .from('queue_items')
    .select('*')
    .eq('room_id', roomId)
    .eq('is_played', false)
    .order('position', { ascending: true })

  return updatedQueue || []
}

export async function getQueue(roomId: string): Promise<QueueItem[]> {
  const db = getDbClient()

  const { data: queue } = await db
    .from('queue_items')
    .select('*')
    .eq('room_id', roomId)
    .eq('is_played', false)
    .order('position', { ascending: true })

  return queue || []
}

export async function getNextTrack(roomId: string): Promise<QueueItem | null> {
  const db = getDbClient()

  const { data: nextTrack } = await db
    .from('queue_items')
    .select('*')
    .eq('room_id', roomId)
    .eq('is_played', false)
    .order('position', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!nextTrack) return null

  await db
    .from('queue_items')
    .update({ is_played: true })
    .eq('id', nextTrack.id)

  return nextTrack
}

export async function markAsPlayed(queueItemId: string) {
  const db = getDbClient()

  const { error } = await db
    .from('queue_items')
    .update({ is_played: true })
    .eq('id', queueItemId)

  if (error) {
    throw new Error(error.message)
  }
}

async function renumberPositions(roomId: string): Promise<void> {
  const db = getDbClient()

  const { data: queue } = await db
    .from('queue_items')
    .select('id, position')
    .eq('room_id', roomId)
    .eq('is_played', false)
    .order('position', { ascending: true })

  if (queue) {
    for (let i = 0; i < queue.length; i++) {
      if (queue[i].position !== i) {
        await db
          .from('queue_items')
          .update({ position: i })
          .eq('id', queue[i].id)
      }
    }
  }
}

export async function getPreviousTrack(roomId: string, currentTrackId?: string): Promise<QueueItem | null> {
  const db = getDbClient()

  const { data: playedTracks } = await db
    .from('queue_items')
    .select('*')
    .eq('room_id', roomId)
    .eq('is_played', true)
    .order('position', { ascending: false })

  if (!playedTracks || playedTracks.length === 0) return null

  let candidate = playedTracks[0]
  if (currentTrackId && candidate.id === currentTrackId && playedTracks.length > 1) {
    candidate = playedTracks[1]
  }

  if (currentTrackId && candidate.id !== currentTrackId) {
    await db
      .from('queue_items')
      .update({ is_played: false, position: 0 })
      .eq('id', currentTrackId)
  }

  await db
    .from('queue_items')
    .update({ is_played: true })
    .eq('id', candidate.id)

  return candidate
}

export async function reorderQueueBatch(
  roomId: string,
  items: Array<{ id: string; position: number }>,
  userId: string
): Promise<QueueItem[]> {
  const db = getDbClient()

  for (const item of items) {
    await db
      .from('queue_items')
      .update({ position: item.position })
      .eq('id', item.id)
      .eq('room_id', roomId)
  }

  const { data: updatedQueue } = await db
    .from('queue_items')
    .select('*')
    .eq('room_id', roomId)
    .eq('is_played', false)
    .order('position', { ascending: true })

  return updatedQueue || []
}


export async function playSongNow(
  roomId: string,
  userId: string,
  songData: {
    videoId: string
    title: string
    artist: string
    duration: number
    thumbnail?: string | null
    musicVideoId?: string | null
    hasVideo?: boolean
  }
): Promise<QueueItem> {
  const db = getDbClient()
  const itemId = uuidv4()
  const now = new Date().toISOString()

  const { data: existing } = await db
    .from('queue_items')
    .select('*')
    .eq('room_id', roomId)
    .eq('video_id', songData.videoId)
    .maybeSingle()

  if (existing) {
    await db
      .from('queue_items')
      .update({ is_played: true })
      .eq('id', existing.id)
    return { ...existing, is_played: true }
  }

  const { data: item, error } = await db
    .from('queue_items')
    .insert({
      id: itemId,
      room_id: roomId,
      added_by: userId,
      video_id: songData.videoId,
      music_video_id: songData.musicVideoId || null,
      has_video: Boolean(songData.hasVideo),
      title: songData.title,
      artist: songData.artist,
      duration: songData.duration,
      thumbnail: songData.thumbnail || null,
      position: 0,
      is_played: true,
      added_at: now,
    })
    .select('*')
    .single()

  if (error || !item) {
    throw new AppError('Failed to play song', 500, 'PLAY_FAILED')
  }

  return item
}
