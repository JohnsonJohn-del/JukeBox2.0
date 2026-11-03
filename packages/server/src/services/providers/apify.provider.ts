import axios from 'axios'
import { config } from '../../config'
import { ProviderSearchResult } from './types'
import { costTracker } from './metrics'

export async function searchWithApify(query: string, maxResults: number = 3): Promise<ProviderSearchResult[]> {
  if (!config.apify.token) {
    throw new Error('Apify API token is not configured')
  }

  if (!costTracker.canRunApify()) {
    console.warn('[Apify] Daily run limit reached in testing mode. Using fallback.')
    return fetchApifyDatasetItems(config.apify.defaultDatasetId)
  }

  const actorId = config.apify.actorId || 'h7sDV53CddomktSi5'
  const endpoint = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${config.apify.token}`

  console.log(`[Apify] Executing actor ${actorId} for query: "${query}" (limit: ${maxResults})`)

  try {
    const response = await axios.post(
      endpoint,
      {
        searchQueries: [query],
        maxResults,
        aiVideoDescription: false,
        aiVideoSummary: false,
        transcriptionAndSubtitle: 'NONE',
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 25000,
      }
    )

    const items = Array.isArray(response.data) ? response.data : []
    const results: ProviderSearchResult[] = items.map((item: any) => {
      const videoId = item.id || ''
      const duration = parseDurationString(item.duration)

      return {
        videoId,
        title: item.title || 'Unknown Title',
        artist: item.channelName || 'YouTube Artist',
        duration,
        thumbnails: {
          default: item.thumbnailUrl || `https://img.youtube.com/vi/${videoId}/default.jpg`,
          medium: item.thumbnailUrl || `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
          high: item.thumbnailUrl || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        },
        musicVideoId: videoId,
        hasVideo: true,
        provider: 'apify_actor',
      }
    })

    costTracker.recordRequest('apify_actor', false, {
      apifyCharged: Number((items.length * 0.004).toFixed(4)),
    })

    return results
  } catch (err: any) {
    console.error('[Apify] Actor execution error:', err.response?.data || err.message)
    // Fallback to reading the existing run's dataset without creating a new billable run
    return fetchApifyDatasetItems(config.apify.defaultDatasetId)
  }
}

export async function fetchApifyDatasetItems(datasetId: string): Promise<ProviderSearchResult[]> {
  try {
    const endpoint = `https://api.apify.com/v2/datasets/${datasetId}/items?token=${config.apify.token}&limit=5`
    const response = await axios.get(endpoint, { timeout: 8000 })
    const items = Array.isArray(response.data) ? response.data : []

    return items.map((item: any) => ({
      videoId: item.id || '',
      title: item.title || 'Unknown Title',
      artist: item.channelName || 'YouTube Artist',
      duration: parseDurationString(item.duration),
      thumbnails: {
        default: item.thumbnailUrl || `https://img.youtube.com/vi/${item.id}/default.jpg`,
        medium: item.thumbnailUrl || `https://img.youtube.com/vi/${item.id}/mqdefault.jpg`,
        high: item.thumbnailUrl || `https://img.youtube.com/vi/${item.id}/hqdefault.jpg`,
      },
      musicVideoId: item.id || '',
      hasVideo: true,
      provider: 'apify_actor',
    }))
  } catch (err: any) {
    console.warn('[Apify] Failed to fetch cached dataset:', err.message)
    return []
  }
}

function parseDurationString(dur: string | number | undefined): number {
  if (typeof dur === 'number') return dur
  if (!dur || typeof dur !== 'string') return 180

  const parts = dur.split(':').map((p) => parseInt(p, 10))
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2]
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1]
  }
  return 180
}
