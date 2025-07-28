'use server'

export interface AuthConfig {
  socialProviders: string[]
  emailPasswordEnabled: boolean
}

export async function getEnabledAuthProviders(): Promise<AuthConfig> {
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
  const emailPasswordEnabled = process.env.AUTH_EMAIL_PASSWORD_ENABLED === 'true'

  return {
    socialProviders,
    emailPasswordEnabled
  }
}
