import { createServer } from 'http'
import app from './app'
import { config } from './config'
import { setupSocket } from './sockets'
import { createDbClient } from './config/database'

async function main(): Promise<void> {
  try {
    createDbClient()
    console.log('[DB] Database client initialized')
  } catch (error) {
    console.warn('[DB] Database client initialization failed:', error instanceof Error ? error.message : error)
    console.warn('[DB] Server will start without database connectivity')
  }

  const httpServer = createServer(app)

  const io = setupSocket(httpServer)

  httpServer.listen(config.port, '0.0.0.0', () => {
    console.log(`
╔══════════════════════════════════════════╗
║          Jukebox Server v1.0.0           ║
║──────────────────────────────────────────║
║  Port:        ${String(config.port).padEnd(27)}║
║  Host:        ${'0.0.0.0'.padEnd(27)}║
║  Environment: ${config.nodeEnv.padEnd(27)}║
║  CORS Origin: ${'Universal (Dynamic)'.padEnd(27)}║
║  Socket.IO:   ${'Enabled'.padEnd(27)}║
╚══════════════════════════════════════════╝
    `)
  })

  process.on('SIGTERM', () => {
    console.log('[Server] SIGTERM received, shutting down gracefully...')
    io.close(() => {
      httpServer.close(() => {
        process.exit(0)
      })
    })
  })

  process.on('SIGINT', () => {
    console.log('[Server] SIGINT received, shutting down gracefully...')
    io.close(() => {
      httpServer.close(() => {
        process.exit(0)
      })
    })
  })

  process.on('unhandledRejection', (reason) => {
    console.error('[Server] Unhandled rejection:', reason)
  })

  process.on('uncaughtException', (error) => {
    console.error('[Server] Uncaught exception:', error)
    process.exit(1)
  })
}

main()
