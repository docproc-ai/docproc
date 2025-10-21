'use server'

import { db } from '@/db'
import { user } from '@/db/schema/auth'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { checkAdminPermissions } from '@/lib/auth-utils'

export async function getUsers() {
  // Check user list permissions
  const permissionCheck = await checkAdminPermissions(['list'])
  if (!permissionCheck.success) {
    throw new Error(permissionCheck.error)
  }

  try {
    const { getUsersCore } = await import('@/lib/db/user-operations')
    return await getUsersCore()
  } catch (error) {
    console.error('Error fetching users:', error)
    throw new Error('Failed to fetch users')
  }
}

export async function updateUserRole(userId: string, newRole: string) {
  // Check user role management permissions
  const permissionCheck = await checkAdminPermissions(['set-role'])
  if (!permissionCheck.success) {
    throw new Error(permissionCheck.error)
  }

  try {
    const { updateUserRoleCore } = await import('@/lib/db/user-operations')
    await updateUserRoleCore(userId, newRole)

    revalidatePath('/users')
    return { success: true }
  } catch (error) {
    console.error('Error updating user role:', error)
    throw new Error('Failed to update user role')
  }
}

export async function deleteUser(userId: string) {
  // Check user deletion permissions
  const permissionCheck = await checkAdminPermissions(['delete'])
  if (!permissionCheck.success) {
    throw new Error(permissionCheck.error)
  }

  try {
    const { deleteUserCore } = await import('@/lib/db/user-operations')
    await deleteUserCore(userId)

    revalidatePath('/users')
    return { success: true }
  } catch (error) {
    console.error('Error deleting user:', error)
    throw new Error('Failed to delete user')
  }
}

export async function createUser(formData: FormData) {
  // Check user creation permissions
  const permissionCheck = await checkAdminPermissions(['create'])
  if (!permissionCheck.success) {
    throw new Error(permissionCheck.error)
  }

  try {
    const name = formData.get('name') as string
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const role = formData.get('role') as string

    if (!name || !email || !password) {
      throw new Error('Name, email, and password are required')
    }

    // Create user via better-auth
    const result = await auth.api.createUser({
      body: {
        email,
        password,
        name,
      },
    })

    if (result) {
      // Update user role if specified
      if (role && role !== 'user') {
        const { updateUserRoleByEmailCore } = await import('@/lib/db/user-operations')
        await updateUserRoleByEmailCore(email, role)
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
