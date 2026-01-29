import { eq } from 'drizzle-orm'
import { db } from '../db'
import { user } from '../db/schema/auth'
import { auth } from './auth'

export async function initDefaultUser() {
  const defaultEmail = process.env.AUTH_ADMIN_EMAIL
  const defaultPassword = process.env.AUTH_ADMIN_PASSWORD

  if (!defaultEmail || !defaultPassword) {
    // Not configured - skip silently
    return
  }

  try {
    // Check if default user already exists
    const existingUser = await db
      .select()
      .from(user)
      .where(eq(user.email, defaultEmail))
      .limit(1)

    if (existingUser.length > 0) {
      console.log('Default admin user already exists')
      return
    }

    // Create default admin user using signUpEmail (doesn't require admin plugin fields)
    console.log('Creating default admin user...')

    const result = await auth.api.signUpEmail({
      body: {
        email: defaultEmail,
        password: defaultPassword,
        name: 'Admin',
      },
    })

    if (result) {
      // Update role to admin
      await db
        .update(user)
        .set({ role: 'admin' })
        .where(eq(user.email, defaultEmail))

      console.log('Default admin user created successfully')
    }
  } catch (error) {
    console.error('Error creating default admin user:', error)
  }
}
