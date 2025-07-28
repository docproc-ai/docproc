import { initDefaultUser } from '@/lib/init-default-user'
import { runMigrations } from '@/db/migrate'

export async function init() {
  await runMigrations()
  // Initialize the default admin user if it doesn't exist
  if (
    process.env.AUTH_EMAIL_PASSWORD_ENABLED !== 'false' &&
    process.env.AUTH_ADMIN_EMAIL &&
    process.env.AUTH_ADMIN_PASSWORD
  ) {
    await initDefaultUser()
  }

  // Additional server initialization logic can go here
  console.log('Server initialized successfully')
}
