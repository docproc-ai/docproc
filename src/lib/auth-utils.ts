import { headers } from 'next/headers'
import { authClient } from '@/lib/auth-client'

/**
 * Validate if the current user is an admin
 * Returns the session if user is admin, null otherwise
 */
export async function validateAdminUser() {
  try {
    const session = await authClient.getSession({
      fetchOptions: {
        headers: await headers(),
      },
    })

    if (!session?.data?.user || session.data.user.role !== 'admin') {
      return null
    }

    return session
  } catch (error) {
    console.error('Failed to validate admin user:', error)
    return null
  }
}

/**
 * Check if a user session has admin privileges
 */
export function isAdminUser(session: any): boolean {
  return session?.user?.role === 'admin'
}
