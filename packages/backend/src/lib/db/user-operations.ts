/**
 * User lookups that don't go through better-auth.
 * Context-free - can be called from API routes, MCP or background jobs
 */

import { eq } from 'drizzle-orm'
import { db } from '../../db'
import { user } from '../../db/schema/auth'

export type UserAccessRow = {
  id: string
  email: string
  name: string
  role: string
  banned: boolean | null
  banExpires: Date | null
}

/** The fields needed to decide whether a user may act right now (fresh read). */
export async function getUserAccessRow(
  userId: string,
): Promise<UserAccessRow | null> {
  const [row] = await db
    .select({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      banned: user.banned,
      banExpires: user.banExpires,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)
  return row ?? null
}
