'use server'

export async function getEnabledAuthProviders(): Promise<string[]> {
  const providers: string[] = []

  // Check Microsoft auth
  if (process.env.AUTH_MICROSOFT_ENABLED === 'true') {
    const hasRequiredVars = 
      process.env.AUTH_MICROSOFT_CLIENT_ID &&
      process.env.AUTH_MICROSOFT_CLIENT_SECRET &&
      process.env.AUTH_MICROSOFT_TENANT_ID

    if (hasRequiredVars) {
      providers.push('microsoft')
    }
  }

  // Check Google auth
  if (process.env.AUTH_GOOGLE_ENABLED === 'true') {
    const hasRequiredVars = 
      process.env.AUTH_GOOGLE_CLIENT_ID &&
      process.env.AUTH_GOOGLE_CLIENT_SECRET

    if (hasRequiredVars) {
      providers.push('google')
    }
  }

  // Check GitHub auth
  if (process.env.AUTH_GITHUB_ENABLED === 'true') {
    const hasRequiredVars = 
      process.env.AUTH_GITHUB_CLIENT_ID &&
      process.env.AUTH_GITHUB_CLIENT_SECRET

    if (hasRequiredVars) {
      providers.push('github')
    }
  }

  return providers
}
