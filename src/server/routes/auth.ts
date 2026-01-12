import { Hono } from 'hono'
import { auth } from '../lib/auth'

const authRoutes = new Hono().basePath('/api/auth')

// Better-auth handles all /api/auth/* routes
authRoutes.on(['GET', 'POST'], '/*', (c) => {
  return auth.handler(c.req.raw)
})

export { authRoutes }
