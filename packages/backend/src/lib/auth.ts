import { oauthProvider } from '@better-auth/oauth-provider'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin as adminPlugin, jwt } from 'better-auth/plugins'
import { db } from '../db'
import * as schema from '../db/schema/auth'
import { ac, roles } from './auth/permissions'
import { checkGitHubAuth } from './auth/providers/github'
import { checkGoogleAuth } from './auth/providers/google'
import { checkMicrosoftAuth } from './auth/providers/microsoft'
import { mcpConfig } from './mcp-config'

const ADMIN_EMAILS = process.env.AUTH_ADMIN_EMAILS?.split(',') || []

const trustedOrigins = process.env.BETTER_AUTH_URL
  ? [process.env.BETTER_AUTH_URL]
  : ['http://localhost:3000']
if (mcpConfig.enabled && !trustedOrigins.includes(mcpConfig.baseUrl)) {
  trustedOrigins.push(mcpConfig.baseUrl)
}

/**
 * OAuth 2.1 authorization server for MCP clients (Claude), registered only
 * when MCP is enabled. Access tokens are JWTs (RFC 9068) signed by the `jwt`
 * plugin and audience-bound to the `/mcp` resource; the MCP endpoint verifies
 * them in-process with `oauthProviderResourceClient(auth)` (local JWKS).
 */
const mcpPlugins = mcpConfig.enabled
  ? [
      jwt({
        // Only used to sign OAuth tokens: no session JWT header on getSession.
        disableSettingJwtHeader: true,
      }),
      oauthProvider({
        loginPage: '/login',
        consentPage: '/oauth/consent',
        allowDynamicClientRegistration: true,
        allowUnauthenticatedClientRegistration: true,
        // Treat registrations that omit application_type and use a loopback
        // or custom-scheme redirect (Claude Code, Desktop) as native clients;
        // the default ("web") rejects loopback redirects outright.
        clientRegistrationDefaultApplicationType: 'infer',
        resources: [mcpConfig.resource],
        clientRegistrationDefaultResources: [mcpConfig.resource],
        scopes: ['offline_access'],
        // Every token acts for a signed-in user: no client_credentials grant.
        grantTypes: ['authorization_code', 'refresh_token'],
      }),
    ]
  : []

export const auth = betterAuth({
  trustedOrigins,
  // The jwt plugin's session-JWT route is not needed for OAuth tokens.
  disabledPaths: mcpConfig.enabled ? ['/token'] : [],
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: schema,
  }),
  plugins: [
    adminPlugin({
      ac,
      roles,
      defaultRole: 'none',
    }),
    ...mcpPlugins,
  ],
  emailAndPassword: {
    enabled: process.env.AUTH_EMAIL_PASSWORD_ENABLED !== 'false',
    requireEmailVerification: false,
    disableSignUp: process.env.AUTH_DISABLE_SIGNUP === 'true',
  },
  socialProviders: {
    microsoft: checkMicrosoftAuth(),
    google: checkGoogleAuth(),
    github: checkGitHubAuth(),
  },
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ['microsoft', 'google', 'github'],
    },
  },
  advanced: {
    database: {
      generateId: false, // Use database default (UUID)
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // Update session every 24 hours
  },
  user: {
    additionalFields: {
      role: {
        type: 'string',
        defaultValue: 'none',
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          // Auto-assign admin role to configured admin emails
          if (user.email && ADMIN_EMAILS.includes(user.email)) {
            return { data: { ...user, role: 'admin' } }
          }
          return { data: user }
        },
      },
    },
  },
})

export type Session = typeof auth.$Infer.Session
export type User = typeof auth.$Infer.Session.user
