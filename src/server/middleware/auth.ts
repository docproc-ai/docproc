import { createMiddleware } from 'hono/factory'

// Placeholder for auth middleware
// Will be implemented with better-auth

export const requireAuth = createMiddleware(async (c, next) => {
  // TODO: Implement session validation with better-auth
  // const session = await auth.api.getSession({ headers: c.req.raw.headers })
  // if (!session) return c.json({ error: 'Unauthorized' }, 401)
  // c.set('session', session)
  // c.set('user', session.user)
  await next()
})

export const requireApiKeyOrAuth = createMiddleware(async (c, next) => {
  const apiKey = c.req.header('x-api-key')

  if (apiKey && apiKey === process.env.API_KEY) {
    c.set('isApiKey', true)
    await next()
    return
  }

  // Fall back to session auth
  // TODO: Implement with better-auth
  await next()
})

export const requirePermission = (permission: string) => {
  return createMiddleware(async (c, next) => {
    // TODO: Implement permission checking
    await next()
  })
}
