import type { GithubOptions } from 'better-auth/social-providers'

export function checkGitHubAuth() {
  const enabled = process.env.AUTH_GITHUB_ENABLED === 'true'
  if (!enabled) return undefined

  const clientId = process.env.AUTH_GITHUB_CLIENT_ID
  const clientSecret = process.env.AUTH_GITHUB_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error(
      'GitHub authentication is enabled but required environment variables are missing.',
    )
  }

  return {
    clientId,
    clientSecret,
  } as GithubOptions
}
