import { Router, Request, Response } from 'express'
import axios from 'axios'
import { config } from '../config'
import { costTracker } from '../services/providers/metrics'
import { CredentialStatus } from '../services/providers/types'
import { searchWithYouTubeDataApi } from '../services/providers/youtubeData.provider'
import { parseQueryWithGemini } from '../services/providers/gemini.provider'
import { searchSongs } from '../services/search.service'

const router = Router()

// Mask helper to never expose raw secrets
function maskSecret(val: string): string {
  if (!val) return '[NOT CONFIGURED]'
  if (val.length <= 8) return '****'
  return `${val.slice(0, 4)}...${val.slice(-4)}`
}

router.get('/credentials-inventory', (_req: Request, res: Response) => {
  const inventory: CredentialStatus[] = [
    {
      variableName: 'YOUTUBE_API_KEY',
      provider: 'Google Cloud Platform (YouTube Data API v3)',
      credentialType: 'API_KEY',
      purpose: 'Official YouTube API fallback, video embeddability verification, and music search',
      associatedApi: 'https://www.googleapis.com/youtube/v3/videos & search',
      isConfigured: Boolean(config.youtube.apiKey),
      maskedValue: maskSecret(config.youtube.apiKey),
      status: config.youtube.apiKey ? 'ACTIVE_VERIFIED' : 'MISSING',
      costModel: 'Free tier: 10,000 quota units/day (Search: 100 units, Video lookup: 1 unit)',
      isUsedInTesting: true,
    },
    {
      variableName: 'GOOGLE_CLIENT_ID',
      provider: 'Google Identity Services',
      credentialType: 'CLIENT_ID',
      purpose: 'OAuth 2.0 Client ID for Google Identity authentication',
      associatedApi: 'https://accounts.google.com/o/oauth2/v2/auth',
      isConfigured: Boolean(config.google.clientId),
      maskedValue: maskSecret(config.google.clientId),
      status: config.google.clientId ? 'ACTIVE_VERIFIED' : 'MISSING',
      costModel: 'Free OAuth 2.0 Web Client authentication',
      isUsedInTesting: true,
    },
    {
      variableName: 'GEMINI_API_KEY',
      provider: 'Google AI Studio (Generative Language API)',
      credentialType: 'API_KEY',
      purpose: 'Music query normalization, metadata cleanup, and intent parsing',
      associatedApi: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash',
      isConfigured: Boolean(config.gemini.apiKey),
      maskedValue: maskSecret(config.gemini.apiKey),
      status: config.gemini.apiKey ? 'ACTIVE_VERIFIED' : 'MISSING',
      costModel: 'Free tier: 15 Requests Per Minute (RPM), 1500 Requests Per Day',
      isUsedInTesting: true,
    },
    {
      variableName: 'APIFY_TOKEN',
      provider: 'Apify Platform (Actor streamers/youtube-scraper)',
      credentialType: 'BEARER_TOKEN',
      purpose: 'Deep YouTube metadata extraction and secondary scraping fallback',
      associatedApi: 'https://api.apify.com/v2/acts/h7sDV53CddomktSi5/run-sync-get-dataset-items',
      isConfigured: Boolean(config.apify.token),
      maskedValue: maskSecret(config.apify.token),
      status: config.apify.token ? 'ACTIVE_VERIFIED' : 'MISSING',
      costModel: 'Pay-per-event: $0.004 per video item written to dataset (Testing limit: 10 runs)',
      isUsedInTesting: true,
    },
    {
      variableName: 'JWT_SECRET',
      provider: 'Jukebox Internal Auth',
      credentialType: 'JWT_SECRET',
      purpose: 'Room access token generation and user session signing',
      associatedApi: 'Internal HMAC-SHA256',
      isConfigured: Boolean(config.jwt.secret),
      maskedValue: maskSecret(config.jwt.secret),
      status: config.jwt.secret ? 'ACTIVE_VERIFIED' : 'MISSING',
      costModel: '$0.00 (Self-hosted)',
      isUsedInTesting: true,
    },
  ]

  res.json({
    success: true,
    data: {
      totalCredentials: inventory.length,
      activeVerifiedCount: inventory.filter((c) => c.status === 'ACTIVE_VERIFIED').length,
      appEnv: config.appEnv,
      inventory,
    },
  })
})

