import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { serveStatic } from 'hono/bun'

import { documents } from './routes/documents'
import { documentTypes } from './routes/document-types'

// Base app with middleware
const app = new Hono()
  .use('*', logger())
  .use('/api/*', cors())

// Chain all routes - this is what gets exported for RPC types
const routes = app
  .get('/health', (c) => c.json({ status: 'ok' }, 200))
  .route('/api/documents', documents)
  .route('/api/document-types', documentTypes)

// Export type for Hono RPC client
export type AppType = typeof routes

// In production, serve static frontend files
if (process.env.NODE_ENV === 'production') {
  app.use('/*', serveStatic({ root: './dist/frontend' }))
}

const server = Bun.serve({
  port: process.env.PORT ? Number(process.env.PORT) : 3001,
  fetch: app.fetch,
})

console.log(`Server running at http://localhost:${server.port}`)
