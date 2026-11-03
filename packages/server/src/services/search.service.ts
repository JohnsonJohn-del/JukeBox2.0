import axios from 'axios'
import { config } from '../config'
import { AppError } from '../middleware/error.middleware'
import { ProviderSearchResult } from './providers/types'
import { apiCache } from './providers/cache'
import { costTracker } from './providers/metrics'
import { searchWithYouTubeDataApi } from './providers/youtubeData.provider'
import { searchWithApify } from './providers/apify.provider'

export type SearchResult = ProviderSearchResult

export async function searchSongs(query: string): Promise<SearchResult[]> {
  const cleanQuery = query.trim()
  if (!cleanQuery) return []

  // Check if query is a direct YouTube / YouTube Music URL
  const urlMatch =
    cleanQuery.match(/(?:music\.youtube\.com|youtube\.com)\/watch\?v=([a-zA-Z0-9_-]{11})/i) ||
    cleanQuery.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/i)
  const targetVideoId = urlMatch ? urlMatch[1] : null
  const effectiveQuery = targetVideoId || cleanQuery

  return apiCache.deduplicate(effectiveQuery, async () => {
    // ─── TIER 1: Native YouTube Music WEB_REMIX API (Cost: $0.00, Native Video Association) ───
    try {
      const nativeResults = await searchYouTubeMusicNative(effectiveQuery)
      if (nativeResults && nativeResults.length > 0) {
        costTracker.recordRequest('yt_music_native', false)
        apiCache.set(effectiveQuery, nativeResults, 'yt_music_native')
        return nativeResults
      }
    } catch (err: any) {
      console.warn('[Search] Tier 1 (YouTube Music Native) failed, attempting Tier 2:', err.message)
    }

    // ─── TIER 2: Official Google YouTube Data API v3 (Cost: 100 quota units / 10k free daily) ───
    if (config.youtube.apiKey) {
      try {
        const v3Results = await searchWithYouTubeDataApi(effectiveQuery, 5)
        if (v3Results && v3Results.length > 0) {
          apiCache.set(effectiveQuery, v3Results, 'youtube_data_v3')
          return v3Results
        }
      } catch (err: any) {
        console.warn('[Search] Tier 2 (YouTube Data API v3) failed, attempting Tier 3:', err.message)
      }
    }

    // ─── TIER 3: Apify Actor Scraper (Cost: $0.004 per video, strictly gated in testing mode) ───
    if (config.apify.token && costTracker.canRunApify()) {
      try {
        const apifyResults = await searchWithApify(effectiveQuery, 3)
        if (apifyResults && apifyResults.length > 0) {
          apiCache.set(effectiveQuery, apifyResults, 'apify_actor')
          return apifyResults
        }
      } catch (err: any) {
        console.warn('[Search] Tier 3 (Apify Actor) failed, attempting Tier 4 fallback:', err.message)
      }
    }

    // ─── TIER 4: Local HTML Scraper Fallback ───
    try {
      const fallbackResponse = await axios.get('https://www.youtube.com/results', {
        params: { search_query: `${effectiveQuery} music` },
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        },
        timeout: 8000,
      })

      const html = fallbackResponse.data as string
      const results = parseYoutubeHtml(html, effectiveQuery)
      if (results.length > 0) {
        apiCache.set(effectiveQuery, results, 'html_scraper_fallback')
        return results
      }
    } catch {
      // Fallback failed
    }

    throw new AppError('Failed to search songs across all providers', 502, 'SEARCH_FAILED')
  })
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
          gl: 'IN',
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

  const sections =
    response.data?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content
      ?.sectionListRenderer?.contents || []

  const rawItems: Array<{
    videoId: string
    title: string
    artist: string
    duration: number
    thumbnails: { default: string; medium: string; high: string }
    isVideo: boolean
  }> = []

  let cardMusicVideoId: string | null = null
  let cardTitle: string = ''

  for (const section of sections) {
    const cardRenderer = section?.musicCardShelfRenderer
    if (cardRenderer) {
      const cardTitleText = cardRenderer.title?.runs?.[0]?.text || ''
      cardTitle = cardTitleText
      const cardButtons = cardRenderer.buttons || []
      for (const btn of cardButtons) {
        const watchEp =
          btn?.buttonRenderer?.navigationEndpoint?.watchEndpoint ||
          btn?.menuRenderer?.topLevelButtons?.[0]?.buttonRenderer?.navigationEndpoint?.watchEndpoint
        if (watchEp?.videoId) {
          cardMusicVideoId = watchEp.videoId
          break
        }
      }
    }

    const shelf = section?.musicShelfRenderer
    if (!shelf) continue

    const contents = shelf.contents || []
    for (const item of contents) {
      const r = item.musicResponsiveListItemRenderer
      if (!r) continue

      const flexCols = r.flexColumns || []
      const titleRun = flexCols[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]
      const bylineRuns = flexCols[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || []
      const byline = bylineRuns.map((x: any) => x.text).join('')

      const videoId =
        r.onTap?.watchEndpoint?.videoId ||
        titleRun?.navigationEndpoint?.watchEndpoint?.videoId ||
        r.playlistItemData?.videoId
      if (!videoId) continue

      const title = titleRun?.text || 'Unknown Title'
      const isVideo = byline.toLowerCase().includes('video') || title.toLowerCase().includes('video')

      let duration = 210
      const durationRun = bylineRuns.find((x: any) => /^\d+:\d+(?::\d+)?$/.test(x.text?.trim()))
      if (durationRun) {
        duration = parseDuration(durationRun.text.trim())
      }

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

      rawItems.push({
        videoId,
        title,
        artist,
        duration,
        thumbnails: {
          default: defaultThumb,
          medium: defaultThumb,
          high: highThumb,
        },
        isVideo,
      })
    }
  }

  // Two-pass counterpart linking
  const videos = rawItems.filter((item) => item.isVideo)
  const results: SearchResult[] = []

  for (const item of rawItems) {
    let counterpartId: string | null = null
    let hasVideo = false

    if (item.isVideo) {
      counterpartId = item.videoId
      hasVideo = true
    } else {
      const cleanSongTitle = item.title.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim()
      const songWords = cleanSongTitle.split(/\s+/).filter((w) => w.length > 2)

      const matchingVideo = videos.find((v) => {
        const cleanVidTitle = v.title.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim()
        const matchCount = songWords.filter((w) => cleanVidTitle.includes(w)).length
        return matchCount >= Math.min(2, Math.max(1, songWords.length))
      })

      if (matchingVideo) {
        counterpartId = matchingVideo.videoId
        hasVideo = true
      } else if (
        cardMusicVideoId &&
        (item.title.toLowerCase().includes(cardTitle.slice(0, 10).toLowerCase()) ||
          cardTitle.toLowerCase().includes(item.title.slice(0, 10).toLowerCase()))
      ) {
        counterpartId = cardMusicVideoId
        hasVideo = true
      }
    }

    results.push({
      videoId: item.videoId,
      title: item.title,
      artist: item.artist,
      duration: item.duration,
      thumbnails: item.thumbnails,
      musicVideoId: counterpartId,
      hasVideo,
      provider: 'yt_music_native',
    })
  }

  return results.slice(0, 25)
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
            title.toLowerCase().includes('music video') ||
            title.toLowerCase().includes('lyric video')

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
            provider: 'yt_music_native',
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
  // Clears in-memory and metrics cache
}
