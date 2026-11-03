import express from 'express'
import http from 'http'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'
import { config } from './config'
import routes from './routes'
import { errorHandler, notFoundHandler } from './middleware/error.middleware'

const app = express()

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
}))

// Universal CORS allowing Vercel, Cloudflare Tunnels, local development, and mobile devices
app.use(cors({
  origin: (_origin, callback) => {
    callback(null, true)
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}))

app.use(morgan(config.isDev ? 'dev' : 'combined'))
app.use(cookieParser())

const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      message: 'Too many requests, please try again later',
      code: 'RATE_LIMIT_EXCEEDED',
    },
  },
})

// Native reverse proxy to Next.js client on port 3000
const proxyToClient = (req: express.Request, res: express.Response) => {
  const options: http.RequestOptions = {
    hostname: '127.0.0.1',
    port: 3000,
    path: req.originalUrl,
    method: req.method,
    headers: {
      ...req.headers,
      host: 'localhost:3000',
    },
  }

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 200, proxyRes.headers)
    proxyRes.pipe(res, { end: true })
  })

  proxyReq.on('error', (_err) => {
    const accept = req.headers.accept || ''
    if (accept.includes('text/html') && !res.headersSent) {
      return res.redirect('https://client-delta-rose-86.vercel.app' + req.originalUrl)
    }
    if (!res.headersSent) {
      res.status(502).json({
        success: false,
        error: { message: 'Local client is offline or starting', code: 'CLIENT_OFFLINE' },
      })
    }
  })

  req.pipe(proxyReq, { end: true })
}

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    },
  })
})

// Gateway root handler: redirect browser visitors directly to the deployed web application
app.get('/', (req, res) => {
  const accept = req.headers.accept || ''
  if (accept.includes('text/html')) {
    return res.redirect(302, 'https://client-delta-rose-86.vercel.app' + (req.originalUrl || ''))
  }
  return res.json({
    name: 'Jukebox Real-Time Server Gateway',
    status: 'online',
    frontend: 'https://client-delta-rose-86.vercel.app',
    health: '/health',
    credentials: '/api/system/credentials-inventory',
  })
})

// Parse JSON and URLEncoded ONLY for /api requests so proxy can stream raw bodies
app.use('/api', express.json({ limit: '2mb' }))
app.use('/api', express.urlencoded({ extended: true, limit: '2mb' }))
app.use('/api', limiter, routes)

// Proxy all non-API web traffic (HTML pages, Next.js JS/CSS chunks, icons) to local client
app.use((req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/health')) {
    return next()
  }
  return proxyToClient(req, res)
})

app.use(notFoundHandler)
app.use(errorHandler)

export default app
