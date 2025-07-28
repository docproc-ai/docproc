import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from '@/db'
import { admin } from 'better-auth/plugins'
import * as schema from '@/db/schema/auth'
import { checkMicrosoftAuth } from './auth/providers/microsoft'
import { checkGoogleAuth } from './auth/providers/google'
import { checkGitHubAuth } from './auth/providers/github'

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: schema,
  }),
  plugins: [admin()],
  emailAndPassword: {
    enabled: process.env.AUTH_EMAIL_PASSWORD_ENABLED === 'true',
    requireEmailVerification: false,
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
})
