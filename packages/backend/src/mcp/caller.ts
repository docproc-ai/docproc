import { auth } from '../lib/auth'
import { getUserAccessRow } from '../lib/db/user-operations'

/** The DocProc user an MCP request acts for, as read from the database. */
export type McpCaller = {
  id: string
  email: string
  name: string
  role: 'user' | 'admin'
}

export type McpResource = 'document' | 'documentType'
export type McpAction = 'create' | 'list' | 'update' | 'delete'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Reads the user fresh from the database (no caching) and returns them only
 * if they may use DocProc right now: they exist, are not banned (a ban with
 * a past `banExpires` has lapsed) and have role `user` or `admin`. Any other
 * role, including `none`, is refused.
 */
export async function loadActiveUser(
  userId: string,
  now: Date = new Date(),
): Promise<McpCaller | null> {
  // user.id is a uuid column: a non-uuid would make Postgres throw.
  if (!UUID.test(userId)) return null
  const row = await getUserAccessRow(userId)
  if (!row) return null
  if (row.banned && (!row.banExpires || row.banExpires > now)) return null
  if (row.role !== 'user' && row.role !== 'admin') return null
  return { id: row.id, email: row.email, name: row.name, role: row.role }
}

/** Live permission check via better-auth's access control; false on any error. */
export async function checkPermission(
  caller: Pick<McpCaller, 'id'>,
  resource: McpResource,
  action: McpAction,
): Promise<boolean> {
  try {
    const result = await auth.api.userHasPermission({
      body: { userId: caller.id, permissions: { [resource]: [action] } },
    })
    return result?.success === true
  } catch (error) {
    console.error('[mcp] permission check failed:', error)
    return false
  }
}
