import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { auth } from '../lib/auth'

const configRoute = createRoute({
  method: 'get',
  path: '/config',
  tags: ['Auth'],
  summary: 'Get authentication configuration',
  description: 'Returns enabled authentication providers for the frontend',
  responses: {
    200: {
      description: 'Auth configuration',
      content: {
        'application/json': {
          schema: z.object({
            socialProviders: z.array(z.string()),
            emailPasswordEnabled: z.boolean(),
          }),
        },
      },
    },
  },
})

const authRoutes = new OpenAPIHono()

  .openapi(configRoute, (c) => {
    const socialProviders: string[] = []

    // Check Microsoft auth
    if (process.env.AUTH_MICROSOFT_ENABLED === 'true') {
      const hasRequiredVars =
        process.env.AUTH_MICROSOFT_CLIENT_ID &&
        process.env.AUTH_MICROSOFT_CLIENT_SECRET &&
        process.env.AUTH_MICROSOFT_TENANT_ID

      if (hasRequiredVars) {
        socialProviders.push('microsoft')
      }
    }

    // Check Google auth
    if (process.env.AUTH_GOOGLE_ENABLED === 'true') {
      const hasRequiredVars =
        process.env.AUTH_GOOGLE_CLIENT_ID &&
        process.env.AUTH_GOOGLE_CLIENT_SECRET

      if (hasRequiredVars) {
        socialProviders.push('google')
      }
    }

    // Check GitHub auth
    if (process.env.AUTH_GITHUB_ENABLED === 'true') {
      const hasRequiredVars =
        process.env.AUTH_GITHUB_CLIENT_ID &&
        process.env.AUTH_GITHUB_CLIENT_SECRET

      if (hasRequiredVars) {
        socialProviders.push('github')
      }
    }

    // Check email/password auth
    const emailPasswordEnabled =
      process.env.AUTH_EMAIL_PASSWORD_ENABLED !== 'false'

    return c.json({
      socialProviders,
      emailPasswordEnabled,
    })
  })

  // Better-auth handles all other /api/auth/* routes
  .on(['GET', 'POST'], '/*', (c) => {
    return auth.handler(c.req.raw)
  })

export { authRoutes }