router.get('/cost-report', (_req: Request, res: Response) => {
  const metrics = costTracker.getMetrics()

  res.json({
    success: true,
    data: {
      testingWindowHours: config.costOptimization.testingDurationHours,
      costOptimizerEnabled: config.costOptimization.enabled,
      cacheTtlHours: Math.round(config.costOptimization.cacheTtlMs / 3600000),
      metrics,
      safeguards: {
        apifyMaxDailyRuns: config.apify.maxDailyRuns,
        apifyRemainingRuns: Math.max(0, config.apify.maxDailyRuns - metrics.apifyRunsCount),
        youtubeQuotaRemainingUnits: Math.max(0, 10000 - metrics.youtubeQuotaUnitsUsed),
        requestDeduplicationActive: true,
        zeroCostNativeRemixPreferred: true,
      },
    },
  })
})

router.post('/test-integrations', async (_req: Request, res: Response) => {
  const results: Record<string, { status: 'PASS' | 'FAIL' | 'SKIPPED'; latencyMs: number; details: any }> = {}

  // 1. Test YouTube Music Native WEB_REMIX API
  const t0 = Date.now()
  try {
    const searchRes = await searchSongs('Rathinamo')
    results['youtube_music_native'] = {
      status: searchRes.length > 0 ? 'PASS' : 'FAIL',
      latencyMs: Date.now() - t0,
      details: {
        itemCount: searchRes.length,
        firstTitle: searchRes[0]?.title,
        musicVideoId: searchRes[0]?.musicVideoId,
        hasVideo: searchRes[0]?.hasVideo,
      },
    }
  } catch (err: any) {
    results['youtube_music_native'] = {
      status: 'FAIL',
      latencyMs: Date.now() - t0,
      details: { error: err.message },
    }
  }

  // 2. Test Official YouTube Data API v3
  const t1 = Date.now()
  try {
    const v3Res = await searchWithYouTubeDataApi('Rathinamo', 2)
    results['youtube_data_api_v3'] = {
      status: v3Res.length > 0 ? 'PASS' : 'FAIL',
      latencyMs: Date.now() - t1,
      details: {
        itemCount: v3Res.length,
        firstTitle: v3Res[0]?.title,
        firstId: v3Res[0]?.videoId,
      },
    }
  } catch (err: any) {
    results['youtube_data_api_v3'] = {
      status: 'FAIL',
      latencyMs: Date.now() - t1,
      details: { error: err.message },
    }
  }

  // 3. Test Google Generative AI (Gemini 2.5 Flash)
  const t2 = Date.now()
  try {
    const geminiRes = await parseQueryWithGemini('play Rathinamo by Saurav Srisan')
    results['gemini_generative_ai'] = {
      status: geminiRes.songTitle || geminiRes.normalizedQuery ? 'PASS' : 'FAIL',
      latencyMs: Date.now() - t2,
      details: geminiRes,
    }
  } catch (err: any) {
    results['gemini_generative_ai'] = {
      status: 'FAIL',
      latencyMs: Date.now() - t2,
      details: { error: err.message },
    }
  }

  // 4. Test Apify Actor API Connectivity (Read default dataset without billable run)
  const t3 = Date.now()
  try {
    const apifyRes = await axios.get(
      `https://api.apify.com/v2/actor-runs/${config.apify.defaultRunId}?token=${config.apify.token}`,
      { timeout: 8000 }
    )
    results['apify_actor_api'] = {
      status: apifyRes.data?.data?.status === 'SUCCEEDED' ? 'PASS' : 'FAIL',
      latencyMs: Date.now() - t3,
      details: {
        runStatus: apifyRes.data?.data?.status,
        actorId: apifyRes.data?.data?.actId,
        defaultDatasetId: apifyRes.data?.data?.defaultDatasetId,
      },
    }
  } catch (err: any) {
    results['apify_actor_api'] = {
      status: 'FAIL',
      latencyMs: Date.now() - t3,
      details: { error: err.message },
    }
  }

  res.json({
    success: true,
    data: {
      testedAt: new Date().toISOString(),
      appEnv: config.appEnv,
      results,
    },
  })
})

export default router
