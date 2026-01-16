/**
 * Simple role-based permission system
 * Permissions are defined per resource and action
 */

export type Role = 'admin' | 'user' | 'none'
export type Resource = 'documentType' | 'document' | 'user'
export type Action = 'create' | 'list' | 'update' | 'delete'

// Define what each role can do
const rolePermissions: Record<Role, Record<Resource, Action[]>> = {
  admin: {
    documentType: ['create', 'list', 'update', 'delete'],
    document: ['create', 'list', 'update', 'delete'],
    user: ['create', 'list', 'update', 'delete'],
  },
  user: {
    documentType: ['list'],
    document: ['create', 'list', 'update', 'delete'],
    user: [],
  },
  none: {
    documentType: [],
    document: [],
    user: [],
  },
}

/**
 * Check if a role has permission to perform an action on a resource
 */
export function hasPermission(
  role: string | undefined | null,
  resource: Resource,
  action: Action,
): boolean {
  const normalizedRole = (role || 'none') as Role
  const permissions = rolePermissions[normalizedRole]

  if (!permissions) {
    return false
  }

  const resourcePermissions = permissions[resource]
  if (!resourcePermissions) {
    return false
  }

  return resourcePermissions.includes(action)
}
