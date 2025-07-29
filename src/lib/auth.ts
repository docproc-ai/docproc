import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from '@/db'
import { admin as adminPlugin, createAuthMiddleware } from 'better-auth/plugins'
import * as schema from '@/db/schema/auth'
import { checkMicrosoftAuth } from './auth/providers/microsoft'
import { checkGoogleAuth } from './auth/providers/google'
import { checkGitHubAuth } from './auth/providers/github'
import { ac, roles } from './auth/permissions'
import { nextCookies } from 'better-auth/next-js'

const ADMIN_EMAILS = process.env.AUTH_ADMIN_EMAILS?.split(',') || []

export const auth = betterAuth({
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
    nextCookies(),
  ],
  emailAndPassword: {
    enabled: process.env.AUTH_EMAIL_PASSWORD_ENABLED !== 'false',
    requireEmailVerification: false,
    disableSignUp: true,
  },
  socialProviders: {
    microsoft: checkMicrosoftAuth(),
    google: checkGoogleAuth(),
    github: checkGitHubAuth(),
  },
  advanced: {
    database: {
      generateId: false,
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
        defaultValue: 'user',
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          if (user.email && ADMIN_EMAILS.includes(user.email)) {
            return { data: { ...user, role: 'admin' } }
          }
          return { data: user }
        },
      },
    },
  },
})
