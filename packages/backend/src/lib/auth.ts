import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin as adminPlugin } from 'better-auth/plugins'
import { db } from '../db'
import * as schema from '../db/schema/auth'
import { checkMicrosoftAuth } from './auth/providers/microsoft'
import { checkGoogleAuth } from './auth/providers/google'
import { checkGitHubAuth } from './auth/providers/github'
import { ac, roles } from './auth/permissions'

const ADMIN_EMAILS = process.env.AUTH_ADMIN_EMAILS?.split(',') || []

export const auth = betterAuth({
  trustedOrigins: process.env.BETTER_AUTH_URL
    ? [process.env.BETTER_AUTH_URL]
    : ['http://localhost:3000'],
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
