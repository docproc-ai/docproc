import { OpenAPIHono } from '@hono/zod-openapi'
import { swaggerUI } from '@hono/swagger-ui'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { serveStatic } from 'hono/bun'
import { nanoid } from 'nanoid'
import { resolve } from 'node:path'
import type { Context } from 'hono'

import { requireAuthOrRedirect } from './middleware/auth'
import { runMigrations } from './db/migrate'
import { initDefaultUser } from './lib/init-default-user'
import { authRoutes } from './routes/auth'
import { documentsRoutes } from './routes/documents'
import { documentTypesRoutes } from './routes/document-types'
import { processingRoutes } from './routes/processing'
import { usersRoutes } from './routes/users'
import modelsRoutes from './routes/models'
import { createWebSocketHandler, type WebSocketData } from './lib/websocket'

// Base app with middleware
const app = new OpenAPIHono()

app.use('*', logger())
app.use('/api/*', cors())
app.get('/health', (c) => c.json({ status: 'ok' }, 200))

// Register routes
app.route('/api/auth', authRoutes)
app.route('/api/documents', documentsRoutes)
app.route('/api/document-types', documentTypesRoutes)
app.route('/api', processingRoutes)
app.route('/api/users', usersRoutes)
app.route('/api/models', modelsRoutes)

// OpenAPI documentation (auth protected, redirects to login)
app.use('/api/doc', requireAuthOrRedirect)
app.use('/api/docs', requireAuthOrRedirect)
app.doc('/api/doc', {
  openapi: '3.0.0',
  info: {
    title: 'DocProc API',
    version: '1.0.0',
    description: 'Document processing API for extracting structured data from documents',
  },
})
app.get('/api/docs', swaggerUI({ url: '/api/doc' }))

// Export type for Hono RPC client
export type AppType = typeof app

// In production, serve static frontend files
if (process.env.NODE_ENV === 'production') {
  const staticRoot = resolve(process.cwd(), 'dist/frontend')

  // Serve static assets
  app.use('/assets/*', serveStatic({ root: staticRoot }))

  // SPA fallback - serve index.html for non-API routes
  app.get('*', async (c: Context) => {
    const path = c.req.path
    // Skip API routes
    if (path.startsWith('/api') || path.startsWith('/ws')) {
      return c.notFound()
    }
    // Try to serve the exact file first
    const file = Bun.file(resolve(staticRoot, path.slice(1)))
    if (await file.exists()) {
      return new Response(file)
    }
    // Fall back to index.html for SPA routing
    return new Response(Bun.file(resolve(staticRoot, 'index.html')))
  })
}

// Startup routine
async function start() {
  // Run migrations
  try {
    await runMigrations()
  } catch (error) {
    console.error('Failed to run migrations:', error)
    process.exit(1)
  }

  // Initialize default admin user if configured
  if (
    process.env.AUTH_EMAIL_PASSWORD_ENABLED !== 'false' &&
    process.env.AUTH_ADMIN_EMAIL &&
    process.env.AUTH_ADMIN_PASSWORD
  ) {
    await initDefaultUser()
  }

  // Create WebSocket handler
  const wsHandler = createWebSocketHandler()

  // Start server with WebSocket support
  const server = Bun.serve<WebSocketData>({
    port: process.env.PORT ? Number(process.env.PORT) : 3001,
    idleTimeout: 255, // Max allowed by Bun for long-running AI processing
    fetch(req, server) {
      // Handle WebSocket upgrade for /ws path
      const url = new URL(req.url)
      if (url.pathname === '/ws') {
        const upgraded = server.upgrade(req, {
          data: {
            id: nanoid(),
            subscriptions: [],
          },
        })
        if (upgraded) {
          return undefined
        }
        return new Response('WebSocket upgrade failed', { status: 500 })
      }

      // Handle all other requests with Hono
      return app.fetch(req)
    },
    websocket: wsHandler,
  })

  console.log(`Server running at http://localhost:${server.port}`)
  console.log(`WebSocket available at ws://localhost:${server.port}/ws`)
}

start()
