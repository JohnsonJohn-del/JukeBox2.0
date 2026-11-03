import axios from 'axios'
import { config } from '../../config'
import { ProviderSearchResult } from './types'
import { costTracker } from './metrics'

export async function searchWithYouTubeDataApi(
  query: string,
  maxResults: number = 5
): Promise<ProviderSearchResult[]> {
  if (!config.youtube.apiKey) {
    throw new Error('YouTube Data API key is not configured')
  }

  const endpoint = 'https://www.googleapis.com/youtube/v3/search'

  try {
    const response = await axios.get(endpoint, {
      params: {
        part: 'snippet',
        type: 'video',
        videoCategoryId: '10', // Music category
        q: query,
        maxResults,
        key: config.youtube.apiKey,
      },
      timeout: 8000,
    })

    const items = response.data?.items || []
    const results: ProviderSearchResult[] = items.map((item: any) => {
      const videoId = item.id?.videoId || ''
      const snippet = item.snippet || {}

      return {
        videoId,
        title: snippet.title || 'Unknown Title',
        artist: snippet.channelTitle || 'YouTube Artist',
        duration: 210, // Default duration estimation before details fetch
        thumbnails: {
          default: snippet.thumbnails?.default?.url || `https://img.youtube.com/vi/${videoId}/default.jpg`,
          medium: snippet.thumbnails?.medium?.url || `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
          high: snippet.thumbnails?.high?.url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        },
        musicVideoId: videoId,
        hasVideo: true,
        provider: 'youtube_data_v3',
      }
    })

    costTracker.recordRequest('youtube_data_v3', false, { youtubeUnits: 100 })
    return results
  } catch (err: any) {
    console.error('[YouTube Data API] Search error:', err.response?.data?.error?.message || err.message)
    throw err
  }
}

export async function checkVideoEmbeddability(videoId: string): Promise<{ isEmbeddable: boolean; title?: string }> {
  if (!config.youtube.apiKey) {
    return { isEmbeddable: true }
  }

  try {
    const response = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
      params: {
        part: 'status,snippet',
        id: videoId,
        key: config.youtube.apiKey,
      },
      timeout: 5000,
    })

    costTracker.recordRequest('youtube_data_v3', false, { youtubeUnits: 1 })

    const item = response.data?.items?.[0]
    if (!item) {
      return { isEmbeddable: false }
    }

    const embeddable = item.status?.embeddable !== false
    return {
      isEmbeddable: embeddable,
      title: item.snippet?.title,
    }
  } catch (err: any) {
    console.warn('[YouTube Data API] Embed check error:', err.message)
    return { isEmbeddable: true } // graceful fallback
  }
}
