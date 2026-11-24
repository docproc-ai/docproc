import { oauthProviderClient } from '@better-auth/oauth-provider/client'
import { adminClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'
import { ac, roles } from './auth/permissions'

export const authClient = createAuthClient({
  plugins: [
    adminClient({
      ac,
      roles,
    }),
    oauthProviderClient(),
  ],
})

export const { useSession, signIn, signUp, signOut } = authClient
