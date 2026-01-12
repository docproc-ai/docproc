import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from '../../db'
import * as schema from '../../db/schema/auth'

const ADMIN_EMAILS = process.env.AUTH_ADMIN_EMAILS?.split(',') || []

export const auth = betterAuth({
  trustedOrigins: process.env.BETTER_AUTH_URL
    ? [process.env.BETTER_AUTH_URL]
    : ['http://localhost:3000'],
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: schema,
  }),
  plugins: [],
  emailAndPassword: {
    enabled: process.env.AUTH_EMAIL_PASSWORD_ENABLED !== 'false',
    requireEmailVerification: false,
    disableSignUp: process.env.AUTH_DISABLE_SIGNUP === 'true',
  },
  socialProviders: {
    github: {
      clientId: process.env.AUTH_GITHUB_CLIENT_ID || '',
      clientSecret: process.env.AUTH_GITHUB_CLIENT_SECRET || '',
      enabled: process.env.AUTH_GITHUB_ENABLED === 'true',
    },
    google: {
      clientId: process.env.AUTH_GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.AUTH_GOOGLE_CLIENT_SECRET || '',
      enabled: process.env.AUTH_GOOGLE_ENABLED === 'true',
    },
    microsoft: {
      clientId: process.env.AUTH_MICROSOFT_CLIENT_ID || '',
      clientSecret: process.env.AUTH_MICROSOFT_CLIENT_SECRET || '',
      tenantId: process.env.AUTH_MICROSOFT_TENANT_ID || '',
      enabled: process.env.AUTH_MICROSOFT_ENABLED === 'true',
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
        defaultValue: 'user',
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
