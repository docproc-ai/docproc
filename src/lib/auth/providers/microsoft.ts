import { MicrosoftOptions } from 'better-auth/social-providers'

export function checkMicrosoftAuth() {
  const enabled = process.env.AUTH_MICROSOFT_ENABLED === 'true'
  if (!enabled) return undefined

  const clientId = process.env.AUTH_MICROSOFT_CLIENT_ID
  const clientSecret = process.env.AUTH_MICROSOFT_CLIENT_SECRET
  const tenantId = process.env.AUTH_MICROSOFT_TENANT_ID

  if (!clientId || !clientSecret || !tenantId) {
    throw new Error(
      'Microsoft authentication is enabled but required environment variables are missing.',
    )
  }

  return {
    clientId,
    clientSecret,
    tenantId,
  } as MicrosoftOptions
}
