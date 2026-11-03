import fs from 'fs'
import path from 'path'
import { config } from '../../config'
import { ApiProvider, ApiUsageMetrics } from './types'

const METRICS_FILE_PATH = path.join(process.cwd(), 'data', 'api_usage_metrics.json')

class CostAndUsageTracker {
  private metrics: ApiUsageMetrics

  constructor() {
    this.metrics = this.loadMetrics()
  }

  private loadMetrics(): ApiUsageMetrics {
    try {
      if (fs.existsSync(METRICS_FILE_PATH)) {
        const raw = fs.readFileSync(METRICS_FILE_PATH, 'utf8')
        return JSON.parse(raw)
      }
    } catch {
      // ignore
    }

    return {
      startTime: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      appEnv: config.appEnv,
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      callsByProvider: {
        yt_music_native: 0,
        youtube_data_v3: 0,
        apify_actor: 0,
        gemini_ai: 0,
        cache: 0,
      },
      estimatedCostUsd: 0,
      costSavedUsd: 0,
      apifyRunsCount: 0,
      apifyRunsLimit: config.apify.maxDailyRuns,
      youtubeQuotaUnitsUsed: 0,
      youtubeQuotaLimit: 10000,
    }
  }

  private saveMetrics(): void {
    try {
      const dir = path.dirname(METRICS_FILE_PATH)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      this.metrics.lastUpdated = new Date().toISOString()
      fs.writeFileSync(METRICS_FILE_PATH, JSON.stringify(this.metrics, null, 2), 'utf8')
    } catch (err) {
      console.warn('[CostTracker] Failed to save metrics file:', err)
    }
  }

  recordRequest(provider: ApiProvider, cacheHit: boolean = false, unitsOrCost?: { apifyCharged?: number; youtubeUnits?: number }): void {
    this.metrics.totalRequests++
    if (cacheHit) {
      this.metrics.cacheHits++
      this.metrics.callsByProvider.cache = (this.metrics.callsByProvider.cache || 0) + 1
      // Every cache hit avoids an external API call, saving ~0.004 USD on Apify or 100 quota units
      this.metrics.costSavedUsd = Number((this.metrics.costSavedUsd + 0.004).toFixed(4))
    } else {
      this.metrics.cacheMisses++
      this.metrics.callsByProvider[provider] = (this.metrics.callsByProvider[provider] || 0) + 1

      if (provider === 'apify_actor') {
        this.metrics.apifyRunsCount++
        const costPerRun = unitsOrCost?.apifyCharged ?? 0.008 // estimated per event
        this.metrics.estimatedCostUsd = Number((this.metrics.estimatedCostUsd + costPerRun).toFixed(4))
      } else if (provider === 'youtube_data_v3') {
        const units = unitsOrCost?.youtubeUnits ?? 100 // 100 for search, 1 for video details
        this.metrics.youtubeQuotaUnitsUsed += units
      }
    }

    this.saveMetrics()
  }

  canRunApify(): boolean {
    return this.metrics.apifyRunsCount < this.metrics.apifyRunsLimit
  }

  getMetrics(): ApiUsageMetrics {
    return { ...this.metrics }
  }
}

export const costTracker = new CostAndUsageTracker()
