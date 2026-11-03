import axios from 'axios'
import { config } from '../config'
import { AppError } from '../middleware/error.middleware'

export interface SearchResult {
  videoId: string
  title: string
  artist: string
  duration: number
  thumbnails: {
    default: string
    medium: string
    high: string
  }
  musicVideoId?: string | null
  hasVideo: boolean
}

interface CacheEntry {
  results: SearchResult[]
  timestamp: number
}

const searchCache = new Map<string, CacheEntry>()
const CACHE_TTL = 5 * 60 * 1000

export async function searchSongs(query: string): Promise<SearchResult[]> {
  const cleanQuery = query.trim()
  const cacheKey = cleanQuery.toLowerCase()

  const cached = searchCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.results
  }

  // Check if query is a direct YouTube / YouTube Music URL
  const urlMatch =
    cleanQuery.match(/(?:music\.youtube\.com|youtube\.com)\/watch\?v=([a-zA-Z0-9_-]{11})/i) ||
    cleanQuery.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/i)
  const targetVideoId = urlMatch ? urlMatch[1] : null

  // 1. Primary: Native YouTube Music WEB_REMIX API
  try {
    const results = await searchYouTubeMusicNative(targetVideoId || cleanQuery)
    if (results && results.length > 0) {
      searchCache.set(cacheKey, {
        results,
        timestamp: Date.now(),
      })
      return results
    }
  } catch (err) {
    console.warn('[Search] YouTube Music native search failed, falling back:', err instanceof Error ? err.message : err)
  }

  // 2. Secondary Fallback: YouTube HTML Scraper with Video Mode tagging
  try {
    const fallbackResponse = await axios.get('https://www.youtube.com/results', {
      params: { search_query: targetVideoId ? targetVideoId : `${cleanQuery} music` },
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      },
      timeout: 8000,
    })

    const html = fallbackResponse.data as string
    const results = parseYoutubeHtml(html, cleanQuery)

    searchCache.set(cacheKey, {
      results,
      timestamp: Date.now(),
    })

    return results
  } catch {
    throw new AppError('Failed to search songs', 502, 'SEARCH_FAILED')
  }
}

async function searchYouTubeMusicNative(searchQuery: string): Promise<SearchResult[]> {
  const response = await axios.post(
    'https://music.youtube.com/youtubei/v1/search',
    {
      context: {
        client: {
          clientName: 'WEB_REMIX',
          clientVersion: '1.20240101.01.00',
          hl: 'en',
          gl: 'US',
        },
      },
      query: searchQuery,
    },
    {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Referer: 'https://music.youtube.com/',
      },
      timeout: 8000,
    }
  )

  const results: SearchResult[] = []
  const tab = response.data?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer
  const sections = tab?.content?.sectionListRenderer?.contents || []

  // Check top card for official video counterpart
  let cardMusicVideoId: string | null = null
  let cardTitle = ''
  const card = sections[0]?.musicCardShelfRenderer
  if (card) {
    const subtitle = card.subtitle?.runs?.map((r: any) => r.text).join('') || ''
    const vid = card.title?.runs?.[0]?.navigationEndpoint?.watchEndpoint?.videoId
    if (
      vid &&
      (subtitle.toLowerCase().includes('video') ||
        card.title?.runs?.[0]?.text?.toLowerCase().includes('video'))
    ) {
      cardMusicVideoId = vid
      cardTitle = card.title?.runs?.[0]?.text || ''
    }
  }

  for (const s of sections) {
    const items =
      s.itemSectionRenderer?.contents ||
      (s.musicShelfRenderer ? s.musicShelfRenderer.contents : [])
    if (!items || !Array.isArray(items)) continue

    for (const it of items) {
      const r = it.musicResponsiveListItemRenderer
      if (!r) continue

      const flexCols = r.flexColumns || []
      const titleRun = flexCols[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]
      const bylineRuns = flexCols[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || []
      const byline = bylineRuns.map((x: any) => x.text).join('')

      const videoId =
        titleRun?.navigationEndpoint?.watchEndpoint?.videoId ||
        r.playlistItemData?.videoId
      if (!videoId) continue

      const title = titleRun?.text || 'Unknown Title'
      const isVideo = byline.toLowerCase().includes('video')

      // Extract duration from byline or fixed columns if present
      let duration = 210
      const durationRun = bylineRuns.find((x: any) => /^\d+:\d+(?::\d+)?$/.test(x.text?.trim()))
      if (durationRun) {
        duration = parseDuration(durationRun.text.trim())
      }

      // Extract artist from byline (skip "Song • " or "Video • ")
      let artist = 'Unknown Artist'
      for (const run of bylineRuns) {
        const text = run.text?.trim()
        if (text && text !== '•' && !text.toLowerCase().includes('song') && !text.toLowerCase().includes('video') && !text.includes(':')) {
          artist = text
          break
        }
      }

      const thumbs = r.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails || []
      const defaultThumb = thumbs[0]?.url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
      const highThumb = thumbs[thumbs.length - 1]?.url || defaultThumb

      let counterpartId: string | null = null
      let hasVideo = false

      if (isVideo) {
        counterpartId = videoId
        hasVideo = true
      } else if (
        cardMusicVideoId &&
        (title.toLowerCase().includes(cardTitle.slice(0, 10).toLowerCase()) ||
          cardTitle.toLowerCase().includes(title.slice(0, 10).toLowerCase()))
      ) {
        counterpartId = cardMusicVideoId
        hasVideo = true
      }

      results.push({
        videoId,
        title,
        artist,
        duration,
        thumbnails: {
          default: defaultThumb,
          medium: defaultThumb,
          high: highThumb,
        },
        musicVideoId: counterpartId,
        hasVideo,
      })
    }
  }

  return results.slice(0, 20)
}

function parseYoutubeHtml(html: string, _query: string): SearchResult[] {
  const results: SearchResult[] = []

  try {
    const regex = /(?:var\s+ytInitialData\s*=\s*|window\[['"]ytInitialData['"]\]\s*=)(.+?)(?:;|\s*<\/script>)/s
    const match = html.match(regex)

    if (match && match[1]) {
      const data = JSON.parse(match[1])
      const contents =
        data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || []

      for (const section of contents) {
        const items = section?.itemSectionRenderer?.contents || []
        for (const item of items) {
          const video = item?.videoRenderer
          if (!video) continue

          const videoId = video.videoId
          const title = video.title?.runs?.[0]?.text || 'Unknown Title'
          const artist = video.ownerText?.runs?.[0]?.text || 'Unknown Artist'
          const lengthText = video.lengthText?.simpleText || ''
          const duration = parseDuration(lengthText)

          const thumbnails = video.thumbnail?.thumbnails || []
          const defaultThumb = thumbnails[0]?.url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
          const highThumb = thumbnails[thumbnails.length - 1]?.url || defaultThumb

          const isMusicVideo =
            title.toLowerCase().includes('official video') ||
            title.toLowerCase().includes('official music video') ||
            title.toLowerCase().includes('music video')

          results.push({
            videoId,
            title,
            artist,
            duration,
            thumbnails: {
              default: defaultThumb,
              medium: defaultThumb,
              high: highThumb,
            },
            musicVideoId: isMusicVideo ? videoId : null,
            hasVideo: isMusicVideo,
          })
        }
      }
    }
  } catch {
    // Fallback parsing failed
  }

  return results
}

function parseDuration(duration: string): number {
  if (!duration) return 0

  const parts = duration.split(':').map(Number)
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2]
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1]
  }
  return parts[0] || 0
}

export function clearSearchCache(): void {
  searchCache.clear()
}
