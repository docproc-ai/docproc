import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { serveStatic } from 'hono/bun'

// Create app with chained routes for type inference
const app = new Hono()
  .use('*', logger())
  .use('/api/*', cors())
  .get('/health', (c) => c.json({ status: 'ok' }))
  .get('/api', (c) => c.json({ message: 'DocProc API', version: '1.0.0' }))

// Export type for Hono RPC client
export type AppType = typeof app

// In production, serve static frontend files
if (process.env.NODE_ENV === 'production') {
  app.use('/*', serveStatic({ root: './dist/frontend' }))
}

const server = Bun.serve({
  port: process.env.PORT ? Number(process.env.PORT) : 3001,
  fetch: app.fetch,
})

console.log(`Server running at http://localhost:${server.port}`)
