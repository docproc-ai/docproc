/**
 * Core database operations for users
 * Context-free - can be called from API routes, Server Actions, or background jobs
 */

import { db } from '@/db'
import { user } from '@/db/schema/auth'
import { eq } from 'drizzle-orm'

export interface UserListItem {
  id: string
  name: string | null
  email: string
  role: string
  emailVerified: boolean
  createdAt: Date
  updatedAt: Date
}

/**
 * Get all users (without sensitive data)
 */
export async function getUsersCore(): Promise<UserListItem[]> {
  const users = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    })
    .from(user)
    .orderBy(user.createdAt)

  return users
}

/**
 * Update user role
 */
export async function updateUserRoleCore(userId: string, newRole: string): Promise<void> {
  await db
    .update(user)
    .set({
      role: newRole,
      updatedAt: new Date(),
    })
    .where(eq(user.id, userId))
}

/**
 * Delete a user
 */
export async function deleteUserCore(userId: string): Promise<void> {
  await db.delete(user).where(eq(user.id, userId))
}

/**
 * Update user role by email (for use after user creation)
 */
export async function updateUserRoleByEmailCore(email: string, role: string): Promise<void> {
  await db.update(user).set({ role }).where(eq(user.email, email))
}
