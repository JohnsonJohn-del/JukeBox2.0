export type ApiProvider = 'yt_music_native' | 'youtube_data_v3' | 'apify_actor' | 'gemini_ai' | 'cache'

export interface ProviderSearchResult {
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
  provider: ApiProvider
}

export interface ApiUsageMetrics {
  startTime: string
  lastUpdated: string
  appEnv: string
  totalRequests: number
  cacheHits: number
  cacheMisses: number
  callsByProvider: Record<ApiProvider, number>
  estimatedCostUsd: number
  costSavedUsd: number
  apifyRunsCount: number
  apifyRunsLimit: number
  youtubeQuotaUnitsUsed: number
  youtubeQuotaLimit: number
}

export interface CredentialStatus {
  variableName: string
  provider: string
  credentialType: 'API_KEY' | 'CLIENT_ID' | 'BEARER_TOKEN' | 'JWT_SECRET' | 'DATABASE_URL'
  purpose: string
  associatedApi: string
  isConfigured: boolean
  maskedValue: string
  status: 'ACTIVE_VERIFIED' | 'CONFIGURED' | 'MISSING'
  costModel: string
  isUsedInTesting: boolean
}
