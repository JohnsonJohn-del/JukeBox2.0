import fs from 'fs'
import path from 'path'
import { config } from '../../config'
import { ProviderSearchResult } from './types'
import { costTracker } from './metrics'

const CACHE_FILE_PATH = path.join(process.cwd(), 'data', 'api_cache.json')

interface CacheRecord {
  results: ProviderSearchResult[]
  timestamp: number
  provider: string
}

class ApiCacheManager {
  private cache: Map<string, CacheRecord> = new Map()
  private inFlightRequests: Map<string, Promise<ProviderSearchResult[]>> = new Map()
  private ttl: number

  constructor() {
    this.ttl = config.costOptimization.cacheTtlMs || 24 * 60 * 60 * 1000
    this.loadCache()
  }

  private loadCache(): void {
    try {
      if (fs.existsSync(CACHE_FILE_PATH)) {
        const raw = fs.readFileSync(CACHE_FILE_PATH, 'utf8')
        const data = JSON.parse(raw) as Record<string, CacheRecord>
        const now = Date.now()

        for (const [key, value] of Object.entries(data)) {
          if (now - value.timestamp < this.ttl) {
            this.cache.set(key, value)
          }
        }
        console.log(`[ApiCache] Loaded ${this.cache.size} valid cached query responses`)
      }
    } catch {
      // ignore
    }
  }

  private saveCache(): void {
    try {
      const dir = path.dirname(CACHE_FILE_PATH)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      const data: Record<string, CacheRecord> = {}
      for (const [key, value] of this.cache.entries()) {
        data[key] = value
      }
      fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(data, null, 2), 'utf8')
    } catch (err) {
      console.warn('[ApiCache] Failed to write cache file:', err)
    }
  }

  get(query: string): ProviderSearchResult[] | null {
    const key = query.trim().toLowerCase()
    const entry = this.cache.get(key)

    if (entry && Date.now() - entry.timestamp < this.ttl) {
      costTracker.recordRequest('cache', true)
      return entry.results
    }

    if (entry) {
      this.cache.delete(key)
    }

    return null
  }

  set(query: string, results: ProviderSearchResult[], provider: string): void {
    const key = query.trim().toLowerCase()
    this.cache.set(key, {
      results,
      timestamp: Date.now(),
      provider,
    })
    this.saveCache()
  }

  // Deduplication: wraps an async fetch so concurrent calls for the same query share one execution
  async deduplicate(
    query: string,
    fetcher: () => Promise<ProviderSearchResult[]>
  ): Promise<ProviderSearchResult[]> {
    const key = query.trim().toLowerCase()

    // 1. Check cache first
    const cached = this.get(key)
    if (cached) return cached

    // 2. Check if a request for this query is already in flight
    const existingPromise = this.inFlightRequests.get(key)
    if (existingPromise) {
      console.log(`[ApiCache] Request deduplication applied for: "${query}"`)
      return existingPromise
    }

    // 3. Initiate and track the in-flight promise
    const promise = (async () => {
      try {
        const results = await fetcher()
        return results
      } finally {
        this.inFlightRequests.delete(key)
      }
    })()

    this.inFlightRequests.set(key, promise)
    return promise
  }
}

export const apiCache = new ApiCacheManager()
