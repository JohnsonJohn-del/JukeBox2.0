# Cost Optimization & One-Day System Validation Report

**Project**: Jukebox 2.0  
**Testing Mode**: `APP_ENV=testing`  
**Window Duration**: 24 Hours  
**Cost Target**: < $0.10 for entire one-day multi-user validation run  

---

## 1. Cost Control Architecture

During temporary 24-hour validation, uncontrolled API polling or actor scraping can quickly deplete balances. We have implemented a six-layer cost suppression architecture:

### 1. In-Flight Request Deduplication (`cache.ts`)
- If two or more users in the same room (or separate rooms) search for the same artist or track simultaneously, the system joins both client requests onto a single in-flight Promise.
- **Outcome**: Completely eliminates redundant simultaneous external API calls.

### 2. Multi-Tier Persistent 24h Cache (`data/api_cache.json`)
- All song search results, metadata lookups, and associated video identifiers are cached to disk and memory for 24 hours (`CACHE_TTL_MS=86400000`).
- Subsequent requests for popular songs (e.g., "Rathinamo", "Starboy", "Coldplay") are served in < 2ms directly from disk without hitting any external API.
- **Outcome**: Estimated 70–85% reduction in total third-party network requests.

### 3. Apify Daily Run Budget Cap (`metrics.ts`)
- Apify charges $0.004 per video item plus compute unit execution time.
- The server enforces `canRunApify()`:
  - Hard cap of **10 runs per day** (`APIFY_MAX_DAILY_RUNS=10`).
  - Limits `maxResults: 3` per run, keeping each run's cost to ~$0.012.
  - If the cap is reached, Apify calls immediately fall back to reading pre-cached dataset records (`defaultDatasetId=8OpgV2W2M0mlfZmBh`) at $0.00 cost.

### 4. Zero-Cost Primary Route (`yt_music_native`)
- Native YouTube Music Remix API (`https://music.youtube.com/youtubei/v1/search`) is used as the primary engine.
- This endpoint consumes **$0.00 in credits** and requires no billable subscription.

### 5. Localhost Hub File Database (`data/local_jukebox_db.json`)
- Room state, queue items, user accounts, and playback positions are persisted locally in `data/local_jukebox_db.json`.
- Cloud database query fees, egress costs, and connection pooler surcharges are completely eliminated ($0.00 DB bill).

### 6. Event-Driven WebSockets vs. Polling
- Room synchronization, queue updates, and track transitions are handled over persistent WebSocket connections (`socket.io`).
- No continuous HTTP polling or repetitive health check storms.

---

## 2. Estimated 24-Hour Resource Consumption

| Resource / Provider | Pricing Model | Estimated Volume (1 Day) | Estimated Cost (USD) |
| :--- | :--- | :--- | :--- |
| **YouTube Music Native** | Free / Reverse Remix | 150 – 300 queries | **$0.00** |
| **YouTube Data API v3** | 10,000 Free Units / Day | ~2,500 units | **$0.00** |
| **Apify Actor Scraper** | $0.004 / video + compute | Max 3–5 fallback runs | **$0.04 – $0.06** |
| **Google Gemini AI** | Free Tier (1,500 RPD) | ~50 query normalizations | **$0.00** |
| **Local Persistent DB** | Local JSON File Store | Unlimited operations | **$0.00** |
| **Cloudflare Tunnel** | Free Cloudflare Quick Tunnel | Unlimited traffic | **$0.00** |
| **Vercel Edge Hosting** | Free Hobby Tier | Static frontend hosting | **$0.00** |
| **Total Estimated Cost** | — | — | **< $0.08 USD** |

---

## 3. Real-Time Cost & Quota Monitoring

The server exposes real-time telemetry endpoints accessible locally or through the Cloudflare tunnel:

- **Inventory Endpoint**:
  ```
  GET /api/system/credentials-inventory
  ```
  Returns status, masking, provider, and verification state for all credentials.

- **Live Cost Report**:
  ```
  GET /api/system/cost-report
  ```
  Returns:
  ```json
  {
    "success": true,
    "data": {
      "testingWindowHours": 24,
      "costOptimizerEnabled": true,
      "metrics": {
        "totalRequests": 18,
        "cacheHits": 14,
        "cacheMisses": 4,
        "estimatedCostUsd": 0.008,
        "costSavedUsd": 0.056,
        "apifyRunsCount": 1,
        "apifyRunsLimit": 10,
        "youtubeQuotaUnitsUsed": 101,
        "youtubeQuotaLimit": 10000
      }
    }
  }
  ```

---

## 4. End-of-Day Shutdown Instructions

After the 24-hour validation window concludes:
1. Stop background tunnel and node server if no longer needed (`manage_task kill`).
2. The persistent cache file (`data/api_cache.json`) and metrics file (`data/api_usage_metrics.json`) will preserve the full operational history for review.
3. No lingering cloud subscriptions or auto-scaling infrastructure were created; your card or balance will not incur recurring charges.
