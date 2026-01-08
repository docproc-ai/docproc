import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'

const app = new Hono()

// Middleware
app.use('*', logger())
app.use('/api/*', cors())

// Health check
app.get('/health', (c) => c.json({ status: 'ok' }))

// API routes (to be added)
app.get('/api', (c) => c.json({ message: 'DocProc API' }))

// WebSocket upgrade will be handled separately with Bun.serve

const server = Bun.serve({
  port: 3001,
  fetch: app.fetch,
})

console.log(`Server running at http://localhost:${server.port}`)
