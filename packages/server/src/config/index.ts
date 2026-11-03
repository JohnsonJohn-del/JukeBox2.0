import dotenv from 'dotenv'
import path from 'path'

// Load environment variables from packages/server/.env or root .env
dotenv.config({ path: path.resolve(__dirname, '../.env') })
dotenv.config({ path: path.resolve(__dirname, '../../.env') })
dotenv.config({ path: path.resolve(process.cwd(), '.env') })
dotenv.config({ path: path.resolve(process.cwd(), 'packages/server/.env') })

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  appEnv: process.env.APP_ENV || 'testing',

  database: {
    url: process.env.DATABASE_URL || '',
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
    supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY || '',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'jukebox-secret-key-2026-production-validation-token',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000,https://client-delta-rose-86.vercel.app',
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  },

  ytMusic: {
    apiUrl: process.env.YT_MUSIC_API_URL || 'http://localhost:5000',
  },

  youtube: {
    apiKey: process.env.YOUTUBE_API_KEY || '',
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
  },

  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
  },

  apify: {
    token: process.env.APIFY_TOKEN || '',
    actorId: process.env.APIFY_ACTOR_ID || 'h7sDV53CddomktSi5',
    defaultRunId: process.env.APIFY_DEFAULT_RUN_ID || 'MnQgiY1dbWqaCOaLc',
    defaultDatasetId: process.env.APIFY_DEFAULT_DATASET_ID || '8OpgV2W2M0mlfZmBh',
    maxDailyRuns: parseInt(process.env.APIFY_MAX_DAILY_RUNS || '10', 10),
  },

  costOptimization: {
    enabled: process.env.ENABLE_COST_OPTIMIZER !== 'false',
    cacheTtlMs: parseInt(process.env.CACHE_TTL_MS || '86400000', 10),
    testingDurationHours: parseInt(process.env.TESTING_MODE_DURATION_HOURS || '24', 10),
  },

  logLevel: process.env.LOG_LEVEL || 'info',

  isDev: (process.env.NODE_ENV || 'development') === 'development',
  isProd: process.env.NODE_ENV === 'production',
  isTesting: (process.env.APP_ENV || 'testing') === 'testing',
} as const
