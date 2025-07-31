import { headers } from 'next/headers'
import { auth } from '@/lib/auth'

/**
 * Check if request is authenticated via API key or has required permissions
 * Returns true if:
 * 1. Valid API key is present (bypasses permission checks)
 * 2. User session has required permissions
 */
export async function checkApiAuth(requiredPermissions: Record<string, string[]>): Promise<{
  success: boolean
  isApiKey: boolean
}> {
  const headersList = await headers()
  const apiKey = headersList.get('x-api-key')
  const validApiKey = process.env.API_KEY

  // If valid API key is present, allow full access
  if (apiKey && validApiKey && apiKey === validApiKey) {
    return { success: true, isApiKey: true }
  }

  // No API key, check user session permissions
  try {
    const permissionCheck = await auth.api.userHasPermission({
      headers: headersList,
      body: {
        permissions: requiredPermissions
      }
    })

    return { success: permissionCheck.success, isApiKey: false }
  } catch (error) {
    console.error('Permission check failed:', error)
    return { success: false, isApiKey: false }
  }
}
