# Authentication (Target)

## Overview

Authentication uses [Better-Auth](https://www.better-auth.com/) with the Hono adapter. The permission system remains unchanged from the current implementation.

## Changes from Current

| Aspect | Current | Target |
|--------|---------|--------|
| Framework integration | Next.js middleware | Hono middleware |
| Session storage | Same (PostgreSQL) | Same |
| Social providers | Same | Same |
| Permissions | Same | Same |

## Hono Integration

### Setup

```typescript
// src/server/routes/auth.ts
import { Hono } from 'hono'
import { auth } from '../lib/auth'

const app = new Hono()

// Better-auth handles all /api/auth/* routes
app.on(['GET', 'POST'], '/api/auth/*', (c) => {
  return auth.handler(c.req.raw)
})

export default app
```

### Auth Configuration

```typescript
// src/server/lib/auth.ts
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from '../../db'

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
  }),
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24,     // 1 day
  },
  socialProviders: {
    github: {
      clientId: process.env.AUTH_GITHUB_CLIENT_ID!,
      clientSecret: process.env.AUTH_GITHUB_CLIENT_SECRET!,
      enabled: process.env.AUTH_GITHUB_ENABLED === 'true',
    },
    google: {
      clientId: process.env.AUTH_GOOGLE_CLIENT_ID!,
      clientSecret: process.env.AUTH_GOOGLE_CLIENT_SECRET!,
      enabled: process.env.AUTH_GOOGLE_ENABLED === 'true',
    },
    microsoft: {
      clientId: process.env.AUTH_MICROSOFT_CLIENT_ID!,
      clientSecret: process.env.AUTH_MICROSOFT_CLIENT_SECRET!,
      tenantId: process.env.AUTH_MICROSOFT_TENANT_ID!,
      enabled: process.env.AUTH_MICROSOFT_ENABLED === 'true',
    },
  },
  user: {
    additionalFields: {
      role: {
        type: 'string',
        defaultValue: 'none',
      },
    },
  },
})
```

## Auth Middleware

### Session Validation

```typescript
// src/server/middleware/auth.ts
import { createMiddleware } from 'hono/factory'
import { auth } from '../lib/auth'

export const requireAuth = createMiddleware(async (c, next) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  })

  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  c.set('session', session)
  c.set('user', session.user)

  await next()
})
```

### Permission Check

```typescript
// src/server/middleware/auth.ts
import { checkPermission } from '../lib/permissions'

export const requirePermission = (permission: string) => {
  return createMiddleware(async (c, next) => {
    const user = c.get('user')

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const hasPermission = await checkPermission(user.id, permission)

    if (!hasPermission) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    await next()
  })
}
```

### API Key Auth

```typescript
// src/server/middleware/auth.ts
export const requireApiKeyOrAuth = createMiddleware(async (c, next) => {
  const apiKey = c.req.header('x-api-key')

  // API key bypasses all checks
  if (apiKey && apiKey === process.env.API_KEY) {
    c.set('isApiKey', true)
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
```

## Usage in Routes

```typescript
// src/server/routes/documents.ts
import { Hono } from 'hono'
import { requireAuth, requirePermission, requireApiKeyOrAuth } from '../middleware/auth'

const app = new Hono()

// Public route (API key or session)
app.get('/api/documents', requireApiKeyOrAuth, async (c) => {
  // ...
})

// Protected route (session only)
app.post('/api/documents', requireAuth, requirePermission('document:create'), async (c) => {
  // ...
})

// Admin route
app.delete('/api/document-types/:id', requireAuth, requirePermission('documentType:delete'), async (c) => {
  // ...
})

export default app
```

## Client Integration

### Auth Client

```typescript
// src/client/lib/auth.ts
import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL,
})

export const { useSession, signIn, signOut } = authClient
```

### Protected Routes

```typescript
// src/client/routes/__root.tsx
import { createRootRoute, Outlet, redirect } from '@tanstack/react-router'
import { authClient } from '../lib/auth'

export const Route = createRootRoute({
  beforeLoad: async ({ location }) => {
    const session = await authClient.getSession()

    if (!session && !location.pathname.startsWith('/auth')) {
      throw redirect({ to: '/auth/signin' })
    }
  },
  component: RootLayout,
})
```

## Permissions (Unchanged)

### Role Hierarchy

| Role | Permissions |
|------|-------------|
| `admin` | All permissions |
| `user` | document:*, documentType:list |
| `none` | No permissions |

### Permission Matrix

| Permission | admin | user | none |
|------------|-------|------|------|
| `documentType:create` | ✓ | | |
| `documentType:list` | ✓ | ✓ | |
| `documentType:update` | ✓ | | |
| `documentType:delete` | ✓ | | |
| `document:create` | ✓ | ✓ | |
| `document:list` | ✓ | ✓ | |
| `document:update` | ✓ | ✓ | |
| `document:delete` | ✓ | ✓ | |

## Database Schema (Unchanged)

Same tables as current:
- `user`
- `session`
- `account`
- `verification`

See [current auth spec](../spec/02-authentication.md) for schema details.
