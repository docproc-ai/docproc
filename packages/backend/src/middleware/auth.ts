import { createMiddleware } from 'hono/factory'
import { auth, type Session, type User } from '../lib/auth'

// Extend Hono's context variables
declare module 'hono' {
  interface ContextVariableMap {
    session: Session | null
    user: User | null
    isApiKey: boolean
  }
}

/**
 * Middleware that requires session authentication
 * Rejects requests without a valid session
 */
export const requireAuth = createMiddleware(async (c, next) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  })

  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  c.set('session', session)
  c.set('user', session.user)
  c.set('isApiKey', false)

  await next()
})

/**
 * Middleware that accepts either API key or session authentication
 * Useful for endpoints that support both automated and user access
 */
export const requireApiKeyOrAuth = createMiddleware(async (c, next) => {
  const apiKey = c.req.header('x-api-key')

  // API key bypasses session checks
  if (apiKey && process.env.API_KEY && apiKey === process.env.API_KEY) {
    c.set('isApiKey', true)
    c.set('session', null)
    c.set('user', null)
    await next()
    return
  }

  // Fall back to session auth
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  })

  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  c.set('session', session)
  c.set('user', session.user)
  c.set('isApiKey', false)

  await next()
})

/**
 * Middleware factory that checks for a specific permission using better-auth's access control
 * Must be used after requireAuth or requireApiKeyOrAuth
 *
 * @param resource - The resource type (e.g., 'documentType', 'document')
 * @param action - The action to check (e.g., 'create', 'list', 'update', 'delete')
 */
export const requirePermission = (
  resource: string,
  action: string | string[],
) => {
  return createMiddleware(async (c, next) => {
    // API key has all permissions
    if (c.get('isApiKey')) {
      await next()
      return
    }

    const user = c.get('user')

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    try {
      // Use better-auth's built-in permission checking
      const actions = Array.isArray(action) ? action : [action]
      const permissionResult = await auth.api.userHasPermission({
        body: {
          userId: user.id,
          permissions: { [resource]: actions },
        },
      })

      if (!permissionResult || !permissionResult.success) {
        return c.json({ error: 'Forbidden' }, 403)
      }

      await next()
    } catch (error) {
      console.error('Permission check failed:', error)
      return c.json({ error: 'Permission check failed' }, 500)
    }
  })
}

/**
 * Optional auth middleware - populates session if available but doesn't require it
 */
export const optionalAuth = createMiddleware(async (c, next) => {
  const apiKey = c.req.header('x-api-key')

  if (apiKey && process.env.API_KEY && apiKey === process.env.API_KEY) {
    c.set('isApiKey', true)
    c.set('session', null)
    c.set('user', null)
    await next()
    return
  }

  try {
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    })

    c.set('session', session)
    c.set('user', session?.user || null)
    c.set('isApiKey', false)
  } catch {
    c.set('session', null)
    c.set('user', null)
    c.set('isApiKey', false)
  }

  await next()
})
