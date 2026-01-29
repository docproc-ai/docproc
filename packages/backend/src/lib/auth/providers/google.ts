import type { GoogleOptions } from 'better-auth/social-providers'

export function checkGoogleAuth() {
  const enabled = process.env.AUTH_GOOGLE_ENABLED === 'true'
  if (!enabled) return undefined

  const clientId = process.env.AUTH_GOOGLE_CLIENT_ID
  const clientSecret = process.env.AUTH_GOOGLE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error(
      'Google authentication is enabled but required environment variables are missing.',
    )
  }

  return {
    clientId,
    clientSecret,
  } as GoogleOptions
}
