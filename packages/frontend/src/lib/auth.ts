import { adminClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'
import { ac, roles } from './auth/permissions'

export const authClient = createAuthClient({
  plugins: [
    adminClient({
      ac,
      roles,
    }),
  ],
})

export const { useSession, signIn, signUp, signOut } = authClient
