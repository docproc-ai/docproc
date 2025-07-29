import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

/**
 * Check if the current user has the specified permissions using better-auth's access control
 */
export async function checkPermissions(permissions: Record<string, string[]>) {
  const headersList = await headers()

  // Check for API key authentication first
  const apiKey = headersList.get('x-api-key')
  if (apiKey && apiKey === process.env.API_KEY) {
    return { success: true }
  }

  // Get the current session
  const session = await auth.api.getSession({
    headers: headersList,
  })

  if (!session?.user) {
    return { success: false, error: 'Authentication required' }
  }

  try {
    // Use better-auth's built-in permission checking
    const permissionResult = await auth.api.userHasPermission({
      body: {
        userId: session.user.id,
        permissions,
      },
    })

    if (!permissionResult || !permissionResult.success) {
      return { success: false, error: 'Insufficient permissions' }
    }

    return { success: true }
  } catch (error) {
    console.error('Permission check failed:', error)
    return { success: false, error: 'Permission check failed' }
  }
}

/**
 * Check if the current user can perform document type operations
 */
export async function checkDocumentTypePermissions(actions: string[]) {
  return checkPermissions({ documentType: actions })
}

/**
 * Check if the current user can perform document operations
 */
export async function checkDocumentPermissions(actions: string[]) {
  return checkPermissions({ document: actions })
}

/**
 * Check if the current user has admin permissions (for user management)
 */
export async function checkAdminPermissions(actions: string[]) {
  return checkPermissions({ user: actions })
}

/**
 * Legacy function for backward compatibility - checks admin access
 * @deprecated Use checkDocumentTypePermissions or other specific permission checks instead
 */
export async function checkAdminAccess() {
  const headersList = await headers()

  // Check for API key authentication first
  const apiKey = headersList.get('x-api-key')
  if (apiKey && apiKey === process.env.API_KEY) {
    return { success: true }
  }

  // Fall back to session authentication
  const session = await auth.api.getSession({
    headers: headersList,
  })

  if (!session?.user) {
    return { success: false, error: 'Authentication required' }
  }

  if (session.user.role !== 'admin') {
    return { success: false, error: 'Admin access required' }
  }

  return { success: true }
}
