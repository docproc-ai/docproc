'use server'

import { db } from '@/db'
import { user } from '@/db/schema/auth'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export async function getUsers() {
  try {
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
  } catch (error) {
    console.error('Error fetching users:', error)
    throw new Error('Failed to fetch users')
  }
}

export async function updateUserRole(userId: string, newRole: string) {
  try {
    await db
      .update(user)
      .set({
        role: newRole,
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId))

    revalidatePath('/users')
    return { success: true }
  } catch (error) {
    console.error('Error updating user role:', error)
    throw new Error('Failed to update user role')
  }
}

export async function deleteUser(userId: string) {
  try {
    await db.delete(user).where(eq(user.id, userId))

    revalidatePath('/users')
    return { success: true }
  } catch (error) {
    console.error('Error deleting user:', error)
    throw new Error('Failed to delete user')
  }
}

export async function createUser(formData: FormData) {
  try {
    const name = formData.get('name') as string
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const role = formData.get('role') as string

    if (!name || !email || !password) {
      throw new Error('Name, email, and password are required')
    }

    // Create user via better-auth
    const result = await auth.api.signUpEmail({
      body: {
        email,
        password,
        name,
      },
    })

    if (result) {
      // Update user role if specified
      if (role && role !== 'user') {
        await db.update(user).set({ role }).where(eq(user.email, email))
      }

      revalidatePath('/users')
      return { success: true }
    } else {
      throw new Error('Failed to create user')
    }
  } catch (error) {
    console.error('Error creating user:', error)
    throw new Error(error instanceof Error ? error.message : 'Failed to create user')
  }
}
