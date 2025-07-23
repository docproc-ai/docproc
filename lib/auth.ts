import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from '@/db'
import { admin } from 'better-auth/plugins'

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
  }),
  plugins: [admin()],
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  socialProviders: {
    // Disable all social providers for internal use
  },
  advanced: {
    generateId: () => crypto.randomUUID(),
  },
  // Disable user registration - internal only
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
  },
})
